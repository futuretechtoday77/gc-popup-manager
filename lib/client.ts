'use client';

// Client-side helpers for the admin UI. The JWT is kept in a cookie (so the
// middleware / server can read it too) and mirrored in memory for fetches.

const COOKIE = 'admin_token';

export function setToken(token: string): void {
  document.cookie = `${COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${
    12 * 60 * 60
  }; samesite=lax`;
}

export function getToken(): string | null {
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearToken(): void {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data: data as T };
}
