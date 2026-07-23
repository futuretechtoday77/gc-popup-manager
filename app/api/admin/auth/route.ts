import type { NextRequest } from 'next/server';
import { signAdminToken } from '@/lib/auth';
import { json, error } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body', 400);
  }
  const password = typeof body.password === 'string' ? body.password : '';
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return error('Server not configured: ADMIN_PASSWORD missing', 500);
  }
  if (!password || password !== expected) {
    return error('Invalid password', 401);
  }
  const token = signAdminToken();
  return json({ success: true, token });
}
