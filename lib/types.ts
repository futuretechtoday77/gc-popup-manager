export type FieldKey = 'firstName' | 'phone' | 'notes';

export type PopupTemplate = 'classic' | 'minimal' | 'slideup' | 'split';
export type PopupTriggerType = 'button' | 'delay' | 'exitIntent';
export interface PopupTrigger { type: PopupTriggerType; delaySeconds?: number; buttonSelector?: string; showOncePerSession: boolean; }

export interface PopupField {
  key: FieldKey;
  enabled: boolean;
  label: string;        // display label e.g. "First Name"
  placeholder: string;  // input placeholder
  required: boolean;
  order: number;        // 0-based sort order
}

export interface PopupStyle {
  primaryColor: string;  // card / modal background colour
  buttonColor: string;   // submit button background
  textColor: string;     // body + headline text
}

export interface Popup {
  id: string; // human-readable slug e.g. "rife-main-optin"
  name: string;
  site: string; // free-text brand label e.g. "rifecode"
  status: 'active' | 'inactive' | 'draft';
  template: PopupTemplate;
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  fields: PopupField[];
  trigger: PopupTrigger;
  gcTagId: string; // NEVER exposed publicly
  thankYouUrl: string;
  allowedDomains: string[]; // NEVER exposed publicly
  style: PopupStyle;
  createdAt: string;
  updatedAt: string;
}

// The canonical default fields array for a brand-new popup.
export const DEFAULT_FIELDS: PopupField[] = [
  { key: 'firstName', enabled: true,  label: 'First Name',  placeholder: 'Your first name',   required: false, order: 0 },
  { key: 'phone',     enabled: false, label: 'Phone',       placeholder: 'Your phone number', required: false, order: 1 },
  { key: 'notes',     enabled: false, label: 'Notes',       placeholder: 'Anything else?',    required: false, order: 2 },
];

export type SubmissionStatus =
  | 'queued'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'max_retries';

export interface Submission {
  id: string;
  popupId: string;
  email: string;
  firstName: string;
  phone: string;
  notes: string;
  // Arbitrary extra field values keyed by field key.
  extra?: Record<string, string>;
  sourceDomain: string;
  sourceUrl: string;
  userAgent: string;
  submittedAt: string;
  status: SubmissionStatus;
  retryCount: number;
  gcContactId: string | null;
  tagFired: boolean;
  processedAt: string | null;
  error: string | null;
}

// Only these fields are ever returned by the public config endpoint.
// gcTagId and allowedDomains are intentionally omitted.
export interface PublicPopupConfig {
  id: string;
  template: PopupTemplate;
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  fields: PopupField[];
  trigger: PopupTrigger;
  thankYouUrl: string;
  style: PopupStyle;
}
