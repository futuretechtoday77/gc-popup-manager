// Global Control CRM client.
// Base URL and API key come from the environment. All calls tolerate the
// several response shapes the GC API is known to return.

export interface GCContact {
  id?: string | number;
  _id?: string | number;
  email?: string;
  firstName?: string;
  first_name?: string;
  name?: string;
  phone?: string;
  [key: string]: unknown;
}

function base(): string {
  const url = process.env.GC_API_URL;
  if (!url) throw new Error('Missing GC_API_URL environment variable');
  return url.replace(/\/+$/, '');
}

function headers(): Record<string, string> {
  const key = process.env.GC_API_KEY;
  if (!key) throw new Error('Missing GC_API_KEY environment variable');
  return {
    'X-API-KEY': key,
    'Content-Type': 'application/json',
  };
}

// Extract an array of contacts from any of the known response envelopes:
// { contacts: [...] }, { data: [...] }, { data: { contacts: [...] } }, or a
// bare array.
export function extractContacts(payload: unknown): GCContact[] {
  if (Array.isArray(payload)) return payload as GCContact[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.contacts)) return obj.contacts as GCContact[];
    if (Array.isArray(obj.data)) return obj.data as GCContact[];
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.contacts)) return inner.contacts as GCContact[];
      // Single contact under data.
      if (inner.id || inner._id || inner.email) return [inner as GCContact];
    }
    // Single contact at the top level.
    if (obj.id || obj._id || obj.email) return [obj as GCContact];
  }
  return [];
}

// Extract a single contact object from a create/update/get response.
export function extractContact(payload: unknown): GCContact | null {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return obj.data as GCContact;
    }
    if (obj.contact && typeof obj.contact === 'object') {
      return obj.contact as GCContact;
    }
    if (obj.id || obj._id || obj.email) return obj as GCContact;
  }
  const arr = extractContacts(payload);
  return arr.length > 0 ? arr[0] : null;
}

async function req(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const msg =
      parsed && typeof parsed === 'object'
        ? JSON.stringify(parsed)
        : String(parsed ?? res.statusText);
    throw new Error(`GC ${method} ${path} failed (${res.status}): ${msg}`);
  }
  return parsed;
}

export async function searchContactByEmail(
  email: string,
): Promise<GCContact | null> {
  const payload = await req(
    'GET',
    `/contacts?search=${encodeURIComponent(email)}`,
  );
  const contacts = extractContacts(payload);
  const lower = email.toLowerCase();
  const exact = contacts.find(
    (c) => (c.email || '').toLowerCase() === lower,
  );
  return exact ?? contacts[0] ?? null;
}

export async function getContactById(id: string): Promise<GCContact | null> {
  const payload = await req('GET', `/contacts/${encodeURIComponent(id)}`);
  return extractContact(payload);
}

export async function createContact(
  contact: Record<string, unknown>,
): Promise<GCContact | null> {
  const payload = await req('POST', `/contacts`, contact);
  return extractContact(payload);
}

export async function updateContact(
  id: string,
  contact: Record<string, unknown>,
): Promise<GCContact | null> {
  const payload = await req(
    'PUT',
    `/contacts/${encodeURIComponent(id)}`,
    contact,
  );
  return extractContact(payload);
}

export async function fireTag(
  tagId: string,
  email: string,
): Promise<void> {
  await req('POST', `/tags/fire-tag/${encodeURIComponent(tagId)}`, { email });
}

// Read firstName/phone from a contact regardless of field naming.
export function readName(contact: GCContact | null): string {
  if (!contact) return '';
  return String(contact.firstName || contact.first_name || contact.name || '');
}

// Read the full display name field specifically (distinct from firstName).
export function readDisplayName(contact: GCContact | null): string {
  if (!contact) return '';
  return String(contact.name || '');
}

export function readPhone(contact: GCContact | null): string {
  if (!contact) return '';
  return String(contact.phone || '');
}

// Identify a GC contact's id, accepting either `id` or `_id` (some GC API
// responses/versions use `_id`).
export function contactId(contact: GCContact | null): string | null {
  if (!contact) return null;
  const raw = contact.id ?? contact._id;
  if (raw === undefined || raw === null) return null;
  return String(raw);
}
