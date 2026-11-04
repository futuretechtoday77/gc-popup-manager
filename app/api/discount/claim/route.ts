import type { NextRequest } from "next/server";
import { getPopup, getSubmission } from "@/lib/redis";
import { withCors, corsPreflight, json, error } from "@/lib/http";
import { sanitize, hostFrom, domainAllowed } from "@/lib/validate";
import { nowIso } from "@/lib/id";
import {
  shopifyConfigured,
  createDiscountCode,
  countCustomerOrders,
  generateCode,
  emailHash8,
} from "@/lib/shopify";
import {
  hashEmail,
  getEmailRecord,
  saveEmailRecord,
  acquireLock,
  releaseLock,
  getCapCount,
  incrCap,
  incrIpRate,
  addToRegistry,
  saveSubmissionDiscount,
} from "@/lib/discount";
import type { Submission } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SUBMISSION_AGE_MS = 15 * 60 * 1000;
const MAX_CLAIMS_PER_IP_PER_HOUR = 5;

export function OPTIONS() {
  return corsPreflight();
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "unknown";
}

// Append ?code= so the mini-store cart can read it.
// When the offer may replace a podcast/partner code, add `code_replace=1` so
// the mini-store cart lets this code win instead of protecting the partner code.
// `gcpm=1` marks this as OUR code rather than a partner referral, so the
// mini-store cart does not record a voucher in the visitor's 90-day referrer
// cookie (which Global Control then stores as their Referrer Code).
function appendCode(shopUrl: string, code: string, replace = false): string {
  try {
    const u = new URL(shopUrl);
    u.searchParams.set("code", code);
    u.searchParams.set("gcpm", "1");
    if (replace) u.searchParams.set("code_replace", "1");
    return u.toString();
  } catch {
    const sep = shopUrl.includes("?") ? "&" : "?";
    return (
      `${shopUrl}${sep}code=${encodeURIComponent(code)}&gcpm=1` +
      (replace ? "&code_replace=1" : "")
    );
  }
}

