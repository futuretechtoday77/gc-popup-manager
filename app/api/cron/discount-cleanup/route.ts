import type { NextRequest } from "next/server";
import { json, error } from "@/lib/http";
import {
  registryEntriesUpTo,
  removeFromRegistry,
} from "@/lib/discount";
import {
  shopifyConfigured,
  getDiscountTitle,
  deleteDiscount,
  GCPM_TITLE_PREFIX,
} from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_GRACE_DAYS = 30;
const MAX_PER_RUN = 50;

// Auth identical to the existing cron routes (see process-queue).
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = req.headers.get("x-cron-secret") || "";
  const qsSecret = req.nextUrl.searchParams.get("secret") || "";
  return bearer === secret || headerSecret === secret || qsSecret === secret;
}

interface CleanupCounts {
  scanned: number;
  deleted: number;
  gone: number; // no longer on Shopify → dropped from registry
  skipped: number; // title prefix did not match → left alone
  orphans: number; // registry entry without metadata → dropped
  errors: number;
  dryRun: boolean;
  graceDays: number;
  wouldDelete?: Array<{ discountId: string; code: string; popupId: string }>;
}

async function runCleanup(req: NextRequest): Promise<CleanupCounts> {
  const graceDaysParam = Number(req.nextUrl.searchParams.get("graceDays"));
  const graceDays =
    Number.isFinite(graceDaysParam) && graceDaysParam >= 0
      ? graceDaysParam
      : DEFAULT_GRACE_DAYS;
  const dryRun = ["1", "true", "yes"].includes(
    (req.nextUrl.searchParams.get("dryRun") || "").toLowerCase(),
  );

  const cutoffMs = Date.now() - graceDays * 24 * 60 * 60 * 1000;
  const entries = await registryEntriesUpTo(cutoffMs, MAX_PER_RUN);

  const counts: CleanupCounts = {
    scanned: entries.length,
    deleted: 0,
    gone: 0,
    skipped: 0,
    orphans: 0,
    errors: 0,
    dryRun,
    graceDays,
    wouldDelete: dryRun ? [] : undefined,
  };

  for (const entry of entries) {
    try {
      if (!entry.meta) {
        // Registry entry with no metadata hash — safe to drop our own record.
        if (!dryRun) await removeFromRegistry(entry.discountId);
        counts.orphans++;
        continue;
      }

      // Re-verify the title prefix on Shopify before any delete (rule 4).
      const info = await getDiscountTitle(entry.discountId);
      if (!info.exists) {
        // Shopify no longer has it; just drop from the registry.
        if (!dryRun) await removeFromRegistry(entry.discountId);
        counts.gone++;
        continue;
      }
      if (!info.title || !info.title.startsWith(GCPM_TITLE_PREFIX)) {
        // Not a GCPM-created code — never delete by pattern alone.
        counts.skipped++;
        continue;
      }

      if (dryRun) {
        counts.wouldDelete?.push({
          discountId: entry.discountId,
          code: entry.meta.code,
          popupId: entry.meta.popupId,
        });
        continue;
      }

      const del = await deleteDiscount(entry.discountId);
      if (del.ok) {
        await removeFromRegistry(entry.discountId);
        counts.deleted++;
      } else {
        console.error(
          "[discount-cleanup] delete failed",
          entry.discountId,
          del.error,
        );
        counts.errors++;
      }
    } catch (err) {
      console.error("[discount-cleanup] error on", entry.discountId, err);
      counts.errors++;
    }
  }

  return counts;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return error("Unauthorized", 401);
  if (!shopifyConfigured()) {
    return error("Shopify is not configured", 503);
  }
  try {
    return json({ success: true, ...(await runCleanup(req)) });
  } catch (err) {
    console.error("[discount-cleanup] run failed", err);
    return error("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
