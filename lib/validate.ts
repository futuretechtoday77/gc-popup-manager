const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

// Strip control chars, trim, and cap length to keep stored data sane.
export function sanitize(input: unknown, maxLen = 2000): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

// Normalize a hostname from an Origin/Referer header or a domain string.
export function hostFrom(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    // Full URL case.
    if (value.includes('://')) return new URL(value).hostname.toLowerCase();
    // Bare host case (may include a path or port).
    return new URL(`https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Matches a request host against an allowlist entry, supporting a leading
// wildcard like "*.example.com" and bare "example.com" (which also matches
// www.example.com and other subdomains).
export function domainAllowed(
  host: string | null,
  allowedDomains: string[],
): boolean {
  if (!host) return false;
  if (!allowedDomains || allowedDomains.length === 0) return false;
  return allowedDomains.some((raw) => {
    const entry = hostFrom(raw) || raw.toLowerCase().trim();
    if (!entry) return false;
    if (entry.startsWith('*.')) {
      const base = entry.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return host === entry || host.endsWith(`.${entry}`);
  });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
