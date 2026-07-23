import type { Popup, PopupFields, PopupStyle } from './types';
import { sanitize, slugify } from './validate';
import { nowIso } from './id';

function boolField(v: unknown, def = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return def;
}

function normFields(v: unknown): PopupFields {
  const f = (v || {}) as Record<string, unknown>;
  return {
    firstName: boolField(f.firstName, true),
    phone: boolField(f.phone, false),
    notes: boolField(f.notes, false),
  };
}

function normStyle(v: unknown): PopupStyle {
  const s = (v || {}) as Record<string, unknown>;
  return {
    primaryColor: sanitize(s.primaryColor, 32) || '#111827',
    buttonColor: sanitize(s.buttonColor, 32) || '#2563eb',
  };
}

function normStatus(v: unknown): Popup['status'] {
  const s = sanitize(v, 16);
  if (s === 'active' || s === 'inactive' || s === 'draft') return s;
  return 'draft';
}

function normDomains(v: unknown): string[] {
  let list: unknown[] = [];
  if (Array.isArray(v)) list = v;
  else if (typeof v === 'string') list = v.split(/[\n,]/);
  return list
    .map((d) => sanitize(d, 253).toLowerCase())
    .filter((d) => d.length > 0);
}

// Build a brand new popup from request input.
export function buildNewPopup(input: Record<string, unknown>): Popup {
  const now = nowIso();
  const name = sanitize(input.name, 200) || 'Untitled Popup';
  const rawId = sanitize(input.id, 64);
  const id = slugify(rawId || name) || `popup-${Date.now()}`;
  return {
    id,
    name,
    site: sanitize(input.site, 120),
    status: normStatus(input.status),
    headline: sanitize(input.headline, 300),
    subHeadline: sanitize(input.subHeadline, 300),
    bodyText: sanitize(input.bodyText, 2000),
    buttonText: sanitize(input.buttonText, 100) || 'Submit',
    imageUrl: sanitize(input.imageUrl, 2000),
    fields: normFields(input.fields),
    gcTagId: sanitize(input.gcTagId, 200),
    thankYouUrl: sanitize(input.thankYouUrl, 2000),
    allowedDomains: normDomains(input.allowedDomains),
    style: normStyle(input.style),
    createdAt: now,
    updatedAt: now,
  };
}

// Apply updates onto an existing popup. The id and createdAt are immutable.
export function applyPopupUpdate(
  existing: Popup,
  input: Record<string, unknown>,
): Popup {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  return {
    ...existing,
    name: has('name') ? sanitize(input.name, 200) || existing.name : existing.name,
    site: has('site') ? sanitize(input.site, 120) : existing.site,
    status: has('status') ? normStatus(input.status) : existing.status,
    headline: has('headline') ? sanitize(input.headline, 300) : existing.headline,
    subHeadline: has('subHeadline')
      ? sanitize(input.subHeadline, 300)
      : existing.subHeadline,
    bodyText: has('bodyText') ? sanitize(input.bodyText, 2000) : existing.bodyText,
    buttonText: has('buttonText')
      ? sanitize(input.buttonText, 100) || existing.buttonText
      : existing.buttonText,
    imageUrl: has('imageUrl') ? sanitize(input.imageUrl, 2000) : existing.imageUrl,
    fields: has('fields') ? normFields(input.fields) : existing.fields,
    gcTagId: has('gcTagId') ? sanitize(input.gcTagId, 200) : existing.gcTagId,
    thankYouUrl: has('thankYouUrl')
      ? sanitize(input.thankYouUrl, 2000)
      : existing.thankYouUrl,
    allowedDomains: has('allowedDomains')
      ? normDomains(input.allowedDomains)
      : existing.allowedDomains,
    style: has('style') ? normStyle(input.style) : existing.style,
    updatedAt: nowIso(),
  };
}