// Persist discount status to its own key only — NEVER the submission key
// (owned by the GC queue processor; a full-object write would race it).
async function markStatus(
  submissionId: string,
  status: NonNullable<Submission["discountStatus"]>,
): Promise<void> {
  try {
    await saveSubmissionDiscount(submissionId, { discountStatus: status });
  } catch (err) {
    console.error("[discount/claim] failed to persist status", err);
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return withCors(error("Invalid JSON body", 400));
  }

  const submissionId = sanitize(body.submissionId, 128);
  if (!submissionId) {
    return withCors(error("submissionId is required", 400));
  }

  // 1. Load submission; must exist and be < 15 minutes old. Email comes from
  //    the stored submission, never from the request.
  const submission = await getSubmission(submissionId);
  if (!submission) return withCors(error("Submission not found", 404));
  const submittedMs = new Date(submission.submittedAt).getTime();
  if (!Number.isFinite(submittedMs)) {
    return withCors(error("Submission not found", 404));
  }
  if (Date.now() - submittedMs > MAX_SUBMISSION_AGE_MS) {
    return withCors(error("Submission expired", 410));
  }

  // 2. Load its popup. If no enabled offer → disabled.
  const popup = await getPopup(submission.popupId);
  if (!popup) return withCors(error("Popup not found", 404));

  // Same Origin/Referer check as /api/submit.
  const originHost = hostFrom(req.headers.get("origin"));
  const refererHost = hostFrom(req.headers.get("referer"));
  if (popup.allowedDomains && popup.allowedDomains.length > 0) {
    const allowed =
      domainAllowed(originHost, popup.allowedDomains) ||
      domainAllowed(refererHost, popup.allowedDomains);
    if (!allowed) return withCors(error("Origin not allowed", 403));
  }

  const offer = popup.discountOffer;
  if (!offer || !offer.enabled) {
    await markStatus(submission.id, "disabled");
    return withCors(json({ status: "disabled" }));
  }

  const email = submission.email;
  const hash = hashEmail(email);

  // 3. Per-IP rate limit. When the IP can't be resolved, skip the limit
  //    rather than funnelling every such request into one shared bucket.
  const ip = clientIp(req);
  if (ip === "unknown") {
    console.warn("[discount/claim] client IP unknown; skipping per-IP rate limit");
  } else {
    const ipCount = await incrIpRate(ip);
    if (ipCount > MAX_CLAIMS_PER_IP_PER_HOUR) {
      return withCors(error("Too many requests", 429));
    }
  }

  // 4. Idempotency + one-per-email-per-offer. If a live record exists, return
  //    it as "existing".
  const existing = await getEmailRecord(popup.id, hash);
  if (existing && new Date(existing.endsAt).getTime() > Date.now()) {
    return withCors(
      json({
        status: "existing",
        code: existing.code,
        endsAt: existing.endsAt,
        shopUrl: appendCode(offer.shopUrl, existing.code, offer.replacesReferrerCode === true),
      }),
    );
  }

  // Short lock on this identity to prevent a double-click race.
  const locked = await acquireLock(popup.id, hash);
  if (!locked) {
    // A concurrent claim may have just written the record.
    const again = await getEmailRecord(popup.id, hash);
    if (again && new Date(again.endsAt).getTime() > Date.now()) {
      return withCors(
        json({
          status: "existing",
          code: again.code,
          endsAt: again.endsAt,
          shopUrl: appendCode(offer.shopUrl, again.code, offer.replacesReferrerCode === true),
        }),
      );
    }
    return withCors(error("Claim already in progress, please retry", 409));
  }

  try {
    // Shopify not configured → cannot issue; never 5xx to the embed.
    if (!shopifyConfigured()) {
      console.error("[discount/claim] Shopify not configured");
      await markStatus(submission.id, "failed");
      return withCors(json({ status: "failed" }));
    }

    // 5. Daily cap per offer (0 pauses the offer entirely).
    const capCount = await getCapCount(popup.id);
    if (offer.dailyCap === 0 || capCount >= offer.dailyCap) {
      await markStatus(submission.id, "capped");
      return withCors(json({ status: "capped" }));
    }

    // 6. First-order check (fail open). Skipped when the offer is open to
    //    anyone; offers saved before the setting existed default to first-order.
    const firstOrderOnly = offer.eligibility !== "anyone";
    const orders = firstOrderOnly ? await countCustomerOrders(email) : 0;
    if (orders === null) {
      console.warn(
        "[discount/claim] first-order check failed/timed out; failing open",
      );
    } else if (orders > 0) {
      await markStatus(submission.id, "not_eligible");
      return withCors(json({ status: "not_eligible" }));
    }

    // 7. Create the code (4s budget), with one collision retry.
    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() + offer.expiryDays * 24 * 60 * 60 * 1000,
    );
    const startsAtIso = startsAt.toISOString();
    const endsAtIso = endsAt.toISOString();
    const titleHash = emailHash8(email);

    let code = generateCode(offer.codePrefix);
    let result = await createDiscountCode({
      popupId: popup.id,
      emailHash: titleHash,
      code,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      offer,
    });
    if (!result.ok && result.collision) {
      code = generateCode(offer.codePrefix);
      result = await createDiscountCode({
        popupId: popup.id,
        emailHash: titleHash,
        code,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        offer,
      });
    }

    if (!result.ok || !result.discountId) {
      // 8. Any Shopify failure → failed, HTTP 200. Never block the opt-in.
      console.error("[discount/claim] create failed:", result.error);
      await markStatus(submission.id, "failed");
      return withCors(json({ status: "failed" }));
    }

    const discountId = result.discountId;

    // Persist the email record (TTL until endsAt + 1 day).
    const ttlSeconds =
      Math.ceil((endsAt.getTime() - Date.now()) / 1000) + 24 * 60 * 60;
    await saveEmailRecord(
      popup.id,
      hash,
      { code, endsAt: endsAtIso, discountId },
      ttlSeconds,
    );

    // Registry (so cleanup can safely find GCPM-created codes).
    await addToRegistry(
      discountId,
      { code, popupId: popup.id, endsAt: endsAtIso },
      endsAt.getTime(),
    );

    // Count toward the daily cap only on success.
    await incrCap(popup.id);

    // Record the issued discount in its own key (never the submission key).
    await saveSubmissionDiscount(submission.id, {
      discount: { code, endsAt: endsAtIso, discountId, issuedAt: nowIso() },
      discountStatus: "issued",
    });

    return withCors(
      json({
        status: "issued",
        code,
        endsAt: endsAtIso,
        shopUrl: appendCode(offer.shopUrl, code, offer.replacesReferrerCode === true),
      }),
    );
  } catch (err) {
    // Never 5xx to the embed for a Shopify problem; log server-side.
    console.error("[discount/claim] unexpected error", err);
    await markStatus(submission.id, "failed");
    return withCors(json({ status: "failed" }));
  } finally {
    await releaseLock(popup.id, hash);
  }
}
