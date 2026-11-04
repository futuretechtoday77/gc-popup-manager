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

// A Shopify discount offer attached to a popup. When enabled, a successful
// opt-in can claim a unique, single-use Shopify discount code via
// /api/discount/claim. Optional and fully back-compatible: popups without a
// discountOffer behave exactly as before and expose nothing new publicly.
export interface DiscountOffer {
  enabled: boolean;
  type: "percent" | "fixed";
  value: number; // percent 1-90, or dollars > 0
  appliesTo: "all" | "products" | "collections";
  // Shopify GIDs: products or variants
  // (gid://shopify/Product/.. or gid://shopify/ProductVariant/..).
  productIds: string[];
  collectionIds: string[]; // gid://shopify/Collection/..
  appliesOnEachItem: boolean; // fixed only
  minSubtotal: number | null; // dollars
  expiryDays: number; // default 7, 1-60
  codePrefix: string; // e.g. "LM-"
  combinesWithProduct: boolean; // default true (stacks with product discounts)
  // When true, this popup's code may REPLACE a podcast/partner code already in
  // the cart (the bigger discount wins; the referral is kept in the 90-day
  // referrer cookie and GC "Referrer Code"). Default false: the cart keeps the
  // partner code and says the new code needs its own order.
  replacesReferrerCode: boolean;
  dailyCap: number; // max codes per offer per UTC day, default 200; 0 = paused
  shopUrl: string; // brand site URL for the "Shop now" button
  // Shown in the thank-you step when no code could be issued (Shopify failure,
  // daily cap or an ineligible customer).
  errorText: string;
}

// Optional switchable SMS variant of the opt-in form. Email stays required in
// both forms: Global Control identifies every contact by email, so a phone-only
// opt-in could never be synced or texted through GC.
export type SmsFormMode = "email-first" | "sms-first";
export interface SmsFormSettings {
  enabled: boolean;
  mode: SmsFormMode;
  switchLabel: string;
  backLabel: string;
  phoneLabel: string;
  consentLabel: string;
}

export const DEFAULT_SMS_CONSENT =
  "Text me my discount code and occasional offers. Message frequency varies. Reply STOP to opt out.";

export const DEFAULT_DISCOUNT_ERROR_TEXT =
  "Thanks! We couldn't generate your code just now \u2014 our team will follow up shortly.";

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
  // Raw HTML/JS (script tags, img pixels) injected into the page after a
  // successful submission for ad conversion tracking. Not secret -- the
  // embed receives it to fire it in the visitor's browser.
  trackingScripts: string;
  // Legacy: kept only for backward compatibility / migration of old popups.
  thankYouUrl: string;
  allowedDomains: string[]; // NEVER exposed publicly
  style: PopupStyle;
  // Optional Shopify discount offer. Secrets (store creds) are never stored
  // here; this only describes the offer. NEVER exposed publicly except the
  // minimal { enabled, shopUrl } surfaced by toPublicConfig when enabled.
  discountOffer?: DiscountOffer;
  smsForm?: SmsFormSettings;
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
  // Referral attribution captured by the mini-store cart (90-day first-touch
  // cookie): the podcast/partner code the visitor arrived with, and an
  // Affiliatly affiliate id. Optional; written to GC custom field "Referrer
  // Code" by the queue processor when present.
  referrerCode?: string;
  referrerAff?: string;
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
  // Shopify discount issued for this submission, if any. Admin-only; never
  // returned by the public config endpoint.
  discount?: {
    code: string;
    endsAt: string;
    discountId: string;
    issuedAt: string;
  } | null;
  discountStatus?:
    | "issued"
    | "existing"
    | "not_eligible"
    | "failed"
    | "capped"
    | "disabled";
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
  // Raw HTML/JS fired after a successful submission (ad conversion pixels).
  trackingScripts: string;
  // Legacy redirect target; only present/used for old popups that set it.
  thankYouUrl: string;
  style: PopupStyle;
  // Minimal public hint that a discount offer is available. Present ONLY when
  // the popup has an enabled discountOffer. Never exposes value, IDs or caps.
  discount?: {
    enabled: true;
    shopUrl: string;
    errorText: string;
    replacesReferrerCode: boolean;
  };
  // Present ONLY when the popup enables the switchable SMS form. Labels only.
  smsForm?: {
    enabled: true;
    mode: SmsFormMode;
    switchLabel: string;
    backLabel: string;
    phoneLabel: string;
    consentLabel: string;
  };
}
