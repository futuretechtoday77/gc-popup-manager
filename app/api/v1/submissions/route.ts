import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { error, json, unauthorized } from '@/lib/http';
import { getAllSubmissions, getSubmissionsForPopup } from '@/lib/redis';
import type { Submission, SubmissionStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: SubmissionStatus[] = ['queued', 'processing', 'processed', 'failed', 'max_retries'];

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  const { searchParams } = req.nextUrl;
  const popupId = searchParams.get('popupId');
  const status = searchParams.get('status');
  const limitValue = searchParams.get('limit');
  if (status && !STATUSES.includes(status as SubmissionStatus)) return error('Invalid status', 400);
  const limit = limitValue === null ? null : Number(limitValue);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) return error('Invalid limit', 400);
  try {
    let submissions: Submission[] = popupId
      ? await getSubmissionsForPopup(popupId)
      : await getAllSubmissions();
    if (status) submissions = submissions.filter((submission) => submission.status === status);
    const total = submissions.length;
    if (limit !== null) submissions = submissions.slice(0, limit);
    return json({ success: true, submissions, total });
  } catch {
    return error('Internal server error', 500);
  }
}
