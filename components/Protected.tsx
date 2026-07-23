'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/client';
import AdminShell from './AdminShell';

// Wraps a protected admin page: redirects to /admin when there is no token.
export default function Protected({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/admin');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
