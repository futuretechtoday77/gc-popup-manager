import type { NextRequest } from 'next/server';

// Best-effort public origin for building embed snippets and script URLs.
export function publicOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const proto =
    req.headers.get('x-forwarded-proto') ||
    (req.nextUrl.protocol ? req.nextUrl.protocol.replace(':', '') : 'https');
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    req.nextUrl.host;
  return `${proto}://${host}`;
}

export function embedSnippet(origin: string, popupId: string): string {
  return `<script src="${origin}/embed.js" data-popup-id="${popupId}" async></script>`;
}
