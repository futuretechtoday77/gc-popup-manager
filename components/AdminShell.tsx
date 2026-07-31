'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/client';

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/popups', label: 'Popups' },
  { href: '/admin/submissions', label: 'Submissions' },
];

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push('/admin');
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="flex w-56 flex-col bg-gray-900 text-gray-200">
        <div className="border-b border-gray-800 px-5 py-4">
          <div className="text-sm font-bold tracking-wide text-white">
            GC Popup Manager
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'block rounded-md px-3 py-2 text-sm font-medium ' +
                  (active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white')
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-800 p-3">
          <button
            onClick={logout}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Log out
          </button>
        </div>
        <div className="border-t border-gray-700 px-4 py-2 text-center text-xs text-gray-500">
          gc-popup-manager{' '}
          {process.env.NEXT_PUBLIC_APP_VERSION ?? 'v0.6.1'}
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
