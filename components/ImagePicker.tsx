'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '@/lib/client';

// ---- Types ----

interface UploadRecord {
  url: string;
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

interface Props {
  value: string;
  onChange: (url: string) => void;
}

// ---- Helpers ----

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Library Modal ----

function LibraryModal({
  onSelect,
  onClose,
  onUploadComplete,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
  onUploadComplete: (url: string) => void;
}) {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchUploads = useCallback(async () => {
    try {
      const token = getToken();
      const res = await fetch('/api/admin/uploads', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json()) as { uploads?: UploadRecord[] };
      setUploads(data.uploads ?? []);
    } catch {
      // Leave empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setUploadErr(data.error ?? 'Upload failed.');
      } else {
        onUploadComplete(data.url);
        await fetchUploads();
      }
    } catch {
      setUploadErr('Network error during upload.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Image library</h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : '+ Upload new'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error */}
        {uploadErr && (
          <div className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {uploadErr}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : uploads.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No images uploaded yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {uploads.map((u) => {
                const isSelected = selected === u.url;
                return (
                  <button
                    type="button"
                    key={u.url}
                    onClick={() => setSelected(isSelected ? null : u.url)}
                    className={
                      'group relative overflow-hidden rounded-lg border-2 text-left transition ' +
                      (isSelected
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-transparent hover:border-gray-300')
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u.url}
                      alt={u.originalName}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="p-1">
                      <p
                        className="truncate text-xs font-medium text-gray-700"
                        title={u.originalName}
                      >
                        {u.originalName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(u.uploadedAt)}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onSelect(selected);
                onClose();
              }
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Use this image
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- ImagePicker ----

const inputCls =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

export default function ImagePicker({ value, onChange }: Props) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setUploadErr(data.error ?? 'Upload failed.');
      } else {
        onChange(data.url);
      }
    } catch {
      setUploadErr('Network error during upload.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      {/* Preview */}
      <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Selected"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs text-gray-400">No image selected</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : '↑ Upload new'}
        </button>
        <button
          type="button"
          onClick={() => setShowLibrary(true)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          ☷ From library
        </button>
        <button
          type="button"
          onClick={() => setShowUrlInput((s) => !s)}
          className={
            'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ' +
            (showUrlInput
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
          }
        >
          ⌘ Enter URL
        </button>
      </div>

      {/* Upload progress / error */}
      {uploading && (
        <p className="text-xs text-blue-600">Uploading…</p>
      )}
      {uploadErr && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {uploadErr}
        </p>
      )}

      {/* Inline URL input (toggle) */}
      {showUrlInput && (
        <input
          className={inputCls}
          placeholder="https://example.com/image.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {/* Always-visible URL field (read/edit) */}
      <div>
        <label className="block text-xs font-medium text-gray-500">
          Image URL
        </label>
        <input
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
      </div>

      {/* Library modal */}
      {showLibrary && (
        <LibraryModal
          onSelect={onChange}
          onClose={() => setShowLibrary(false)}
          onUploadComplete={onChange}
        />
      )}
    </div>
  );
}
