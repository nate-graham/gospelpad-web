const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;
const defaultAppUrl = 'http://localhost:3000';

export type EnvState =
  | { ok: true }
  | { ok: false; message: string; missing: string[] };

export function getRequiredEnvState(): EnvState {
  const missing = requiredEnv.filter((key) => {
    const value = process.env[key];
    return !value || !value.trim();
  });

  if (missing.length === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    missing: [...missing],
    message: `Missing required env vars: ${missing.join(', ')}`,
  };
}

export function getPublicAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!value) {
    return defaultAppUrl;
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getSafeNextPath(value: string | null | undefined, fallback = '/notes') {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith('/')) {
    return fallback;
  }

  if (trimmed.startsWith('//')) {
    return fallback;
  }

  return trimmed;
}

export function getWebAuthCallbackUrl(nextPath = '/notes') {
  const url = new URL('/auth/callback', getPublicAppUrl());
  url.searchParams.set('next', getSafeNextPath(nextPath));
  return url.toString();
}
