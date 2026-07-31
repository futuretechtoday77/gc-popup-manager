import type { NextRequest } from 'next/server';
import { signAdminToken } from '@/lib/auth';
import { error, json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const password = typeof body.password === 'string' ? body.password : '';
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return error('Server not configured: ADMIN_PASSWORD missing', 500);
    if (!password || password !== expected) return error('Invalid password', 401);
    return json({ success: true, token: signAdminToken(), expiresIn: '12h' });
  } catch (err) {
    if (err instanceof SyntaxError) return error('Invalid JSON body', 400);
    return error('Internal server error', 500);
  }
}
