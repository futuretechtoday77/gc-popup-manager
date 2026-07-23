import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getRedis, getSubmission, saveSubmission, enqueue, keys } from '@/lib/redis';
import { json, error, unauthorized } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/submissions/[id]/retry — re-queue a failed submission.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  const submission = await getSubmission(params.id);
  if (!submission) return error('Submission not found', 404);

  // Reset for a fresh attempt.
  submission.status = 'queued';
  submission.retryCount = 0;
  submission.error = null;
  submission.processedAt = null;
  await saveSubmission(submission);

  // Remove from the failed set and push back onto the queue.
  const redis = getRedis();
  await redis.srem(keys.queueFailed(), submission.id);
  await enqueue(submission.id);

  return json({ success: true, submission });
}
