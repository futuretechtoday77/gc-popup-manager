// The user-facing "name" field replaced the legacy "firstName" field. Old
// stored records may still carry the "firstName" key; those are migrated to
// "name" on read (see popup-shape.normFields / redis.migratePopupFields).
export type FieldKey = "name" | "phone" | "notes";

export type PopupTemplate = "classic" | "minimal" | "slideup" | "split";
export type PopupTriggerType = "button" | "delay" | "exitIntent";
export interface PopupTrigger {
  type: PopupTriggerType;
  delaySeconds?: number;
  buttonSelector?: string;
  showOncePerSession: boolean;
}

export interface PopupField {
  key: FieldKey;
  enabled: boolean;
  label: string; // display label e.g. "Name"
  placeholder: string; // input placeholder
  required: boolean;
  order: number; // 0-based sort order
}

export interface PopupImageSettings {
  fit: "cover" | "contain" | "fill";
  position: string;
  scale: number;
  desktopHeight: number;
  mobileHeight: number;
}

export interface PopupStyle {
  primaryColor: string; // card / modal background colour
  buttonColor: string; // submit button background
  textColor: string; // body + headline text
}

// Responsive typography for the popup's text blocks. Desktop values are used
// as-authored; the renderer clamps them to safe ranges on mobile.
export type ContentAlign = "left" | "center" | "right";

export interface ContentBlockStyle {
  align: ContentAlign;
  fontSize: number;
  fontWeight: number;
}

export interface PopupContentStyle {
  headline: ContentBlockStyle;
  subHeadline: ContentBlockStyle;
  bodyText: ContentBlockStyle;
  fontFamily: string; // safe web-font key, resolved to a stack by the renderer
}

export interface PopupButtonStyle {
  label: string;
  backgroundColor: string;
  textColor: string;
  hoverBackgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontSize: number;
  fontWeight: number;
  paddingX: number;
  paddingY: number;
  shadow: string;
  width: "auto" | "full";
  alignment: "left" | "center" | "right";
}

export interface PopupFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const UNCATEGORIZED_FOLDER_ID = "uncategorized";
export const UNCATEGORIZED_FOLDER_NAME = "Uncategorized";

export const DEFAULT_SUCCESS_TEXT = "Thanks! Your submission was received.";

export interface Popup {
  id: string; // human-readable slug e.g. "rife-main-optin"
  name: string;
  site: string; // free-text brand label e.g. "rifecode"
  status: "active" | "inactive" | "draft";
  template: PopupTemplate;
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  imageSettings: PopupImageSettings;
  contentStyle: PopupContentStyle;
  folderId: string;
  buttonStyle: PopupButtonStyle;
  fields: PopupField[];
  trigger: PopupTrigger;
  gcTagId: string; // NEVER exposed publicly
  // Shown in-popup after a successful submission (line breaks allowed).
  submissionSuccessText: string;
  // Legacy: kept only for backward compatibility / migration of old popups.
  thankYouUrl: string;
  allowedDomains: string[]; // NEVER exposed publicly
  style: PopupStyle;
  createdAt: string;
  updatedAt: string;
}

// The canonical default fields array for a brand-new popup.
export const DEFAULT_FIELDS: PopupField[] = [
  {
    key: "name",
    enabled: true,
    label: "Name",
    placeholder: "Your full name",
    required: false,
    order: 0,
  },
  {
    key: "phone",
    enabled: false,
    label: "Phone",
    placeholder: "Your phone number",
    required: false,
    order: 1,
  },
  {
    key: "notes",
    enabled: false,
    label: "Notes",
    placeholder: "Anything else?",
    required: false,
    order: 2,
  },
];

export type SubmissionStatus =
  "queued" | "processing" | "processed" | "failed" | "max_retries";

export interface Submission {
  id: string;
  popupId: string;
  email: string;
  // Stores the full name. Named `firstName` for storage/GC-shape compatibility
  // with existing records and the Global Control API.
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
  imageSettings: PopupImageSettings;
  contentStyle: PopupContentStyle;
  fields: PopupField[];
  trigger: PopupTrigger;
  submissionSuccessText: string;
  // Legacy redirect target; only present/used for old popups that set it.
  thankYouUrl: string;
  style: PopupStyle;
}
