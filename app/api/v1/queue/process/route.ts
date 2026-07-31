import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { error, json, unauthorized } from '@/lib/http';
import { runQueue } from '@/lib/queue-processor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  try {
    return json({ success: true, ...(await runQueue()) });
  } catch {
    return error('Internal server error', 500);
  }
}
