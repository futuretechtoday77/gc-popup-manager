'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Protected from '@/components/Protected';
import { StatusBadge, Spinner } from '@/components/ui';
import { api } from '@/lib/client';

interface PopupRow {
  id: string;
  name: string;
  site: string;
  status: string;
  submissionCount: number;
  updatedAt: string;
}

function PopupsInner() {
  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api<{ popups: PopupRow[] }>('/api/admin/popups');
      if (res.ok && res.data?.popups) setPopups(res.data.popups);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Popups</h1>
        <Link
          href="/admin/popups/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New Popup
        </Link>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {popups.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              No popups yet. Create your first one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Site</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Submissions</th>
                    <th className="px-5 py-3 font-medium">Updated</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {popups.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.id}</div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{p.site || '—'}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {p.submissionCount}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/popups/${p.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PopupsPage() {
  return (
    <Protected>
      <PopupsInner />
    </Protected>
  );
}
