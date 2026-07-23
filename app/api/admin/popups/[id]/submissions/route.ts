import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSubmissionsForPopup } from '@/lib/redis';
import { json, unauthorized } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/popups/[id]/submissions — submissions for one popup.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  const submissions = await getSubmissionsForPopup(params.id);
  return json({ success: true, submissions, total: submissions.length });
}
