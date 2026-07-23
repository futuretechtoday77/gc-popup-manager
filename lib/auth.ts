import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';

const DEFAULT_EXPIRY = '12h';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET environment variable');
  return secret;
}

export interface AdminTokenPayload {
  role: 'admin';
}

export function signAdminToken(): string {
  return jwt.sign({ role: 'admin' } satisfies AdminTokenPayload, getSecret(), {
    expiresIn: DEFAULT_EXPIRY,
  });
}

export function verifyToken(token: string): AdminTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret());
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      (decoded as AdminTokenPayload).role === 'admin'
    ) {
      return decoded as AdminTokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();
  // Fall back to an admin_token cookie so server components / same-origin
  // fetches can authenticate without manually setting the header.
  const cookie = req.cookies.get('admin_token');
  return cookie?.value ?? null;
}

// Returns the decoded payload when authorized, otherwise null.
export function requireAdmin(req: NextRequest): AdminTokenPayload | null {
  const token = extractBearer(req);
  if (!token) return null;
  return verifyToken(token);
}
