'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Protected from '@/components/Protected';
import { StatCard, StatusBadge, Spinner } from '@/components/ui';
import { api } from '@/lib/client';
import type { Submission } from '@/lib/types';

interface PopupRow {
  id: string;
  name: string;
  status: string;
  submissionCount: number;
}

function DashboardInner() {
  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        api<{ popups: PopupRow[] }>('/api/admin/popups'),
        api<{ submissions: Submission[] }>('/api/admin/submissions?limit=200'),
      ]);
      if (p.ok && p.data?.popups) setPopups(p.data.popups);
      if (s.ok && s.data?.submissions) setSubmissions(s.data.submissions);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;

  const queued = submissions.filter(
    (s) => s.status === 'queued' || s.status === 'processing',
  ).length;
  const failed = submissions.filter(
    (s) => s.status === 'failed' || s.status === 'max_retries',
  ).length;
  const recent = submissions.slice(0, 10);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Popups" value={popups.length} />
        <StatCard label="Submissions" value={submissions.length} />
        <StatCard label="Queue depth" value={queued} accent="text-yellow-600" />
        <StatCard label="Failed" value={failed} accent="text-red-600" />
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="font-semibold text-gray-900">Recent submissions</h2>
          <Link
            href="/admin/submissions"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            No submissions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-2 font-medium">Email</th>
                  <th className="px-5 py-2 font-medium">Popup</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-5 py-2.5 text-gray-900">{s.email}</td>
                    <td className="px-5 py-2.5 text-gray-600">{s.popupId}</td>
                    <td className="px-5 py-2.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-2.5 text-gray-500">
                      {new Date(s.submittedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Protected>
      <DashboardInner />
    </Protected>
  );
}
