"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Popup,
  PopupField,
  PopupTemplate,
  FieldKey,
  PopupImageSettings,
  PopupContentStyle,
  ContentBlockStyle,
  PopupFolder,
  PopupButtonStyle,
} from "@/lib/types";
import {
  DEFAULT_DISCOUNT_ERROR_TEXT,
  DEFAULT_FIELDS,
  DEFAULT_SMS_CONSENT,
  DEFAULT_SUCCESS_TEXT,
  UNCATEGORIZED_FOLDER_ID,
} from "@/lib/types";
import type { DiscountOffer, SmsFormSettings } from "@/lib/types";
import {
  defaultButtonStyle,
  defaultContentStyle,
  defaultImageSettings,
  SAFE_FONT_FAMILIES,
} from "@/lib/popup-shape";
import PopupPreview from "@/components/PopupPreview";
import ImagePicker from "@/components/ImagePicker";

export interface PopupFormValue {
  id: string;
  name: string;
  site: string;
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
  trigger: {
    type: "button" | "delay" | "exitIntent";
    delaySeconds: number;
    buttonSelector: string;
    showOncePerSession: boolean;
  };
  gcTagId: string;
  submissionSuccessText: string;
  trackingScripts: string; // raw HTML/JS fired after a successful submission
  thankYouUrl: string; // legacy redirect, retained for old popups
  allowedDomains: string; // newline/comma separated in the form
  style: { primaryColor: string; buttonColor: string; textColor: string };
  discountOffer: DiscountOfferValue;
  smsForm: SmsFormValue;
}

// Form-shaped discount offer (kept as plain strings/numbers for controlled inputs).
interface DiscountOfferValue {
  enabled: boolean;
  type: "percent" | "fixed";
  value: string;
  appliesTo: "all" | "products" | "collections";
  productIds: string; // one GID per line
  collectionIds: string; // one GID per line
  appliesOnEachItem: boolean;
  minSubtotal: string;
  expiryDays: string;
  codePrefix: string;
  combinesWithProduct: boolean;
  replacesReferrerCode: boolean;
  dailyCap: string;
  shopUrl: string;
  errorText: string;
}

interface SmsFormValue {
  enabled: boolean;
  mode: "email-first" | "sms-first";
  switchLabel: string;
  backLabel: string;
  phoneLabel: string;
  consentLabel: string;
}

function emptyDiscountOffer(): DiscountOfferValue {
  return {
    enabled: false,
    type: "percent",
    value: "10",
    appliesTo: "all",
    productIds: "",
    collectionIds: "",
    appliesOnEachItem: false,
    minSubtotal: "",
    expiryDays: "7",
    codePrefix: "GC-",
    combinesWithProduct: true,
    replacesReferrerCode: false,
    dailyCap: "200",
    shopUrl: "",
    errorText: DEFAULT_DISCOUNT_ERROR_TEXT,
  };
}

function emptySmsForm(): SmsFormValue {
  return {
    enabled: false,
    mode: "email-first",
    switchLabel: "Prefer SMS?",
    backLabel: "Prefer email?",
    phoneLabel: "Mobile number",
    consentLabel: DEFAULT_SMS_CONSENT,
  };
}

