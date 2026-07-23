'use client';

import { useCallback, useEffect, useState } from 'react';
import Protected from '@/components/Protected';
import { StatusBadge, Spinner } from '@/components/ui';
import { api } from '@/lib/client';
import type { Submission, SubmissionStatus } from '@/lib/types';

const STATUS_OPTIONS: (SubmissionStatus | 'all')[] = [
  'all',
  'queued',
  'processing',
  'processed',
  'failed',
  'max_retries',
];

interface PopupOption {
  id: string;
  name: string;
}

function SubmissionsInner() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [popups, setPopups] = useState<PopupOption[]>([]);
  const [status, setStatus] = useState<string>('all');
  const [popupId, setPopupId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (status !== 'all') qs.set('status', status);
    if (popupId !== 'all') qs.set('popupId', popupId);
    const res = await api<{ submissions: Submission[] }>(
      `/api/admin/submissions?${qs.toString()}`,
    );
    if (res.ok && res.data?.submissions) setSubmissions(res.data.submissions);
    setLoading(false);
  }, [status, popupId]);

  useEffect(() => {
    (async () => {
      const res = await api<{ popups: PopupOption[] }>('/api/admin/popups');
      if (res.ok && res.data?.popups) setPopups(res.data.popups);
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(id: string) {
    setRetrying(id);
    const res = await api(`/api/admin/submissions/${id}/retry`, {
      method: 'POST',
    });
    setRetrying(null);
    if (res.ok) load();
  }

  const selectCls =
    'rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>

      <div className="mt-6 flex flex-wrap gap-3">
        <select
          className={selectCls}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={popupId}
          onChange={(e) => setPopupId(e.target.value)}
        >
          <option value="all">All popups</option>
          {popups.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <Spinner />
        ) : submissions.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            No submissions match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Popup</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Retries</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const canRetry =
                    s.status === 'failed' || s.status === 'max_retries';
                  return (
                    <tr key={s.id} className="border-t border-gray-100 align-top">
                      <td className="px-5 py-3">
                        <div className="text-gray-900">{s.email}</div>
                        {s.error && (
                          <div
                            className="mt-0.5 max-w-xs truncate text-xs text-red-500"
                            title={s.error}
                          >
                            {s.error}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{s.popupId}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-5 py-3 text-gray-600">{s.retryCount}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(s.submittedAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canRetry && (
                          <button
                            onClick={() => retry(s.id)}
                            disabled={retrying === s.id}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {retrying === s.id ? 'Retrying…' : 'Retry'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubmissionsPage() {
  return (
    <Protected>
      <SubmissionsInner />
    </Protected>
  );
}
