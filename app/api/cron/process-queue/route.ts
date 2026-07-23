import type { NextRequest } from 'next/server';
import {
  getRedis,
  getSubmission,
  saveSubmission,
  getPopup,
  keys,
} from '@/lib/redis';
import { json, error } from '@/lib/http';
import {
  searchContactByEmail,
  getContactById,
  createContact,
  updateContact,
  fireTag,
  readName,
  readPhone,
  contactId,
} from '@/lib/gc';
import { nowIso } from '@/lib/id';
import type { Submission } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Give the queue processor room to run through a batch with its delays.
export const maxDuration = 300;

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const POST_TAG_DELAY_MS = 2000;
const BETWEEN_SUBMISSIONS_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // If no secret is configured, allow (useful for local dev). In production
  // set CRON_SECRET so only Vercel Cron / authorized callers can trigger this.
  if (!secret) return true;
  const header = req.headers.get('authorization') || '';
  const bearer = header.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = req.headers.get('x-cron-secret') || '';
  const qsSecret = req.nextUrl.searchParams.get('secret') || '';
  return bearer === secret || headerSecret === secret || qsSecret === secret;
}

// Merge helper: never overwrite an existing non-empty value with an empty one.
function preferExisting(existing: string, incoming: string): string {
  const inc = (incoming || '').trim();
  const ex = (existing || '').trim();
  return inc.length > 0 ? inc : ex;
}

async function processOne(id: string): Promise<void> {
  const submission = await getSubmission(id);
  if (!submission) return;

  // a. Mark processing.
  submission.status = 'processing';
  await saveSubmission(submission);

  const popup = await getPopup(submission.popupId);
  if (!popup) {
    throw new Error(`Popup ${submission.popupId} no longer exists`);
  }

  // b. Search for an existing contact by email. extractContacts inside the
  //    client already handles data.contacts / data.data / data / bare-array.
  const existingContact = await searchContactByEmail(submission.email);

  // c. Merge: never overwrite existing name/phone with empty values.
  const mergedFirstName = preferExisting(
    readName(existingContact),
    submission.firstName,
  );
  const mergedPhone = preferExisting(
    readPhone(existingContact),
    submission.phone,
  );

  const contactPayload: Record<string, unknown> = {
    email: submission.email,
    firstName: mergedFirstName,
    phone: mergedPhone,
  };
  if (submission.notes) contactPayload.notes = submission.notes;

  // d. Create or update the GC contact.
  let gcId = contactId(existingContact);
  if (gcId) {
    await updateContact(gcId, contactPayload);
  } else {
    const created = await createContact(contactPayload);
    gcId = contactId(created);
  }

  // e. Fire the tag.
  await fireTag(popup.gcTagId, submission.email);
  submission.tagFired = true;

  // f. Wait — fire-tag may asynchronously wipe fields on the GC side.
  await sleep(POST_TAG_DELAY_MS);

  // g. Re-fetch the contact by id (fall back to email lookup if needed).
  let refetched = gcId ? await getContactById(gcId) : null;
  if (!refetched) {
    refetched = await searchContactByEmail(submission.email);
    if (!gcId) gcId = contactId(refetched);
  }

  // h. If name/phone are now missing, restore them via PUT.
  if (gcId) {
    const nameNow = readName(refetched);
    const phoneNow = readPhone(refetched);
    const needsNameRestore =
      mergedFirstName.trim().length > 0 && nameNow.trim().length === 0;
    const needsPhoneRestore =
      mergedPhone.trim().length > 0 && phoneNow.trim().length === 0;
    if (needsNameRestore || needsPhoneRestore) {
      await updateContact(gcId, {
        email: submission.email,
        firstName: preferExisting(nameNow, mergedFirstName),
        phone: preferExisting(phoneNow, mergedPhone),
      });
    }
  }

  // i. Mark processed.
  submission.gcContactId = gcId;
  submission.status = 'processed';
  submission.processedAt = nowIso();
  submission.error = null;
  await saveSubmission(submission);
}

async function handleFailure(id: string, err: unknown): Promise<void> {
  const redis = getRedis();
  const submission = await getSubmission(id);
  if (!submission) return;
  const message = err instanceof Error ? err.message : String(err);
  submission.retryCount = (submission.retryCount || 0) + 1;
  submission.error = message;

  if (submission.retryCount < MAX_RETRIES) {
    // Re-queue for another attempt.
    submission.status = 'queued';
    await saveSubmission(submission);
    await redis.rpush(keys.queuePending(), submission.id);
  } else {
    // Give up.
    submission.status = 'max_retries';
    await saveSubmission(submission);
    await redis.sadd(keys.queueFailed(), submission.id);
  }
}

async function runQueue(): Promise<{
  claimed: number;
  processed: number;
  failed: number;
}> {
  const redis = getRedis();

  // 1. LPOP up to BATCH_SIZE ids from queue:pending.
  const ids: string[] = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const id = (await redis.lpop(keys.queuePending())) as string | null;
    if (!id) break;
    ids.push(id);
  }

  let processed = 0;
  let failed = 0;

  // 2. Process each in order.
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      await processOne(id);
      processed++;
    } catch (err) {
      await handleFailure(id, err);
      failed++;
    }
    // 500ms between submissions.
    if (i < ids.length - 1) {
      await sleep(BETWEEN_SUBMISSIONS_MS);
    }
  }

  return { claimed: ids.length, processed, failed };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return error('Unauthorized', 401);
  const result = await runQueue();
  return json({ success: true, ...result });
}

// Vercel Cron issues GET requests; support both.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return error('Unauthorized', 401);
  const result = await runQueue();
  return json({ success: true, ...result });
}