function splitLines(s: string): string[] {
  return s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function cloneDefaults(): PopupField[] {
  return DEFAULT_FIELDS.map((f) => ({ ...f }));
}

export function emptyForm(): PopupFormValue {
  return {
    id: "",
    name: "",
    site: "",
    status: "draft",
    template: "classic",
    headline: "",
    subHeadline: "",
    bodyText: "",
    buttonText: "Submit",
    imageUrl: "",
    imageSettings: defaultImageSettings("classic"),
    contentStyle: defaultContentStyle(),
    folderId: UNCATEGORIZED_FOLDER_ID,
    buttonStyle: defaultButtonStyle(),
    fields: cloneDefaults(),
    trigger: {
      type: "button",
      delaySeconds: 30,
      buttonSelector: "",
      showOncePerSession: true,
    },
    gcTagId: "",
    submissionSuccessText: DEFAULT_SUCCESS_TEXT,
    trackingScripts: "",
    thankYouUrl: "",
    allowedDomains: "",
    style: {
      primaryColor: "#ffffff",
      buttonColor: "#22c55e",
      textColor: "#1a1a1a",
    },
    discountOffer: emptyDiscountOffer(),
    smsForm: emptySmsForm(),
  };
}

export function fromPopup(p: Popup): PopupFormValue {
  const fields = (Array.isArray(p.fields) ? p.fields : cloneDefaults())
    .map((f) => ({ ...f }))
    .sort((a, b) => a.order - b.order);
  return {
    id: p.id,
    name: p.name,
    site: p.site,
    status: p.status,
    template: p.template || "classic",
    headline: p.headline,
    subHeadline: p.subHeadline,
    bodyText: p.bodyText,
    buttonText: p.buttonText,
    imageUrl: p.imageUrl,
    imageSettings:
      p.imageSettings || defaultImageSettings(p.template || "classic"),
    contentStyle: p.contentStyle || defaultContentStyle(),
    folderId: p.folderId || UNCATEGORIZED_FOLDER_ID,
    buttonStyle: p.buttonStyle || defaultButtonStyle(),
    fields,
    trigger: {
      type: p.trigger?.type || "button",
      delaySeconds: p.trigger?.delaySeconds || 30,
      buttonSelector: p.trigger?.buttonSelector || "",
      showOncePerSession: p.trigger?.showOncePerSession !== false,
    },
    gcTagId: p.gcTagId,
    submissionSuccessText: p.submissionSuccessText || DEFAULT_SUCCESS_TEXT,
    trackingScripts: p.trackingScripts || "",
    thankYouUrl: p.thankYouUrl || "",
    allowedDomains: (p.allowedDomains || []).join("\n"),
    style: {
      primaryColor: p.style?.primaryColor || "#ffffff",
      buttonColor: p.style?.buttonColor || "#22c55e",
      textColor: p.style?.textColor || "#1a1a1a",
    },
    discountOffer: p.discountOffer
      ? {
          enabled: p.discountOffer.enabled,
          type: p.discountOffer.type,
          value: String(p.discountOffer.value),
          appliesTo: p.discountOffer.appliesTo,
          productIds: (p.discountOffer.productIds || []).join("\n"),
          collectionIds: (p.discountOffer.collectionIds || []).join("\n"),
          appliesOnEachItem: p.discountOffer.appliesOnEachItem,
          minSubtotal:
            p.discountOffer.minSubtotal == null
              ? ""
              : String(p.discountOffer.minSubtotal),
          expiryDays: String(p.discountOffer.expiryDays),
          codePrefix: p.discountOffer.codePrefix,
          combinesWithProduct: p.discountOffer.combinesWithProduct,
          replacesReferrerCode: p.discountOffer.replacesReferrerCode === true,
          dailyCap: String(p.discountOffer.dailyCap),
          shopUrl: p.discountOffer.shopUrl,
          errorText: p.discountOffer.errorText || DEFAULT_DISCOUNT_ERROR_TEXT,
        }
      : emptyDiscountOffer(),
    smsForm: p.smsForm
      ? {
          enabled: p.smsForm.enabled,
          mode: p.smsForm.mode,
          switchLabel: p.smsForm.switchLabel,
          backLabel: p.smsForm.backLabel,
          phoneLabel: p.smsForm.phoneLabel,
          consentLabel: p.smsForm.consentLabel,
        }
      : emptySmsForm(),
  };
}

// Convert the form value into an API payload (domains -> array, re-index order).
export function toPayload(v: PopupFormValue): Record<string, unknown> {
  const fields = v.fields.map((f, i) => ({ ...f, order: i }));
  const d = v.discountOffer;
  const discountOffer: DiscountOffer = {
    enabled: d.enabled,
    type: d.type,
    value: Number(d.value) || 0,
    appliesTo: d.appliesTo,
    productIds: splitLines(d.productIds),
    collectionIds: splitLines(d.collectionIds),
    appliesOnEachItem: d.appliesOnEachItem,
    minSubtotal:
      d.minSubtotal.trim() === "" ? null : Number(d.minSubtotal) || 0,
    expiryDays: Number(d.expiryDays) || 7,
    codePrefix: d.codePrefix.trim().toUpperCase(),
    combinesWithProduct: d.combinesWithProduct,
    replacesReferrerCode: d.replacesReferrerCode,
    dailyCap: d.dailyCap.trim() === "" ? 200 : Number(d.dailyCap) || 0,
    shopUrl: d.shopUrl.trim(),
    errorText: d.errorText.trim() || DEFAULT_DISCOUNT_ERROR_TEXT,
  };
  const smsForm: SmsFormSettings = {
    enabled: v.smsForm.enabled,
    mode: v.smsForm.mode,
    switchLabel: v.smsForm.switchLabel.trim() || "Prefer SMS?",
    backLabel: v.smsForm.backLabel.trim() || "Prefer email?",
    phoneLabel: v.smsForm.phoneLabel.trim() || "Mobile number",
    consentLabel: v.smsForm.consentLabel.trim() || DEFAULT_SMS_CONSENT,
  };
  return {
    ...v,
    fields,
    // Only send an offer when it is switched on; null clears a removed offer.
    discountOffer: discountOffer.enabled ? discountOffer : null,
    smsForm,
    allowedDomains: v.allowedDomains
      .split(/[\n,]/)
      .map((d) => d.trim())
      .filter(Boolean),
  };
}

const label = "block text-sm font-medium text-gray-700";
const input =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

const TEMPLATE_OPTIONS: {
  key: PopupTemplate;
  title: string;
  desc: string;
}[] = [
  { key: "classic", title: "Classic", desc: "Centered modal with image" },
  { key: "minimal", title: "Minimal", desc: "Text-only, no image" },
  {
    key: "slideup",
    title: "Slide-up (Mobile First)",
    desc: "Docks to the bottom",
  },
  {
    key: "split",
    title: "Split (Image + Form)",
    desc: "Image left, form right",
  },
];

function TemplateThumb({ kind }: { kind: PopupTemplate }) {
  // Simple CSS mockups of each layout.
  if (kind === "slideup") {
    return (
      <div className="relative h-16 w-full overflow-hidden rounded bg-gray-100">
        <div className="absolute inset-x-2 bottom-1 rounded bg-white p-1.5 shadow">
          <div className="mb-1 h-1.5 w-1/2 rounded bg-gray-400" />
          <div className="h-3 w-full rounded bg-blue-400" />
        </div>
      </div>
    );
  }
  if (kind === "minimal") {
    return (
      <div className="flex h-16 w-full items-center justify-center rounded bg-gray-100">
        <div className="w-3/4 rounded bg-white p-2 shadow">
          <div className="mx-auto mb-1 h-2 w-2/3 rounded bg-gray-500" />
          <div className="mx-auto mb-1.5 h-1 w-1/2 rounded bg-gray-300" />
          <div className="h-3 w-full rounded bg-blue-400" />
        </div>
      </div>
    );
  }
  if (kind === "split") {
    return (
      <div className="flex h-16 w-full overflow-hidden rounded bg-gray-100">
        <div className="w-5/12 bg-gray-400" />
        <div className="flex flex-1 flex-col justify-center bg-white p-1.5">
          <div className="mb-1 h-1.5 w-3/4 rounded bg-gray-400" />
          <div className="mb-1 h-1 w-full rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-blue-400" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-16 w-full items-center justify-center rounded bg-gray-100">
      <div className="w-3/4 overflow-hidden rounded bg-white shadow">
        <div className="h-4 w-full bg-gray-300" />
        <div className="p-1.5">
          <div className="mb-1 h-1.5 w-1/2 rounded bg-gray-400" />
          <div className="h-3 w-full rounded bg-blue-400" />
        </div>
      </div>
    </div>
  );
}

const FIELD_TITLES: Record<FieldKey, string> = {
  name: "Name",
  phone: "Phone",
  notes: "Notes",
};

export default function PopupForm({
  initial,
  isNew,
  onSubmit,
  submitting,
}: {
  initial: PopupFormValue;
  isNew: boolean;
  onSubmit: (v: PopupFormValue) => void;
  submitting: boolean;
}) {
  const [v, setV] = useState<PopupFormValue>(initial);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [folders, setFolders] = useState<PopupFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    fetch("/api/admin/folders")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.folders) setFolders(data.folders);
      })
      .catch(() => undefined);
  }, []);

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const response = await fetch("/api/admin/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.folder) {
      setFolders((previous) => [...previous, data.folder]);
      set("folderId", data.folder.id);
      setNewFolderName("");
    }
  }

  function setDiscount<K extends keyof DiscountOfferValue>(
    key: K,
    val: DiscountOfferValue[K],
  ) {
    setV((prev) => ({
      ...prev,
      discountOffer: { ...prev.discountOffer, [key]: val },
    }));
  }

  function setSms<K extends keyof SmsFormValue>(key: K, val: SmsFormValue[K]) {
    setV((prev) => ({ ...prev, smsForm: { ...prev.smsForm, [key]: val } }));
  }

  function set<K extends keyof PopupFormValue>(key: K, val: PopupFormValue[K]) {
    setV((prev) => ({ ...prev, [key]: val }));
  }

  function selectTemplate(template: PopupTemplate) {
    setV((prev) => {
      const oldDefault = defaultImageSettings(prev.template);
      const usesOldDefaultHeight =
        prev.imageSettings.desktopHeight === oldDefault.desktopHeight;
      return {
        ...prev,
        template,
        imageSettings: usesOldDefaultHeight
          ? {
              ...prev.imageSettings,
              desktopHeight: defaultImageSettings(template).desktopHeight,
            }
          : prev.imageSettings,
      };
    });
  }

  function setField(idx: number, patch: Partial<PopupField>) {
    setV((prev) => {
      const fields = prev.fields.map((f, i) =>
        i === idx ? { ...f, ...patch } : f,
      );
      return { ...prev, fields };
    });
  }

  function setContentBlock(
    block: "headline" | "subHeadline" | "bodyText",
    patch: Partial<ContentBlockStyle>,
  ) {
    setV((prev) => ({
      ...prev,
      contentStyle: {
        ...prev.contentStyle,
        [block]: { ...prev.contentStyle[block], ...patch },
      },
    }));
  }

  function move(idx: number, dir: -1 | 1) {
    setV((prev) => {
      const fields = prev.fields.slice();
      const target = idx + dir;
      if (target < 0 || target >= fields.length) return prev;
      const tmp = fields[idx];
      fields[idx] = fields[target];
      fields[target] = tmp;
      fields.forEach((f, i) => (f.order = i));
      return { ...prev, fields };
    });
  }

  const previewData = useMemo(
    () => ({
      id: v.id || "preview",
      template: v.template,
      headline: v.headline,
      subHeadline: v.subHeadline,
      bodyText: v.bodyText,
      buttonText: v.buttonText,
      imageUrl: v.imageUrl,
      imageSettings: v.imageSettings,
      contentStyle: v.contentStyle,
      folderId: v.folderId,
      fields: v.fields.map((f, i) => ({ ...f, order: i })),
      style: v.style,
      smsForm: v.smsForm,
      showDiscountPreview: v.discountOffer.enabled,
    }),
    [v],
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)]">
        {/* ---------- LEFT: editor ---------- */}
        <div className="min-w-0 space-y-6">
          {/* Template picker */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">Template</h2>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATE_OPTIONS.map((t) => {
                const selected = v.template === t.key;
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => selectTemplate(t.key)}
                    className={
                      "rounded-lg border-2 p-2 text-left transition " +
                      (selected
                        ? "border-blue-500 ring-1 ring-blue-500"
                        : "border-gray-200 hover:border-gray-300")
                    }
                  >
                    <TemplateThumb kind={t.key} />
                    <div className="mt-2 text-sm font-semibold text-gray-900">
                      {t.title}
                    </div>
                    <div className="text-xs text-gray-500">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Content */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">Content</h2>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={label}>Name</label>
                  <input
                    className={input}
                    value={v.name}
                    onChange={(e) => set("name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={label}>
                    Slug / ID{" "}
                    {isNew && <span className="text-gray-400">(optional)</span>}
                  </label>
                  <input
                    className={input}
                    value={v.id}
                    onChange={(e) => set("id", e.target.value)}
                    placeholder="rife-main-optin"
                    disabled={!isNew}
                  />
                </div>
              </div>
              <div>
                <label className={label}>Site / brand label</label>
                <input
                  className={input}
                  value={v.site}
                  onChange={(e) => set("site", e.target.value)}
                  placeholder="rifecode"
                />
              </div>
              <div>
                <label className={label}>Headline</label>
                <input
                  className={input}
                  value={v.headline}
                  onChange={(e) => set("headline", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Sub-headline</label>
                <input
                  className={input}
                  value={v.subHeadline}
                  onChange={(e) => set("subHeadline", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Body text</label>
                <textarea
                  className={input}
                  rows={3}
                  value={v.bodyText}
                  onChange={(e) => set("bodyText", e.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={label}>Button text</label>
                  <input
                    className={input}
                    value={v.buttonText}
                    onChange={(e) => set("buttonText", e.target.value)}
                  />
                </div>
                <div>
                  <label className={label}>
                    Image{" "}
                    <span className="text-gray-400">(not used in Minimal)</span>
                  </label>
                  <ImagePicker
                    value={v.imageUrl}
                    onChange={(url) => set("imageUrl", url)}
                  />
                  {v.template !== "minimal" && (
                    <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-gray-700">
                          Image framing
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            set(
                              "imageSettings",
                              defaultImageSettings(v.template),
                            )
                          }
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          Reset image settings
                        </button>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">
                          Fit
                        </label>
                        <select
                          className={input + " mt-1"}
                          value={v.imageSettings.fit}
                          onChange={(e) =>
                            set("imageSettings", {
                              ...v.imageSettings,
                              fit: e.target.value as PopupImageSettings["fit"],
                            })
                          }
                        >
                          <option value="cover">Crop to frame</option>
                          <option value="contain">Show whole image</option>
                          <option value="fill">Stretch</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">
                          Position
                        </label>
                        <select
                          className={input + " mt-1"}
                          value={v.imageSettings.position}
                          onChange={(e) =>
                            set("imageSettings", {
                              ...v.imageSettings,
                              position: e.target.value,
                            })
                          }
                        >
                          <option value="center center">Center</option>
                          <option value="center top">Top</option>
                          <option value="center bottom">Bottom</option>
                          <option value="left center">Left</option>
                          <option value="right center">Right</option>
                        </select>
                      </div>
                      <ImageRange
                        label="Scale"
                        value={v.imageSettings.scale}
                        min={50}
                        max={150}
                        suffix="%"
                        onChange={(scale) =>
                          set("imageSettings", { ...v.imageSettings, scale })
                        }
                      />
                      <ImageRange
                        label="Desktop image height"
                        value={v.imageSettings.desktopHeight}
                        min={100}
                        max={360}
                        suffix="px"
                        onChange={(desktopHeight) =>
                          set("imageSettings", {
                            ...v.imageSettings,
                            desktopHeight,
                          })
                        }
                      />
                      <ImageRange
                        label="Mobile image height"
                        value={v.imageSettings.mobileHeight}
                        min={100}
                        max={260}
                        suffix="px"
                        onChange={(mobileHeight) =>
                          set("imageSettings", {
                            ...v.imageSettings,
                            mobileHeight,
                          })
                        }
                      />
                      {v.template === "split" && (
                        <p className="text-xs text-gray-500">
                          Split hides the image on mobile by design.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={label}>Folder</label>
                <div className="mt-1 flex gap-2">
                  <select
                    className={input + " mt-0"}
                    value={v.folderId}
                    onChange={(e) => set("folderId", e.target.value)}
                  >
                    {(folders.length
                      ? folders
                      : [
                          {
                            id: UNCATEGORIZED_FOLDER_ID,
                            name: "Uncategorized",
                          } as PopupFolder,
                        ]
                    ).map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={input + " mt-0 max-w-[180px]"}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder"
                  />
                  <button
                    type="button"
                    onClick={createFolder}
                    className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Create
                  </button>
                </div>
              </div>
              <div>
                <label className={label}>Submission Successful Text</label>
                <textarea
                  className={input}
                  rows={2}
                  value={v.submissionSuccessText}
                  onChange={(e) =>
                    set("submissionSuccessText", e.target.value)
                  }
                  placeholder={DEFAULT_SUCCESS_TEXT}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Shown inside the popup after a successful submission. Line
                  breaks are allowed; the popup no longer redirects to a
                  thank-you page.
                </p>
              </div>
              <div>
                <label className={label}>Tracking Scripts</label>
                <textarea
                  className={input}
                  rows={6}
                  value={v.trackingScripts}
                  onChange={(e) => set("trackingScripts", e.target.value)}
                  placeholder={"<!-- e.g. Meta pixel snippet -->"}
                  spellCheck={false}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Raw HTML/JS (script tags, img pixels, etc.) injected into
                  the page after a successful submission. Use for ad
                  conversion tracking.
                </p>
              </div>
            </div>
          </section>

          {/* Discount offer */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={v.discountOffer.enabled}
                onClick={() => setDiscount("enabled", !v.discountOffer.enabled)}
                className={
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition " +
                  (v.discountOffer.enabled ? "bg-blue-600" : "bg-gray-300")
                }
              >
                <span
                  className={
                    "inline-block h-4 w-4 transform rounded-full bg-white transition " +
                    (v.discountOffer.enabled
                      ? "translate-x-4"
                      : "translate-x-0.5")
                  }
                />
              </button>
              <h2 className="font-semibold text-gray-900">Discount offer</h2>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              When a visitor opts in, a unique single-use Shopify code is
              created. The thank-you step shows the code and a Shop now button.
            </p>

            {v.discountOffer.enabled && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className={label}>Type</label>
                    <select
                      className={input}
                      value={v.discountOffer.type}
                      onChange={(e) =>
                        setDiscount(
                          "type",
                          e.target.value === "fixed" ? "fixed" : "percent",
                        )
                      }
                    >
                      <option value="percent">Percent off</option>
                      <option value="fixed">Fixed amount off</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>
                      {v.discountOffer.type === "percent"
                        ? "Percent (1-90)"
                        : "Amount in USD"}
                    </label>
                    <input
                      className={input}
                      value={v.discountOffer.value}
                      onChange={(e) => setDiscount("value", e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label className={label}>Expires after (days)</label>
                    <input
                      className={input}
                      value={v.discountOffer.expiryDays}
                      onChange={(e) => setDiscount("expiryDays", e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className={label}>Applies to</label>
                    <select
                      className={input}
                      value={v.discountOffer.appliesTo}
                      onChange={(e) =>
                        setDiscount(
                          "appliesTo",
                          e.target.value === "products"
                            ? "products"
                            : e.target.value === "collections"
                              ? "collections"
                              : "all",
                        )
                      }
                    >
                      <option value="all">Whole order</option>
                      <option value="products">Specific products</option>
                      <option value="collections">Specific collections</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Code prefix</label>
                    <input
                      className={input}
                      value={v.discountOffer.codePrefix}
                      onChange={(e) => setDiscount("codePrefix", e.target.value)}
                      placeholder="LM-"
                    />
                  </div>
                  <div>
                    <label className={label}>Minimum order (USD, blank = none)</label>
                    <input
                      className={input}
                      value={v.discountOffer.minSubtotal}
                      onChange={(e) => setDiscount("minSubtotal", e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                </div>

                {v.discountOffer.appliesTo === "products" && (
                  <div>
                    <label className={label}>
                      Shopify product / variant IDs (one per line)
                    </label>
                    <textarea
                      className={input + " min-h-24 font-mono text-xs"}
                      value={v.discountOffer.productIds}
                      onChange={(e) => setDiscount("productIds", e.target.value)}
                      placeholder="gid://shopify/Product/1234567890"
                      spellCheck={false}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Product or variant GIDs from Shopify.
                    </p>
                  </div>
                )}

                {v.discountOffer.appliesTo === "collections" && (
                  <div>
                    <label className={label}>
                      Shopify collection IDs (one per line)
                    </label>
                    <textarea
                      className={input + " min-h-24 font-mono text-xs"}
                      value={v.discountOffer.collectionIds}
                      onChange={(e) =>
                        setDiscount("collectionIds", e.target.value)
                      }
                      placeholder="gid://shopify/Collection/1234567890"
                      spellCheck={false}
                    />
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={label}>Shop link (Shop now button)</label>
                    <input
                      className={input}
                      value={v.discountOffer.shopUrl}
                      onChange={(e) => setDiscount("shopUrl", e.target.value)}
                      placeholder="https://livemineral.com/shop/"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The visitor&apos;s code is appended as ?code=, which the
                      mini-store cart applies automatically.
                    </p>
                  </div>
                  <div>
                    <label className={label}>Daily cap (0 pauses the offer)</label>
                    <input
                      className={input}
                      value={v.discountOffer.dailyCap}
                      onChange={(e) => setDiscount("dailyCap", e.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                </div>

                <div>
                  <label className={label}>
                    Message when no code can be issued
                  </label>
                  <textarea
                    className={input + " min-h-20"}
                    value={v.discountOffer.errorText}
                    onChange={(e) => setDiscount("errorText", e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-6 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={v.discountOffer.combinesWithProduct}
                      onChange={(e) =>
                        setDiscount("combinesWithProduct", e.target.checked)
                      }
                    />
                    Combines with other product discounts (e.g. podcast codes)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={v.discountOffer.replacesReferrerCode}
                      onChange={(e) =>
                        setDiscount("replacesReferrerCode", e.target.checked)
                      }
                    />
                    May replace a podcast code already in the cart (the
                    referral is still recorded)
                  </label>
                  {v.discountOffer.type === "fixed" && (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={v.discountOffer.appliesOnEachItem}
                        onChange={(e) =>
                          setDiscount("appliesOnEachItem", e.target.checked)
                        }
                      />
                      Apply the amount to each item
                    </label>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Fields */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-900">Fields</h2>
            <p className="mb-4 text-sm text-gray-500">
              Email is always collected and shown first. Toggle, rename and
              reorder the rest.
            </p>

            {/* Locked email row */}
            <div className="mb-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
              <span className="inline-block h-4 w-8 rounded-full bg-gray-300" />
              <span className="font-medium">Email</span>
              <span className="ml-auto text-xs uppercase tracking-wide">
                Always on · first
              </span>
            </div>

            <div className="space-y-3">
              {v.fields.map((f, idx) => (
                <div
                  key={f.key}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={f.enabled}
                      onClick={() => setField(idx, { enabled: !f.enabled })}
                      className={
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition " +
                        (f.enabled ? "bg-blue-600" : "bg-gray-300")
                      }
                    >
                      <span
                        className={
                          "inline-block h-4 w-4 transform rounded-full bg-white transition " +
                          (f.enabled ? "translate-x-4" : "translate-x-0.5")
                        }
                      />
                    </button>
                    <span className="text-sm font-semibold text-gray-900">
                      {FIELD_TITLES[f.key]}
                    </span>

                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={idx === 0}
                        onClick={() => move(idx, -1)}
                        className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={idx === v.fields.length - 1}
                        onClick={() => move(idx, 1)}
                        className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  </div>

                  {f.enabled && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Label
                        </label>
                        <input
                          className={input}
                          value={f.label}
                          onChange={(e) =>
                            setField(idx, { label: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">
                          Placeholder
                        </label>
                        <input
                          className={input}
                          value={f.placeholder}
                          onChange={(e) =>
                            setField(idx, { placeholder: e.target.value })
                          }
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) =>
                            setField(idx, { required: e.target.checked })
                          }
                        />
                        Required
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* SMS option */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={v.smsForm.enabled}
                onClick={() => setSms("enabled", !v.smsForm.enabled)}
                className={
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition " +
                  (v.smsForm.enabled ? "bg-blue-600" : "bg-gray-300")
                }
              >
                <span
                  className={
                    "inline-block h-4 w-4 transform rounded-full bg-white transition " +
                    (v.smsForm.enabled ? "translate-x-4" : "translate-x-0.5")
                  }
                />
              </button>
              <h2 className="font-semibold text-gray-900">SMS option</h2>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Adds a switch to a phone form. Email is still collected in both
              forms, because Global Control identifies every contact by email
              address; a phone-only opt-in could not be synced or texted.
            </p>

            {v.smsForm.enabled && (
              <div className="space-y-4">
                <div>
                  <label className={label}>Which form leads</label>
                  <select
                    className={input}
                    value={v.smsForm.mode}
                    onChange={(e) =>
                      setSms(
                        "mode",
                        e.target.value === "sms-first" ? "sms-first" : "email-first",
                      )
                    }
                  >
                    <option value="email-first">
                      Email form first, “Prefer SMS?” switch
                    </option>
                    <option value="sms-first">
                      Phone form first, “Prefer email?” switch
                    </option>
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className={label}>Switch to phone label</label>
                    <input
                      className={input}
                      value={v.smsForm.switchLabel}
                      onChange={(e) => setSms("switchLabel", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Switch back to email label</label>
                    <input
                      className={input}
                      value={v.smsForm.backLabel}
                      onChange={(e) => setSms("backLabel", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>Phone field label</label>
                    <input
                      className={input}
                      value={v.smsForm.phoneLabel}
                      onChange={(e) => setSms("phoneLabel", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className={label}>Consent text (required for SMS)</label>
                  <textarea
                    className={input + " min-h-20"}
                    value={v.smsForm.consentLabel}
                    onChange={(e) => setSms("consentLabel", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The visitor must tick this box to submit the phone form.
                    Keep the opt-out wording.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Style */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">Style</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField
                title="Primary color"
                value={v.style.primaryColor}
                onChange={(c) => set("style", { ...v.style, primaryColor: c })}
              />
              <ColorField
                title="Button color"
                value={v.style.buttonColor}
                onChange={(c) => set("style", { ...v.style, buttonColor: c })}
              />
              <ColorField
                title="Text color"
                value={v.style.textColor}
                onChange={(c) => set("style", { ...v.style, textColor: c })}
              />
            </div>
          </section>

          {/* Typography */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-900">Typography</h2>
            <p className="mb-4 text-sm text-gray-500">
              Alignment, size and weight for each text block. Sizes are clamped
              to readable ranges on mobile automatically.
            </p>
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600">
                Font family
              </label>
              <select
                className={input}
                value={v.contentStyle.fontFamily}
                onChange={(e) =>
                  set("contentStyle", {
                    ...v.contentStyle,
                    fontFamily: e.target.value,
                  })
                }
              >
                {SAFE_FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {FONT_LABELS[f] || f}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-4">
              <ContentBlockControls
                title="Headline"
                block={v.contentStyle.headline}
                onChange={(patch) => setContentBlock("headline", patch)}
              />
              <ContentBlockControls
                title="Sub-headline"
                block={v.contentStyle.subHeadline}
                onChange={(patch) => setContentBlock("subHeadline", patch)}
              />
              <ContentBlockControls
                title="Body text"
                block={v.contentStyle.bodyText}
                onChange={(patch) => setContentBlock("bodyText", patch)}
              />
            </div>
          </section>

          {/* Settings */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">Settings</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={label}>Status</label>
                <select
                  className={input}
                  value={v.status}
                  onChange={(e) =>
                    set("status", e.target.value as PopupFormValue["status"])
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className={label}>GC Tag ID</label>
                <input
                  className={input}
                  value={v.gcTagId}
                  onChange={(e) => set("gcTagId", e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={label}>Allowed domains (one per line)</label>
              <textarea
                className={input}
                rows={3}
                value={v.allowedDomains}
                onChange={(e) => set("allowedDomains", e.target.value)}
                placeholder={"example.com\nshop.example.com"}
              />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 font-semibold text-gray-900">Trigger</h2>
            <p className="mb-4 text-sm text-gray-500">
              Button activated is recommended and never opens an overlay until
              clicked.
            </p>
            <select
              className={input}
              value={v.trigger.type}
              onChange={(e) =>
                set("trigger", {
                  ...v.trigger,
                  type: e.target.value as PopupFormValue["trigger"]["type"],
                })
              }
            >
              <option value="button">Button activated (recommended)</option>
              <option value="delay">Delayed page load</option>
              <option value="exitIntent">Exit intent (desktop only)</option>
            </select>
            {v.trigger.type === "button" && (
              <>
                <label className={label}>Optional CSS selector</label>
                <input
                  className={input}
                  value={v.trigger.buttonSelector}
                  onChange={(e) =>
                    set("trigger", {
                      ...v.trigger,
                      buttonSelector: e.target.value,
                    })
                  }
                  placeholder="#open-offer or .open-popup"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Or add{" "}
                  <code>
                    data-gc-popup-trigger=&quot;{v.id || "popup-id"}&quot;
                  </code>{" "}
                  to a button.
                </p>
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Trigger button styler
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    These styles apply only to the generated trigger class, not
                    to unrelated site buttons.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600">
                        Label
                      </label>
                      <input
                        className={input}
                        value={v.buttonStyle.label}
                        onChange={(e) =>
                          set("buttonStyle", {
                            ...v.buttonStyle,
                            label: e.target.value,
                          })
                        }
                      />
                    </div>
                    <ColorField
                      title="Background"
                      value={v.buttonStyle.backgroundColor}
                      onChange={(value) =>
                        set("buttonStyle", {
                          ...v.buttonStyle,
                          backgroundColor: value,
                        })
                      }
                    />
                    <ColorField
                      title="Text color"
                      value={v.buttonStyle.textColor}
                      onChange={(value) =>
                        set("buttonStyle", {
                          ...v.buttonStyle,
                          textColor: value,
                        })
                      }
                    />
                    <ColorField
                      title="Hover background"
                      value={v.buttonStyle.hoverBackgroundColor}
                      onChange={(value) =>
                        set("buttonStyle", {
                          ...v.buttonStyle,
                          hoverBackgroundColor: value,
                        })
                      }
                    />
                    <div>
                      <label className="text-xs font-medium text-gray-600">
                        Width
                      </label>
                      <select
                        className={input}
                        value={v.buttonStyle.width}
                        onChange={(e) =>
                          set("buttonStyle", {
                            ...v.buttonStyle,
                            width: e.target.value as PopupButtonStyle["width"],
                          })
                        }
                      >
                        <option value="auto">Auto</option>
                        <option value="full">Full width</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">
                        Alignment
                      </label>
                      <select
                        className={input}
                        value={v.buttonStyle.alignment}
                        onChange={(e) =>
                          set("buttonStyle", {
                            ...v.buttonStyle,
                            alignment: e.target
                              .value as PopupButtonStyle["alignment"],
                          })
                        }
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <ImageRange
                      label="Font size"
                      value={v.buttonStyle.fontSize}
                      min={10}
                      max={32}
                      suffix="px"
                      onChange={(fontSize) =>
                        set("buttonStyle", { ...v.buttonStyle, fontSize })
                      }
                    />
                    <div>
                      <label className="text-xs font-medium text-gray-600">
                        Font weight
                      </label>
                      <select
                        className={input}
                        value={v.buttonStyle.fontWeight}
                        onChange={(e) =>
                          set("buttonStyle", {
                            ...v.buttonStyle,
                            fontWeight: Number(e.target.value),
                          })
                        }
                      >
                        <option value={400}>Normal</option>
                        <option value={500}>Medium</option>
                        <option value={600}>Semibold</option>
                        <option value={700}>Bold</option>
                        <option value={800}>Extra bold</option>
                      </select>
                    </div>
                    <ColorField
                      title="Border color"
                      value={v.buttonStyle.borderColor}
                      onChange={(borderColor) =>
                        set("buttonStyle", { ...v.buttonStyle, borderColor })
                      }
                    />
                    <ImageRange
                      label="Border width"
                      value={v.buttonStyle.borderWidth}
                      min={0}
                      max={8}
                      suffix="px"
                      onChange={(borderWidth) =>
                        set("buttonStyle", { ...v.buttonStyle, borderWidth })
                      }
                    />
                    <ImageRange
                      label="Radius"
                      value={v.buttonStyle.borderRadius}
                      min={0}
                      max={40}
                      suffix="px"
                      onChange={(borderRadius) =>
                        set("buttonStyle", { ...v.buttonStyle, borderRadius })
                      }
                    />
                    <ImageRange
                      label="Padding X"
                      value={v.buttonStyle.paddingX}
                      min={0}
                      max={60}
                      suffix="px"
                      onChange={(paddingX) =>
                        set("buttonStyle", { ...v.buttonStyle, paddingX })
                      }
                    />
                    <ImageRange
                      label="Padding Y"
                      value={v.buttonStyle.paddingY}
                      min={0}
                      max={40}
                      suffix="px"
                      onChange={(paddingY) =>
                        set("buttonStyle", { ...v.buttonStyle, paddingY })
                      }
                    />
                    <div>
                      <label className="text-xs font-medium text-gray-600">
                        Shadow
                      </label>
                      <input
                        className={input}
                        value={v.buttonStyle.shadow}
                        onChange={(e) =>
                          set("buttonStyle", {
                            ...v.buttonStyle,
                            shadow: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div
                    className="mt-4 flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-4"
                    style={{ textAlign: v.buttonStyle.alignment }}
                  >
                    <button
                      type="button"
                      className="inline-block"
                      style={{
                        background: v.buttonStyle.backgroundColor,
                        color: v.buttonStyle.textColor,
                        border: `${v.buttonStyle.borderWidth}px solid ${v.buttonStyle.borderColor}`,
                        borderRadius: v.buttonStyle.borderRadius,
                        fontSize: v.buttonStyle.fontSize,
                        fontWeight: v.buttonStyle.fontWeight,
                        padding: `${v.buttonStyle.paddingY}px ${v.buttonStyle.paddingX}px`,
                        boxShadow: v.buttonStyle.shadow,
                        width: v.buttonStyle.width === "full" ? "100%" : "auto",
                      }}
                    >
                      {v.buttonStyle.label}
                    </button>
                  </div>
                  <ButtonCodeCopy
                    popupId={v.id || "popup-id"}
                    buttonStyle={v.buttonStyle}
                  />
                </div>
              </>
            )}
            {v.trigger.type === "delay" && (
              <>
                <label className={label}>Delay in seconds (1 to 86,400)</label>
                <input
                  className={input}
                  type="number"
                  min="1"
                  max="86400"
                  value={v.trigger.delaySeconds}
                  onChange={(e) =>
                    set("trigger", {
                      ...v.trigger,
                      delaySeconds: Math.max(
                        1,
                        Math.min(86400, Number(e.target.value) || 1),
                      ),
                    })
                  }
                />
                <p className="mt-2 text-sm text-gray-500">
                  Opens after {v.trigger.delaySeconds} seconds.
                </p>
              </>
            )}
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={v.trigger.showOncePerSession}
                onChange={(e) =>
                  set("trigger", {
                    ...v.trigger,
                    showOncePerSession: e.target.checked,
                  })
                }
              />{" "}
              Show once per browser session
            </label>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : isNew ? "Create popup" : "Save changes"}
            </button>
          </div>
        </div>

        {/* ---------- RIGHT: live preview ---------- */}
        <div className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:overscroll-contain">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Live preview</h2>
              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 text-sm">
                <button
                  type="button"
                  onClick={() => setDevice("mobile")}
                  className={
                    "px-3 py-1.5 " +
                    (device === "mobile"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50")
                  }
                >
                  Mobile
                </button>
                <button
                  type="button"
                  onClick={() => setDevice("desktop")}
                  className={
                    "px-3 py-1.5 " +
                    (device === "desktop"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50")
                  }
                >
                  Desktop
                </button>
              </div>
            </div>
            <PopupPreview data={previewData} device={device} />
          </div>
        </div>
      </div>
    </form>
  );
}

const FONT_LABELS: Record<string, string> = {
  system: "System default",
  arial: "Arial",
  georgia: "Georgia",
  verdana: "Verdana",
  "sans-serif": "Sans-serif",
};

const WEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 300, label: "Light" },
  { value: 400, label: "Normal" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra bold" },
];

function ContentBlockControls({
  title,
  block,
  onChange,
}: {
  title: string;
  block: ContentBlockStyle;
  onChange: (patch: Partial<ContentBlockStyle>) => void;
}) {
  const aligns: ContentBlockStyle["align"][] = ["left", "center", "right"];
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 text-sm font-semibold text-gray-900">{title}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-gray-600">Alignment</label>
          <div className="mt-1 inline-flex overflow-hidden rounded-lg border border-gray-200 text-xs">
            {aligns.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => onChange({ align: a })}
                className={
                  "px-3 py-1.5 capitalize " +
                  (block.align === a
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50")
                }
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <ImageRange
          label="Size"
          value={block.fontSize}
          min={10}
          max={48}
          suffix="px"
          onChange={(fontSize) => onChange({ fontSize })}
        />
        <div>
          <label className="text-xs font-medium text-gray-600">Weight</label>
          <select
            className={input}
            value={block.fontWeight}
            onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
          >
            {WEIGHT_OPTIONS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// Generate one copyable block containing both the scoped trigger CSS and the
// HTML snippet. The CSS targets only `.gc-popup-trigger--{popupId}` so it never
// affects unrelated site buttons. No keys, tag IDs, domains, or submission data
// are ever included.
function buildButtonCode(popupId: string, b: PopupButtonStyle): string {
  const cls = `gc-popup-trigger--${popupId}`;
  const css =
    `.${cls} {\n` +
    `  display: ${b.width === "full" ? "block" : "inline-block"};\n` +
    `  width: ${b.width === "full" ? "100%" : "auto"};\n` +
    `  text-align: ${b.alignment};\n` +
    `  background: ${b.backgroundColor};\n` +
    `  color: ${b.textColor};\n` +
    `  border: ${b.borderWidth}px solid ${b.borderColor};\n` +
    `  border-radius: ${b.borderRadius}px;\n` +
    `  font-size: ${b.fontSize}px;\n` +
    `  font-weight: ${b.fontWeight};\n` +
    `  padding: ${b.paddingY}px ${b.paddingX}px;\n` +
    `  box-shadow: ${b.shadow};\n` +
    `  cursor: pointer;\n` +
    `}\n` +
    `.${cls}:hover { background: ${b.hoverBackgroundColor}; }`;
  const html =
    `<button class="${cls}" data-gc-popup-trigger="${popupId}">` +
    `${b.label}</button>`;
  return (
    `<!-- GC Popup trigger button. Paste this where you want the button to\n` +
    `     appear on your site. The <style> scopes all rules to this button\n` +
    `     only, so your other site buttons are unaffected. -->\n` +
    `<style>\n${css}\n</style>\n${html}`
  );
}

function ButtonCodeCopy({
  popupId,
  buttonStyle,
}: {
  popupId: string;
  buttonStyle: PopupButtonStyle;
}) {
  const [copied, setCopied] = useState(false);
  const code = buildButtonCode(popupId, buttonStyle);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Paste this block where you want the button to appear on your site. It
          includes the scoped button styles and the trigger HTML in one piece.
        </p>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          {copied ? "Copied!" : "Copy Button Code"}
        </button>
      </div>
      <pre className="max-h-40 overflow-auto rounded-lg bg-gray-900 px-3 py-2.5 text-[11px] leading-relaxed text-gray-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ColorField({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div>
      <label className={label}>{title}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
        />
        <input
          className={input + " mt-0"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function ImageRange({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <span className="float-right text-gray-500">
        {value}
        {suffix}
      </span>
      <input
        className="mt-1 w-full accent-blue-600"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
