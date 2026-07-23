import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getPopup } from '@/lib/redis';
import { publicOrigin, embedSnippet } from '@/lib/origin';
import { json, error, unauthorized } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/popups/[id]/embed — return the embed snippet.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  const popup = await getPopup(params.id);
  if (!popup) return error('Popup not found', 404);
  const origin = publicOrigin(req);
  return json({
    success: true,
    snippet: embedSnippet(origin, popup.id),
    scriptUrl: `${origin}/embed.js`,
    popupId: popup.id,
  });
}
