import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getPopup, savePopup, countSubmissionsForPopup } from '@/lib/redis';
import { applyPopupUpdate } from '@/lib/popup-shape';
import { json, error, unauthorized } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/popups/[id] — full popup including gcTagId + allowedDomains.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  const popup = await getPopup(params.id);
  if (!popup) return error('Popup not found', 404);
  const submissionCount = await countSubmissionsForPopup(popup.id);
  return json({ success: true, popup: { ...popup, submissionCount } });
}

// PUT /api/admin/popups/[id] — update.
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  const existing = await getPopup(params.id);
  if (!existing) return error('Popup not found', 404);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body', 400);
  }
  const updated = applyPopupUpdate(existing, body);
  await savePopup(updated);
  return json({ success: true, popup: updated });
}

// DELETE /api/admin/popups/[id] — soft delete: set inactive.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  const existing = await getPopup(params.id);
  if (!existing) return error('Popup not found', 404);
  const updated = applyPopupUpdate(existing, { status: 'inactive' });
  await savePopup(updated);
  return json({ success: true, popup: updated });
}
