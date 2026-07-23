'use client';

import { useState } from 'react';
import type { Popup } from '@/lib/types';

export interface PopupFormValue {
  id: string;
  name: string;
  site: string;
  status: 'active' | 'inactive' | 'draft';
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  fields: { firstName: boolean; phone: boolean; notes: boolean };
  gcTagId: string;
  thankYouUrl: string;
  allowedDomains: string; // newline/comma separated in the form
  style: { primaryColor: string; buttonColor: string };
}

export function emptyForm(): PopupFormValue {
  return {
    id: '',
    name: '',
    site: '',
    status: 'draft',
    headline: '',
    subHeadline: '',
    bodyText: '',
    buttonText: 'Submit',
    imageUrl: '',
    fields: { firstName: true, phone: false, notes: false },
    gcTagId: '',
    thankYouUrl: '',
    allowedDomains: '',
    style: { primaryColor: '#111827', buttonColor: '#2563eb' },
  };
}

export function fromPopup(p: Popup): PopupFormValue {
  return {
    id: p.id,
    name: p.name,
    site: p.site,
    status: p.status,
    headline: p.headline,
    subHeadline: p.subHeadline,
    bodyText: p.bodyText,
    buttonText: p.buttonText,
    imageUrl: p.imageUrl,
    fields: { ...p.fields },
    gcTagId: p.gcTagId,
    thankYouUrl: p.thankYouUrl,
    allowedDomains: (p.allowedDomains || []).join('\n'),
    style: { ...p.style },
  };
}

// Convert the form value into an API payload (domains -> array).
export function toPayload(v: PopupFormValue): Record<string, unknown> {
  return {
    ...v,
    allowedDomains: v.allowedDomains
      .split(/[\n,]/)
      .map((d) => d.trim())
      .filter(Boolean),
  };
}

const label = 'block text-sm font-medium text-gray-700';
const input =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

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

  function set<K extends keyof PopupFormValue>(key: K, val: PopupFormValue[K]) {
    setV((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-6"
    >
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>Name</label>
            <input
              className={input}
              value={v.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label}>
              Slug / ID {isNew && <span className="text-gray-400">(optional)</span>}
            </label>
            <input
              className={input}
              value={v.id}
              onChange={(e) => set('id', e.target.value)}
              placeholder="rife-main-optin"
              disabled={!isNew}
            />
          </div>
          <div>
            <label className={label}>Site / brand label</label>
            <input
              className={input}
              value={v.site}
              onChange={(e) => set('site', e.target.value)}
              placeholder="rifecode"
            />
          </div>
          <div>
            <label className={label}>Status</label>
            <select
              className={input}
              value={v.status}
              onChange={(e) =>
                set('status', e.target.value as PopupFormValue['status'])
              }
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Content</h2>
        <div className="space-y-4">
          <div>
            <label className={label}>Headline</label>
            <input
              className={input}
              value={v.headline}
              onChange={(e) => set('headline', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Sub-headline</label>
            <input
              className={input}
              value={v.subHeadline}
              onChange={(e) => set('subHeadline', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Body text</label>
            <textarea
              className={input}
              rows={3}
              value={v.bodyText}
              onChange={(e) => set('bodyText', e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Button text</label>
              <input
                className={input}
                value={v.buttonText}
                onChange={(e) => set('buttonText', e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Image URL</label>
              <input
                className={input}
                value={v.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Fields shown</h2>
        <div className="flex flex-wrap gap-6">
          {(['firstName', 'phone', 'notes'] as const).map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={v.fields[f]}
                onChange={(e) =>
                  set('fields', { ...v.fields, [f]: e.target.checked })
                }
              />
              {f === 'firstName' ? 'First name' : f[0].toUpperCase() + f.slice(1)}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">
          Integration &amp; routing
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>GC Tag ID</label>
            <input
              className={input}
              value={v.gcTagId}
              onChange={(e) => set('gcTagId', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Thank-you URL</label>
            <input
              className={input}
              value={v.thankYouUrl}
              onChange={(e) => set('thankYouUrl', e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={label}>Allowed domains (one per line)</label>
          <textarea
            className={input}
            rows={3}
            value={v.allowedDomains}
            onChange={(e) => set('allowedDomains', e.target.value)}
            placeholder={'example.com\nshop.example.com'}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Style</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={label}>Primary color</label>
            <input
              className={input}
              value={v.style.primaryColor}
              onChange={(e) =>
                set('style', { ...v.style, primaryColor: e.target.value })
              }
            />
          </div>
          <div>
            <label className={label}>Button color</label>
            <input
              className={input}
              value={v.style.buttonColor}
              onChange={(e) =>
                set('style', { ...v.style, buttonColor: e.target.value })
              }
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : isNew ? 'Create popup' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
