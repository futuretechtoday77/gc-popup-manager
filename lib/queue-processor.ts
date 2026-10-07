import {
  getRedis,
  getSubmission,
  saveSubmission,
  getPopup,
  keys,
} from '@/lib/redis';
import {
  searchContactByEmail,
  getContactById,
  createContact,
  updateContact,
  fireTag,
  readName,
  readDisplayName,
  readPhone,
  readLastName,
  contactId,
} from '@/lib/gc';
import { nowIso } from '@/lib/id';
import type { Submission } from '@/lib/types';

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const POST_TAG_DELAY_MS = 5000;
const BETWEEN_SUBMISSIONS_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  //
  // CRITICAL: every GC write is a full-record upsert, so a field we cannot
  // confirm is a field we would DELETE. If this read throws (outage, 429, 502,
  // timeout) we must NOT fall through and write -- searchContactByEmail throws
  // on a non-OK response, and runQueue's catch requeues the submission, which is
  // exactly what we want. Never wrap this in a try/catch that yields null: a
  // silent null reads as "no existing contact" and the following write would
  // blank the stored name and phone.
  const existingContact = await searchContactByEmail(submission.email);

  // c. Merge: never overwrite existing name/phone with empty values.
  // Preserve the full display `name` field separately from `firstName`.
  const mergedFirstName = preferExisting(
    readName(existingContact),
    submission.firstName,
  );
  const mergedDisplayName = preferExisting(
    readDisplayName(existingContact),
    submission.firstName,
  );
  const mergedPhone = preferExisting(
    readPhone(existingContact),
    submission.phone,
  );
  // Our forms never collect a surname on its own, so lastName is preserve-only.
  // It still has to travel on every write, because an omitted field is deleted.
  const mergedLastName = readLastName(existingContact);

  // Send the full name as both `name` and `firstName` in the existing Global
  // Control shape. GC parses first/last from the full name; keeping firstName
  // preserves compatibility with the existing queue/CRM integration.
  const contactPayload: Record<string, unknown> = {
    email: submission.email,
    firstName: mergedFirstName,
    name: mergedDisplayName,
    phone: mergedPhone,
  };
  if (mergedLastName) contactPayload.lastName = mergedLastName;
  if (submission.notes) contactPayload.notes = submission.notes;

  // d. Create or update the GC contact.
  let gcId = contactId(existingContact);
  if (gcId) {
    await updateContact(gcId, contactPayload);
  } else {
    const created = await createContact(contactPayload);
    gcId = contactId(created);
  }

  // e. Fire the tag, CARRYING THE MERGED FIELDS.
  // Fire-tag is a full-record upsert like every other GC write: firing with the
  // email alone blanks name and phone as part of the call. Sending the merged
  // record here is the fix, and it removes the need for any restore afterwards.
  await fireTag(popup.gcTagId, submission.email, {
    name: mergedDisplayName,
    firstName: mergedFirstName,
    lastName: mergedLastName,
    phone: mergedPhone,
  });
  submission.tagFired = true;

  // f. Verify what actually landed. Nothing should need repairing now, but GC
  // changed its write semantics once without notice, so we check rather than
  // assume, and repair loudly if reality disagrees.
  await sleep(POST_TAG_DELAY_MS);

  let refetched = gcId ? await getContactById(gcId) : null;
  if (!refetched) {
    refetched = await searchContactByEmail(submission.email);
    if (!gcId) gcId = contactId(refetched);
  }

  if (gcId && refetched) {
    const landedName = readDisplayName(refetched).trim();
    const landedPhone = readPhone(refetched).trim();
    const wantName = mergedDisplayName.trim();
    const wantPhone = mergedPhone.trim();

    if (landedName !== wantName || landedPhone !== wantPhone) {
      console.error(
        `[gc] MISMATCH after tag fire for ${submission.email}: ` +
          `expected name="${wantName}" phone="${wantPhone}", ` +
          `got name="${landedName}" phone="${landedPhone}" -- rewriting full record`,
      );
      await updateContact(gcId, contactPayload);
    }
  } else if (gcId) {
    // Could not read the record back. Do not write blind -- a write built on an
    // unconfirmed state is how fields get blanked. Flag it and leave the data be.
    console.error(
      `[gc] post-tag verify read failed for ${submission.email}; ` +
        `skipping repair write rather than risk blanking fields`,
    );
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

export async function runQueue(): Promise<{
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
