import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { error, json, unauthorized } from '@/lib/http';
import { getPopup, savePopup } from '@/lib/redis';
import { applyPopupUpdate } from '@/lib/popup-shape';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  try {
    const popup = await getPopup(params.id);
    if (!popup) return error('Popup not found', 404);
    return json({ success: true, popup });
  } catch {
    return error('Internal server error', 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body', 400);
  }
  try {
    const existing = await getPopup(params.id);
    if (!existing) return error('Popup not found', 404);
    const popup = applyPopupUpdate(existing, body);
    await savePopup(popup);
    return json({ success: true, popup });
  } catch {
    return error('Internal server error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  try {
    const existing = await getPopup(params.id);
    if (!existing) return error('Popup not found', 404);
    await savePopup(applyPopupUpdate(existing, { status: 'inactive' }));
    return json({ success: true });
  } catch {
    return error('Internal server error', 500);
  }
}
