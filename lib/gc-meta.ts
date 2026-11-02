// Global Control custom fields ("meta") — merge rules.
//
// Verified against the live GC API on 2026-11-02 with a throwaway contact:
//   * A contact write that OMITS `meta` leaves the stored custom fields alone.
//   * A contact write that INCLUDES `meta` REPLACES THE WHOLE LIST: any custom
//     field not in the sent list is deleted (City, Discount Code, ...).
//   * fire-tag does not touch `meta`.
//
// So: send `meta` only when there is something to set, and when we do, send the
// complete existing list merged by key. If the existing list cannot be confirmed
// we send nothing, because a field we cannot confirm is a field we would delete.

import type { GCContact } from '@/lib/gc';

export interface GCMetaEntry {
  key: string;
  value: string;
}

// Returns the contact's custom fields, or null when they cannot be confirmed
// (contact exists but the response carried no usable `meta` array).
export function readMeta(contact: GCContact | null): GCMetaEntry[] | null {
  if (!contact) return []; // new contact: nothing stored, nothing to lose
  const raw = (contact as Record<string, unknown>).meta;
  if (!Array.isArray(raw)) return null;
  const out: GCMetaEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const key = (item as Record<string, unknown>).key;
    const value = (item as Record<string, unknown>).value;
    if (typeof key !== 'string' || !key) return null;
    out.push({ key, value: value == null ? '' : String(value) });
  }
  return out;
}

// First-touch merge for one field: an existing non-empty value is kept (the
// original referrer keeps the credit). Returns null when no write is needed.
export function mergeFirstTouch(
  existing: GCMetaEntry[],
  key: string,
  value: string,
): GCMetaEntry[] | null {
  const v = (value || '').trim();
  if (!v) return null;
  const current = existing.find((m) => m.key === key);
  if (current && current.value.trim()) return null; // already attributed
  const next = existing.filter((m) => m.key !== key);
  next.push({ key, value: v });
  return next;
}
