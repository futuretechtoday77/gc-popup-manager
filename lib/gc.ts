// Global Control CRM client.
// Base URL and API key come from the environment. All calls tolerate the
// several response shapes the GC API is known to return.

export interface GCContact {
  id?: string | number;
  _id?: string | number;
  email?: string;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
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

function errorMessage(body: unknown, fallback: string): string {
  return body && typeof body === 'object'
    ? JSON.stringify(body)
    : String(body ?? fallback);
}

async function readJsonOrText(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function req(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const relayUrl = process.env.GC_RELAY_URL?.trim();
  const relaySecret = process.env.GC_RELAY_SECRET?.trim();

  if (relayUrl && relaySecret) {
    const relayPayload: Record<string, unknown> = { method, path };
    if (body !== undefined) relayPayload.body = body;

    const relayResponse = await fetch(relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Relay-Secret': relaySecret,
      },
      body: JSON.stringify(relayPayload),
      cache: 'no-store',
    });
    const relayResult = await readJsonOrText(relayResponse);
    const envelope =
      relayResult && typeof relayResult === 'object'
        ? (relayResult as { status?: unknown; body?: unknown })
        : null;
    const status =
      typeof envelope?.status === 'number' ? envelope.status : relayResponse.status;
    const responseBody = envelope?.body;

    if (!relayResponse.ok || status >= 400) {
      throw new Error(
        `GC ${method} ${path} failed (${status}): ${errorMessage(responseBody ?? relayResult, relayResponse.statusText)}`,
      );
    }
    return responseBody;
  }

  const res = await fetch(`${base()}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const parsed = await readJsonOrText(res);
  if (!res.ok) {
    throw new Error(
      `GC ${method} ${path} failed (${res.status}): ${errorMessage(parsed, res.statusText)}`,
    );
  }
  return parsed;
}

export async function searchContactByEmail(
  email: string,
): Promise<GCContact | null> {
  const payload = await req(
    'GET',
    `/contacts?search=${encodeURIComponent(email)}`,
    { email },
  );
  const contacts = extractContacts(payload);
  const lower = email.toLowerCase();
  const exact = contacts.find(
    (c) => (c.email || '').toLowerCase() === lower,
  );
  return exact ?? contacts[0] ?? null;
}

export async function getContactById(id: string): Promise<GCContact | null> {
  const payload = await req('GET', `/contacts/${encodeURIComponent(id)}`, {});
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

// Fire a tag, carrying the contact fields with it.
//
// CRITICAL: every Global Control write is a FULL-RECORD UPSERT -- any field the
// payload omits is DELETED. Firing with `{ email }` alone therefore wipes the
// contact's name and phone, synchronously, as part of this very call (verified
// 2026-10-06/07 against the live API). Passing the merged fields here is what
// prevents the wipe; it is not a redundant belt-and-braces measure.
//
// Callers must pass values they have positively confirmed. Never pass an empty
// string for a field that may hold data -- omit it instead, and only when the
// caller knows the stored value is genuinely empty.
export async function fireTag(
  tagId: string,
  email: string,
  fields?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  },
): Promise<void> {
  const payload: Record<string, unknown> = { email };
  if (fields) {
    if (fields.name) payload.name = fields.name;
    if (fields.firstName) payload.firstName = fields.firstName;
    if (fields.lastName) payload.lastName = fields.lastName;
    if (fields.phone) payload.phone = fields.phone;
  }
  await req('POST', `/tags/fire-tag/${encodeURIComponent(tagId)}`, payload);
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

// Read the separately-stored lastName. GC keeps firstName/lastName apart from the
// display `name`, and because writes are full-record upserts, omitting lastName
// DELETES it. Our forms only collect a single name string, so this is
// preserve-only: we never set it, we just avoid destroying it.
export function readLastName(contact: GCContact | null): string {
  if (!contact) return '';
  return String(contact.lastName || contact.last_name || '');
}

// Identify a GC contact's id, accepting either `id` or `_id` (some GC API
// responses/versions use `_id`).
export function contactId(contact: GCContact | null): string | null {
  if (!contact) return null;
  const raw = contact.id ?? contact._id;
  if (raw === undefined || raw === null) return null;
  return String(raw);
}
