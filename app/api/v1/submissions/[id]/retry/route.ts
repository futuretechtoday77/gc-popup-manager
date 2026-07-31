import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { error, json, unauthorized } from '@/lib/http';
import { enqueue, getRedis, getSubmission, keys, saveSubmission } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  try {
    const submission = await getSubmission(params.id);
    if (!submission) return error('Submission not found', 404);
    submission.status = 'queued';
    submission.retryCount = 0;
    submission.error = null;
    submission.processedAt = null;
    await saveSubmission(submission);
    await getRedis().srem(keys.queueFailed(), submission.id);
    await enqueue(submission.id);
    return json({ success: true, submission });
  } catch {
    return error('Internal server error', 500);
  }
}
