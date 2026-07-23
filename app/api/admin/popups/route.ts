import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllPopups, savePopup, countSubmissionsForPopup } from '@/lib/redis';
import { getPopup } from '@/lib/redis';
import { buildNewPopup } from '@/lib/popup-shape';
import { json, error, unauthorized } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/popups — list all popups with submission counts.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  const popups = await getAllPopups();
  const withCounts = await Promise.all(
    popups.map(async (p) => ({
      ...p,
      submissionCount: await countSubmissionsForPopup(p.id),
    })),
  );
  withCounts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return json({ success: true, popups: withCounts });
}

// POST /api/admin/popups — create a popup.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body', 400);
  }
  const popup = buildNewPopup(body);
  const existing = await getPopup(popup.id);
  if (existing) {
    return error(`A popup with id "${popup.id}" already exists`, 409);
  }
  await savePopup(popup);
  return json({ success: true, popup }, 201);
}
