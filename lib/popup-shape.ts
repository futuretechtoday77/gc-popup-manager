import type {
  Popup,
  PopupField,
  PopupStyle,
  PopupTemplate,
  PopupTrigger,
  FieldKey,
} from './types';
import { DEFAULT_FIELDS } from './types';
import { sanitize, slugify } from './validate';
import { nowIso } from './id';

const FIELD_KEYS: FieldKey[] = ['firstName', 'phone', 'notes'];
const TEMPLATES: PopupTemplate[] = ['classic', 'minimal', 'slideup', 'split'];

const MAX_DELAY_SECONDS = 86400;
export function normalizeTrigger(v: unknown, popupId: string): PopupTrigger {
  const t = (v || {}) as Record<string, unknown>;
  const type = t.type === 'delay' || t.type === 'exitIntent' ? t.type : 'button';
  const n = Number(t.delaySeconds);
  return { type, delaySeconds: Number.isFinite(n) ? Math.max(1, Math.min(MAX_DELAY_SECONDS, Math.round(n))) : 30, buttonSelector: sanitize(t.buttonSelector, 500) || `[data-gc-popup-trigger="${popupId}"]`, showOncePerSession: boolField(t.showOncePerSession, true) };
}


function boolField(v: unknown, def = false): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return def;
}

function defaultFor(key: FieldKey): PopupField {
  const d = DEFAULT_FIELDS.find((f) => f.key === key);
  // DEFAULT_FIELDS always contains all three keys.
  return d ? { ...d } : { key, enabled: false, label: key, placeholder: '', required: false, order: 0 };
}

// Accept either the new ordered array shape or the legacy boolean map and
// always return a normalized, fully-populated ordered array of all three
// known field keys.
export function normFields(v: unknown): PopupField[] {
  // Legacy boolean map { firstName, phone, notes }.
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const map = v as Record<string, unknown>;
    const looksLegacy = FIELD_KEYS.some((k) => typeof map[k] === 'boolean');
    if (looksLegacy) {
      return FIELD_KEYS.map((key, i) => {
        const base = defaultFor(key);
        return { ...base, enabled: boolField(map[key], base.enabled), order: i };
      });
    }
  }

  const arr = Array.isArray(v) ? v : [];
  const byKey = new Map<FieldKey, PopupField>();
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const key = sanitize(r.key, 32) as FieldKey;
    if (!FIELD_KEYS.includes(key)) continue;
    const base = defaultFor(key);
    const orderNum = Number(r.order);
    byKey.set(key, {
      key,
      enabled: boolField(r.enabled, base.enabled),
      label: sanitize(r.label, 100) || base.label,
      placeholder: sanitize(r.placeholder, 200) || base.placeholder,
      required: boolField(r.required, base.required),
      order: Number.isFinite(orderNum) ? orderNum : base.order,
    });
  }

  // Ensure every known key exists (fill any that were missing from input).
  for (const key of FIELD_KEYS) {
    if (!byKey.has(key)) byKey.set(key, defaultFor(key));
  }

  const out = Array.from(byKey.values());
  // Sort by declared order, then re-normalize order to 0-based contiguous.
  out.sort((a, b) => a.order - b.order);
  out.forEach((f, i) => (f.order = i));
  return out;
}

function normTemplate(v: unknown): PopupTemplate {
  const s = sanitize(v, 16) as PopupTemplate;
  return TEMPLATES.includes(s) ? s : 'classic';
}

function normStyle(v: unknown): PopupStyle {
  const s = (v || {}) as Record<string, unknown>;
  return {
    primaryColor: sanitize(s.primaryColor, 32) || '#ffffff',
    buttonColor: sanitize(s.buttonColor, 32) || '#22c55e',
    textColor: sanitize(s.textColor, 32) || '#1a1a1a',
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
    template: normTemplate(input.template),
    headline: sanitize(input.headline, 300),
    subHeadline: sanitize(input.subHeadline, 300),
    bodyText: sanitize(input.bodyText, 2000),
    buttonText: sanitize(input.buttonText, 100) || 'Submit',
    imageUrl: sanitize(input.imageUrl, 2000),
    fields: normFields(input.fields),
    trigger: normalizeTrigger(input.trigger, id),
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
    template: has('template') ? normTemplate(input.template) : existing.template,
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
    trigger: has('trigger') ? normalizeTrigger(input.trigger, existing.id) : normalizeTrigger(existing.trigger, existing.id),
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
