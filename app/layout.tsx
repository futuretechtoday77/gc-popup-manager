import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GC Popup Manager',
  description: 'Multi-tenant popup management with Global Control CRM integration',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
