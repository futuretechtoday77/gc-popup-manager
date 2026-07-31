import type { NextRequest } from 'next/server';
import { json, error } from '@/lib/http';
import { runQueue } from '@/lib/queue-processor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get('authorization') || '';
  const bearer = header.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = req.headers.get('x-cron-secret') || '';
  const qsSecret = req.nextUrl.searchParams.get('secret') || '';
  return bearer === secret || headerSecret === secret || qsSecret === secret;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return error('Unauthorized', 401);
  return json({ success: true, ...(await runQueue()) });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return error('Unauthorized', 401);
  return json({ success: true, ...(await runQueue()) });
}
