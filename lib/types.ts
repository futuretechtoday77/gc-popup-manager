export interface PopupFields {
  firstName: boolean;
  phone: boolean;
  notes: boolean;
}

export interface PopupStyle {
  primaryColor: string;
  buttonColor: string;
}

export interface Popup {
  id: string; // human-readable slug e.g. "rife-main-optin"
  name: string;
  site: string; // free-text brand label e.g. "rifecode"
  status: 'active' | 'inactive' | 'draft';
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  fields: PopupFields;
  gcTagId: string; // NEVER exposed publicly
  thankYouUrl: string;
  allowedDomains: string[]; // NEVER exposed publicly
  style: PopupStyle;
  createdAt: string;
  updatedAt: string;
}

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
export interface PublicPopupConfig {
  id: string;
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  fields: PopupFields;
  thankYouUrl: string;
  style: PopupStyle;
}
