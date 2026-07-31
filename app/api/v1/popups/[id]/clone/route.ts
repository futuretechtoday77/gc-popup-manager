import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { error, json, unauthorized } from '@/lib/http';
import { getPopup, savePopup } from '@/lib/redis';
import { nowIso } from '@/lib/id';
import { slugify } from '@/lib/validate';
import { DEFAULT_SUCCESS_TEXT, UNCATEGORIZED_FOLDER_ID } from '@/lib/types';
import { normalizeContentStyle, normalizeSuccessText } from '@/lib/popup-shape';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) return unauthorized();
  try {
    const source = await getPopup(params.id);
    if (!source) return error('Popup not found', 404);
    const baseId = slugify(`${source.id}-copy`) || 'popup-copy';
    let id = baseId;
    let n = 2;
    while (await getPopup(id)) id = `${baseId}-${n++}`;
    const now = nowIso();
    const popup = {
      id,
      name: `${source.name} (Copy)`,
      site: source.site,
      status: 'draft' as const,
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
      submissionSuccessText: normalizeSuccessText(source.submissionSuccessText, DEFAULT_SUCCESS_TEXT),
      thankYouUrl: source.thankYouUrl || '',
      allowedDomains: [...source.allowedDomains],
      style: { ...source.style },
      createdAt: now,
      updatedAt: now,
    };
    await savePopup(popup);
    return json({ success: true, popup }, 201);
  } catch {
    return error('Internal server error', 500);
  }
}
