'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Protected from '@/components/Protected';
import PopupForm, {
  emptyForm,
  toPayload,
  type PopupFormValue,
} from '@/components/PopupForm';
import { api } from '@/lib/client';

function NewInner() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(v: PopupFormValue) {
    setSubmitting(true);
    setError(null);
    const res = await api<{ success: boolean; popup?: { id: string }; error?: string }>(
      '/api/admin/popups',
      { method: 'POST', body: JSON.stringify(toPayload(v)) },
    );
    setSubmitting(false);
    if (res.ok && res.data?.popup) {
      router.push(`/admin/popups/${res.data.popup.id}`);
    } else {
      setError(res.data?.error || 'Failed to create popup');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">New popup</h1>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-6">
        <PopupForm
          initial={emptyForm()}
          isNew
          onSubmit={onSubmit}
          submitting={submitting}
        />
      </div>
    </div>
  );
}

export default function NewPopupPage() {
  return (
    <Protected>
      <NewInner />
    </Protected>
  );
}
