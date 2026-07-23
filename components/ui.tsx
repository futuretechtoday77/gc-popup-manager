'use client';

import type { SubmissionStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: SubmissionStatus | string }) {
  const map: Record<string, string> = {
    queued: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    processed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    max_retries: 'bg-red-200 text-red-900',
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-200 text-gray-700',
    draft: 'bg-yellow-100 text-yellow-800',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-700';
  return (
    <span
      className={
        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ' + cls
      }
    >
      {String(status).replace('_', ' ')}
    </span>
  );
}

export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className={'mt-1 text-3xl font-bold ' + (accent || 'text-gray-900')}>
        {value}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <span className="animate-pulse text-sm">Loading…</span>
    </div>
  );
}
