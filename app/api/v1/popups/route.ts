import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { error, json, unauthorized } from '@/lib/http';
import { getAllPopups, getPopup, savePopup } from '@/lib/redis';
import { buildNewPopup } from '@/lib/popup-shape';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  try {
    const popups = await getAllPopups();
    return json({ success: true, popups, total: popups.length });
  } catch {
    return error('Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body', 400);
  }
  try {
    const popup = buildNewPopup(body);
    if (await getPopup(popup.id)) return error(`A popup with id "${popup.id}" already exists`, 409);
    await savePopup(popup);
    return json({ success: true, popup }, 201);
  } catch {
    return error('Internal server error', 500);
  }
}
