import type { NextRequest } from 'next/server';
import { getRedis } from '@/lib/redis';
import { json, unauthorized } from '@/lib/http';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UploadRecord {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

// GET /api/admin/uploads — list the last 100 uploaded images.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();

  const redis = getRedis();
  const raw = await redis.lrange('uploads:index', 0, 99);

  const uploads: UploadRecord[] = (raw as string[])
    .map((item) => {
      try {
        return typeof item === 'string'
          ? (JSON.parse(item) as UploadRecord)
          : (item as UploadRecord);
      } catch {
        return null;
      }
    })
    .filter((u): u is UploadRecord => u !== null);

  return json({ success: true, uploads });
}
