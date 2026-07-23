import type { NextRequest } from 'next/server';
import { getPopup, toPublicConfig } from '@/lib/redis';
import { withCors, corsPreflight, json, error } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const popup = await getPopup(params.id);
  if (!popup || popup.status !== 'active') {
    return withCors(error('Popup not found', 404));
  }
  // Only public display fields are ever returned here. gcTagId and
  // allowedDomains are intentionally omitted.
  return withCors(json(toPublicConfig(popup)));
}
