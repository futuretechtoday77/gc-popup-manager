import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllSubmissions, getSubmissionsForPopup } from '@/lib/redis';
import { json, unauthorized } from '@/lib/http';
import type { Submission, SubmissionStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: SubmissionStatus[] = [
  'queued',
  'processing',
  'processed',
  'failed',
  'max_retries',
];

// GET /api/admin/submissions?status=&popupId=&limit=
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  const { searchParams } = req.nextUrl;
  const popupId = searchParams.get('popupId');
  const statusParam = searchParams.get('status');
  const limitParam = searchParams.get('limit');

  let submissions: Submission[] = popupId
    ? await getSubmissionsForPopup(popupId)
    : await getAllSubmissions();

  if (statusParam && STATUSES.includes(statusParam as SubmissionStatus)) {
    submissions = submissions.filter((s) => s.status === statusParam);
  }

  if (limitParam) {
    const limit = parseInt(limitParam, 10);
    if (!Number.isNaN(limit) && limit > 0) {
      submissions = submissions.slice(0, limit);
    }
  }

  return json({ success: true, submissions, total: submissions.length });
}
