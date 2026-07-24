import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteFolderAndMovePopups, getFolder, saveFolder } from "@/lib/redis";
import { nowIso } from "@/lib/id";
import { sanitize } from "@/lib/validate";
import { json, error, unauthorized } from "@/lib/http";
import { UNCATEGORIZED_FOLDER_ID } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  if (params.id === UNCATEGORIZED_FOLDER_ID)
    return error("Uncategorized cannot be renamed", 400);
  const existing = await getFolder(params.id);
  if (!existing) return error("Folder not found", 404);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return error("Invalid JSON body", 400);
  }
  const name = sanitize(body.name, 100).trim();
  if (!name) return error("Folder name is required", 400);
  const folder = { ...existing, name, updatedAt: nowIso() };
  await saveFolder(folder);
  return json({ success: true, folder });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  if (params.id === UNCATEGORIZED_FOLDER_ID)
    return error("Uncategorized cannot be deleted", 400);
  const existing = await getFolder(params.id);
  if (!existing) return error("Folder not found", 404);
  await deleteFolderAndMovePopups(params.id);
  return json({ success: true });
}
