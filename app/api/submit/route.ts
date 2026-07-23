import type { NextRequest } from 'next/server';
import { getPopup, saveSubmission, enqueue } from '@/lib/redis';
import { withCors, corsPreflight, ok, error } from '@/lib/http';
import { isValidEmail, sanitize, hostFrom, domainAllowed } from '@/lib/validate';
import { newId, nowIso } from '@/lib/id';
import type { Submission } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflight();
}

// The submit endpoint must be fast (<50ms) and MUST NOT call Global Control.
// It validates, stores the submission as "queued", and pushes to the queue.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return withCors(error('Invalid JSON body', 400));
  }

  const popupId = sanitize(body.popupId, 128);
  const email = sanitize(body.email, 320).toLowerCase();

  // 2. Validate email + popupId present, email format valid.
  if (!popupId) return withCors(error('popupId is required', 400));
  if (!email) return withCors(error('email is required', 400));
  if (!isValidEmail(email)) return withCors(error('Invalid email address', 400));

  // 3. Load popup, confirm active.
  const popup = await getPopup(popupId);
  if (!popup || popup.status !== 'active') {
    return withCors(error('Popup not found or inactive', 404));
  }

  // 1. Check Origin/Referer against popup.allowedDomains.
  const originHost = hostFrom(req.headers.get('origin'));
  const refererHost = hostFrom(req.headers.get('referer'));
  const sourceHost = originHost || refererHost;
  if (popup.allowedDomains && popup.allowedDomains.length > 0) {
    const allowed =
      domainAllowed(originHost, popup.allowedDomains) ||
      domainAllowed(refererHost, popup.allowedDomains);
    if (!allowed) {
      return withCors(error('Origin not allowed', 403));
    }
  }

  // 4. Sanitize inputs.
  const submission: Submission = {
    id: newId(),
    popupId,
    email,
    firstName: sanitize(body.firstName, 200),
    phone: sanitize(body.phone, 60),
    notes: sanitize(body.notes, 2000),
    sourceDomain: sourceHost || '',
    sourceUrl: sanitize(req.headers.get('referer'), 2000),
    userAgent: sanitize(req.headers.get('user-agent'), 500),
    submittedAt: nowIso(),
    status: 'queued',
    retryCount: 0,
    gcContactId: null,
    tagFired: false,
    processedAt: null,
    error: null,
  };

  // 5. Store + enqueue.
  await saveSubmission(submission);
  await enqueue(submission.id);

  // 6. Return immediately. No Global Control call here.
  return withCors(ok({ submissionId: submission.id }));
}
