import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div>
        <h1 className="text-3xl font-bold">GC Popup Manager</h1>
        <p className="mt-2 max-w-md text-gray-600">
          Multi-tenant popup opt-in forms with Global Control CRM integration.
        </p>
      </div>
      <Link
        href="/admin"
        className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
      >
        Go to Admin
      </Link>
    </main>
  );
}
