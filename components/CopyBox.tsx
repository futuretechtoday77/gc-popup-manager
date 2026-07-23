'use client';

import { useState } from 'react';

export default function CopyBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for older browsers.
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 overflow-x-auto rounded-lg bg-gray-900 px-3 py-2.5 text-xs text-gray-100">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
