import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAllFolders, saveFolder } from "@/lib/redis";
import { newId, nowIso } from "@/lib/id";
import { sanitize, slugify } from "@/lib/validate";
import { json, error, unauthorized } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  return json({ success: true, folders: await getAllFolders() });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return error("Invalid JSON body", 400);
  }
  const name = sanitize(body.name, 100).trim();
  if (!name) return error("Folder name is required", 400);
  const now = nowIso();
  const folder = {
    id: `${slugify(name) || "folder"}-${newId().slice(0, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
  };
  await saveFolder(folder);
  return json({ success: true, folder }, 201);
}
