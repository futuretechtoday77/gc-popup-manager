"use client";

import { useMemo, useState } from "react";
import type {
  Popup,
  PopupField,
  PopupTemplate,
  FieldKey,
  PopupImageSettings,
} from "@/lib/types";
import { DEFAULT_FIELDS } from "@/lib/types";
import { defaultImageSettings } from "@/lib/popup-shape";
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
  fields: PopupField[];
  trigger: {
    type: "button" | "delay" | "exitIntent";
    delaySeconds: number;
    buttonSelector: string;
    showOncePerSession: boolean;
  };
  gcTagId: string;
  thankYouUrl: string;
  allowedDomains: string; // newline/comma separated in the form
  style: { primaryColor: string; buttonColor: string; textColor: string };
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
    fields: cloneDefaults(),
    trigger: {
      type: "button",
      delaySeconds: 30,
      buttonSelector: "",
      showOncePerSession: true,
    },
    gcTagId: "",
    thankYouUrl: "",
    allowedDomains: "",
    style: {
      primaryColor: "#ffffff",
      buttonColor: "#22c55e",
      textColor: "#1a1a1a",
    },
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
    fields,
    trigger: {
      type: p.trigger?.type || "button",
      delaySeconds: p.trigger?.delaySeconds || 30,
      buttonSelector: p.trigger?.buttonSelector || "",
      showOncePerSession: p.trigger?.showOncePerSession !== false,
    },
    gcTagId: p.gcTagId,
    thankYouUrl: p.thankYouUrl,
    allowedDomains: (p.allowedDomains || []).join("\n"),
    style: {
      primaryColor: p.style?.primaryColor || "#ffffff",
      buttonColor: p.style?.buttonColor || "#22c55e",
      textColor: p.style?.textColor || "#1a1a1a",
    },
  };
}

// Convert the form value into an API payload (domains -> array, re-index order).
export function toPayload(v: PopupFormValue): Record<string, unknown> {
  const fields = v.fields.map((f, i) => ({ ...f, order: i }));
  return {
    ...v,
    fields,
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
  firstName: "First Name",
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
      fields: v.fields.map((f, i) => ({ ...f, order: i })),
      style: v.style,
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
      <div className="grid gap-6 lg:grid-cols-[55fr_45fr]">
        {/* ---------- LEFT: editor ---------- */}
        <div className="space-y-6">
          {/* Template picker */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900">Template</h2>
            <div className="grid gap-3 sm:grid-cols-3">
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
              <div>
                <label className={label}>Thank-you URL</label>
                <input
                  className={input}
                  value={v.thankYouUrl}
                  onChange={(e) => set("thankYouUrl", e.target.value)}
                />
              </div>
            </div>
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
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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
            <div className="flex justify-center">
              <PopupPreview data={previewData} device={device} />
            </div>
          </div>
        </div>
      </div>
    </form>
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
