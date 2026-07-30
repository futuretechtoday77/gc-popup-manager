import type { NextRequest } from "next/server";
import { getRedis, getSubmission, keys } from "@/lib/redis";
import { json, unauthorized } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const headerSecret = req.headers.get("x-cron-secret") || "";
  return bearer === secret || headerSecret === secret;
}

// Deletes only entries that are still queued/processing. Processed and failed
// submission history is retained, and no Global Control call is made.
export async function POST(req: NextRequest) {
  if (!authorized(req)) return unauthorized();

  const redis = getRedis();
  const pending = ((await redis.lrange(keys.queuePending(), 0, -1)) || []) as string[];
  const ids = [...new Set(pending)];
  await redis.del(keys.queuePending());

  let purged = 0;
  for (const id of ids) {
    const submission = await getSubmission(id);
    if (!submission || (submission.status !== "queued" && submission.status !== "processing")) continue;
    await redis.del(keys.submission(id));
    await redis.zrem(keys.popupSubmissions(submission.popupId), id);
    await redis.srem(keys.queueFailed(), id);
    purged++;
  }

  return json({ success: true, purged, queueEntriesRemoved: ids.length });
}
