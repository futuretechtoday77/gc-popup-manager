// Redis-backed state for the discount claim flow: per-email idempotency
// records, per-identity locks, per-IP rate limiting, per-offer daily caps, and
// the registry of codes GCPM created (the only codes cleanup may ever delete).
import { createHash } from "crypto";
import { getRedis } from "./redis";
import type { Submission } from "./types";

export interface DiscountEmailRecord {
  code: string;
  endsAt: string;
  discountId: string;
}

// Discount state for a submission, stored in its OWN key — never inside
// submission:{id}. The GC queue processor owns submission:{id} and may be
// loading/saving it concurrently; writing the full submission object from the
// claim flow would race and could revert status / gcContactId / tagFired. The
// readers in lib/redis.ts overlay these fields onto the returned submission.
export interface SubmissionDiscountState {
  discount?: Submission["discount"];
  discountStatus?: Submission["discountStatus"];
}

export interface DiscountMeta {
  code: string;
  popupId: string;
  endsAt: string;
}

export const discountKeys = {
  email: (popupId: string, hash: string) => `gcpm:disc:email:${popupId}:${hash}`,
  lock: (popupId: string, hash: string) => `gcpm:disc:lock:${popupId}:${hash}`,
  cap: (popupId: string, yyyymmdd: string) =>
    `gcpm:disc:cap:${popupId}:${yyyymmdd}`,
  rate: (ip: string) => `gcpm:disc:rate:${ip}`,
  registry: () => `gcpm:disc:registry`,
  meta: (discountId: string) => `gcpm:disc:meta:${discountId}`,
  submission: (submissionId: string) => `gcpm:disc:sub:${submissionId}`,
};

// Keep discount state well past the code's expiry so the admin/API can still
// show what was issued for a lead (lead-recovery record).
const SUBMISSION_DISCOUNT_TTL_SECONDS = 120 * 24 * 60 * 60;

// sha256(lower-cased email) hex — used for idempotency/lock keys. The raw email
// is never used in a key or a discount title.
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function coerceJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

function utcDateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function secondsUntilUtcMidnight(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

// ---- Per-IP rate limit ----
export async function incrIpRate(ip: string): Promise<number> {
  const redis = getRedis();
  const key = discountKeys.rate(ip);
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, 3600);
  return n;
}

// ---- Email idempotency record ----
export async function getEmailRecord(
  popupId: string,
  hash: string,
): Promise<DiscountEmailRecord | null> {
  const redis = getRedis();
  return coerceJson<DiscountEmailRecord>(
    await redis.get(discountKeys.email(popupId, hash)),
  );
}

export async function saveEmailRecord(
  popupId: string,
  hash: string,
  record: DiscountEmailRecord,
  ttlSeconds: number,
): Promise<void> {
  const redis = getRedis();
  await redis.set(discountKeys.email(popupId, hash), record, {
    ex: Math.max(60, Math.floor(ttlSeconds)),
  });
}

// ---- Short lock to prevent a double-click race issuing two codes ----
export async function acquireLock(
  popupId: string,
  hash: string,
): Promise<boolean> {
  const redis = getRedis();
  const res = await redis.set(discountKeys.lock(popupId, hash), "1", {
    nx: true,
    ex: 15,
  });
  return res !== null && res !== undefined;
}

export async function releaseLock(popupId: string, hash: string): Promise<void> {
  const redis = getRedis();
  await redis.del(discountKeys.lock(popupId, hash));
}

// ---- Per-offer daily cap (UTC day) ----
export async function getCapCount(popupId: string): Promise<number> {
  const redis = getRedis();
  const v = await redis.get<number>(discountKeys.cap(popupId, utcDateStamp()));
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function incrCap(popupId: string): Promise<number> {
  const redis = getRedis();
  const key = discountKeys.cap(popupId, utcDateStamp());
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, secondsUntilUtcMidnight() + 3600);
  return n;
}

// ---- Registry of GCPM-created codes ----
export async function addToRegistry(
  discountId: string,
  meta: DiscountMeta,
  endsAtMs: number,
): Promise<void> {
  const redis = getRedis();
  await redis.zadd(discountKeys.registry(), {
    score: endsAtMs,
    member: discountId,
  });
  await redis.set(discountKeys.meta(discountId), meta);
}

export async function removeFromRegistry(discountId: string): Promise<void> {
  const redis = getRedis();
  await redis.zrem(discountKeys.registry(), discountId);
  await redis.del(discountKeys.meta(discountId));
}

// List registry entries, optionally filtered by popupId. Returns metadata only
// (code, popupId, endsAt) — never any email.
export async function listRegistryByPopup(
  popupId?: string,
): Promise<DiscountMeta[]> {
  const redis = getRedis();
  const ids = (await redis.zrange(discountKeys.registry(), 0, -1)) as string[];
  if (!ids || ids.length === 0) return [];
  const metas = await Promise.all(
    ids.map((id) => redis.get(discountKeys.meta(id))),
  );
  const out: DiscountMeta[] = [];
  for (const raw of metas) {
    const m = coerceJson<DiscountMeta>(raw);
    if (m && (!popupId || m.popupId === popupId)) out.push(m);
  }
  return out;
}

// ---- Per-submission discount state (overlaid on read; see lib/redis.ts) ----
export async function saveSubmissionDiscount(
  submissionId: string,
  state: SubmissionDiscountState,
): Promise<void> {
  const redis = getRedis();
  await redis.set(discountKeys.submission(submissionId), state, {
    ex: SUBMISSION_DISCOUNT_TTL_SECONDS,
  });
}

export async function getSubmissionDiscount(
  submissionId: string,
): Promise<SubmissionDiscountState | null> {
  const redis = getRedis();
  return coerceJson<SubmissionDiscountState>(
    await redis.get(discountKeys.submission(submissionId)),
  );
}

// Batch fetch via MGET — one round trip for many submissions, no per-item gets.
export async function getSubmissionDiscounts(
  submissionIds: string[],
): Promise<Map<string, SubmissionDiscountState>> {
  const out = new Map<string, SubmissionDiscountState>();
  if (submissionIds.length === 0) return out;
  const redis = getRedis();
  const keys = submissionIds.map((id) => discountKeys.submission(id));
  const values = (await redis.mget(...keys)) as unknown[];
  submissionIds.forEach((id, i) => {
    const state = coerceJson<SubmissionDiscountState>(values[i]);
    if (state) out.set(id, state);
  });
  return out;
}

// Registry entries whose endsAt score is <= cutoffMs, capped at `limit`,
// paired with their metadata (null when the meta hash is missing).
export async function registryEntriesUpTo(
  cutoffMs: number,
  limit: number,
): Promise<Array<{ discountId: string; meta: DiscountMeta | null }>> {
  const redis = getRedis();
  const ids = (await redis.zrange(discountKeys.registry(), 0, cutoffMs, {
    byScore: true,
  })) as string[];
  const slice = (ids || []).slice(0, limit);
  return Promise.all(
    slice.map(async (id) => ({
      discountId: id,
      meta: coerceJson<DiscountMeta>(await redis.get(discountKeys.meta(id))),
    })),
  );
}
