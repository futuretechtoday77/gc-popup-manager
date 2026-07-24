import type { NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { requireAdmin } from '@/lib/auth';
import { getRedis } from '@/lib/redis';
import { json, error, unauthorized } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

interface UploadRecord {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  usedBy: string[];
}

// POST /api/admin/upload — multipart/form-data with a single `file` field.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return error('Expected multipart/form-data body', 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return error('Missing `file` field', 400);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return error(
      `Unsupported file type "${file.type}". Allowed: jpeg, png, webp, gif.`,
      400,
    );
  }

  if (file.size > MAX_BYTES) {
    return json({ success: false, error: 'File exceeds 5 MB limit.' }, 413);
  }

  // Build a unique filename: timestamp + original name (sanitised).
  const ext = file.name.split('.').pop() ?? 'bin';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `uploads/${Date.now()}-${safeName}`;

  let blobUrl: string;
  try {
    const blob = await put(filename, file, { access: 'public' });
    blobUrl = blob.url;
  } catch (err) {
    console.error('[upload] Vercel Blob error', err);
    return error('Upload failed. Check BLOB_READ_WRITE_TOKEN.', 500);
  }

  const uploadedAt = new Date().toISOString();
  const record: UploadRecord = {
    url: blobUrl,
    filename,
    originalName: file.name,
    size: file.size,
    uploadedAt,
    usedBy: [],
  };

  try {
    const redis = getRedis();
    await redis.lpush('uploads:index', JSON.stringify(record));
  } catch (err) {
    // Log but don't fail the upload — the blob is already stored.
    console.error('[upload] Redis index error', err);
  }

  return json(
    {
      success: true,
      url: blobUrl,
      filename,
      size: file.size,
      uploadedAt,
    },
    201,
  );
}
