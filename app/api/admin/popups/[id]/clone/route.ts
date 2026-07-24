import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getPopup, savePopup } from "@/lib/redis";
import { nowIso } from "@/lib/id";
import { slugify } from "@/lib/validate";
import { json, error, unauthorized } from "@/lib/http";
import { UNCATEGORIZED_FOLDER_ID, DEFAULT_SUCCESS_TEXT } from "@/lib/types";
import { defaultContentStyle, normalizeContentStyle, normalizeSuccessText } from "@/lib/popup-shape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requireAdmin(req)) return unauthorized();
  const source = await getPopup(params.id);
  if (!source) return error("Popup not found", 404);
  const baseName = `${source.name} (Copy)`;
  const baseId = slugify(`${source.id}-copy`) || "popup-copy";
  let id = baseId;
  let n = 2;
  while (await getPopup(id)) id = `${baseId}-${n++}`;
  const now = nowIso();
  const clone = {
    id,
    name: baseName,
    site: source.site,
    status: "draft" as const,
    template: source.template,
    headline: source.headline,
    subHeadline: source.subHeadline,
    bodyText: source.bodyText,
    buttonText: source.buttonText,
    imageUrl: source.imageUrl,
    imageSettings: { ...source.imageSettings },
    folderId: source.folderId || UNCATEGORIZED_FOLDER_ID,
    buttonStyle: { ...source.buttonStyle },
    contentStyle: normalizeContentStyle(source.contentStyle),
    fields: source.fields.map((field) => ({ ...field })),
    trigger: { ...source.trigger },
    gcTagId: source.gcTagId,
    submissionSuccessText: normalizeSuccessText(
      source.submissionSuccessText,
      DEFAULT_SUCCESS_TEXT,
    ),
    thankYouUrl: source.thankYouUrl || "",
    allowedDomains: [...source.allowedDomains],
    style: { ...source.style },
    createdAt: now,
    updatedAt: now,
  };
  await savePopup(clone);
  return json({ success: true, popup: clone }, 201);
}
