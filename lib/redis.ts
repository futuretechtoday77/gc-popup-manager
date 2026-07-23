import { Redis } from '@upstash/redis';
import type { Popup, Submission, PublicPopupConfig } from './types';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables',
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ---- Key helpers ----
export const keys = {
  popup: (id: string) => `popup:${id}`,
  popupsIndex: () => `popups:index`,
  popupSubmissions: (id: string) => `popup:${id}:submissions`,
  submission: (id: string) => `submission:${id}`,
  queuePending: () => `queue:pending`,
  queueFailed: () => `queue:failed`,
};

// The Upstash client auto-serializes/deserializes JSON. When a value was
// stored as an object it comes back as an object; guard for string too.
function coerce<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

// ---- Popup ops ----
export async function savePopup(popup: Popup): Promise<void> {
  const redis = getRedis();
  await redis.set(keys.popup(popup.id), popup);
  await redis.sadd(keys.popupsIndex(), popup.id);
}

export async function getPopup(id: string): Promise<Popup | null> {
  const redis = getRedis();
  return coerce<Popup>(await redis.get(keys.popup(id)));
}

export async function getAllPopupIds(): Promise<string[]> {
  const redis = getRedis();
  const ids = await redis.smembers(keys.popupsIndex());
  return (ids as string[]) ?? [];
}

export async function getAllPopups(): Promise<Popup[]> {
  const ids = await getAllPopupIds();
  const popups = await Promise.all(ids.map((id) => getPopup(id)));
  return popups.filter((p): p is Popup => p !== null);
}

export function toPublicConfig(popup: Popup): PublicPopupConfig {
  return {
    id: popup.id,
    headline: popup.headline,
    subHeadline: popup.subHeadline,
    bodyText: popup.bodyText,
    buttonText: popup.buttonText,
    imageUrl: popup.imageUrl,
    fields: popup.fields,
    thankYouUrl: popup.thankYouUrl,
    style: popup.style,
  };
}

// ---- Submission ops ----
export async function saveSubmission(sub: Submission): Promise<void> {
  const redis = getRedis();
  await redis.set(keys.submission(sub.id), sub);
  await redis.zadd(keys.popupSubmissions(sub.popupId), {
    score: new Date(sub.submittedAt).getTime(),
    member: sub.id,
  });
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const redis = getRedis();
  return coerce<Submission>(await redis.get(keys.submission(id)));
}

export async function getSubmissionIdsForPopup(
  popupId: string,
): Promise<string[]> {
  const redis = getRedis();
  // Newest first.
  const ids = await redis.zrange(keys.popupSubmissions(popupId), 0, -1, {
    rev: true,
  });
  return (ids as string[]) ?? [];
}

export async function getSubmissionsForPopup(
  popupId: string,
): Promise<Submission[]> {
  const ids = await getSubmissionIdsForPopup(popupId);
  const subs = await Promise.all(ids.map((id) => getSubmission(id)));
  return subs.filter((s): s is Submission => s !== null);
}

export async function countSubmissionsForPopup(
  popupId: string,
): Promise<number> {
  const redis = getRedis();
  return (await redis.zcard(keys.popupSubmissions(popupId))) ?? 0;
}

export async function getAllSubmissions(): Promise<Submission[]> {
  const popups = await getAllPopups();
  const lists = await Promise.all(
    popups.map((p) => getSubmissionsForPopup(p.id)),
  );
  const all = lists.flat();
  all.sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
  return all;
}

// ---- Queue ops ----
export async function enqueue(submissionId: string): Promise<void> {
  const redis = getRedis();
  await redis.rpush(keys.queuePending(), submissionId);
}

export async function queueDepth(): Promise<number> {
  const redis = getRedis();
  return (await redis.llen(keys.queuePending())) ?? 0;
}

export async function failedCount(): Promise<number> {
  const redis = getRedis();
  return (await redis.scard(keys.queueFailed())) ?? 0;
}
