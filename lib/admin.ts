import 'server-only';

import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL_ALLOWLIST_ENV_KEYS = ['ADMIN_EMAIL_ALLOWLIST', 'SIGNUPS_ADMIN_EMAIL_ALLOWLIST'] as const;

export type AdminEnvIssue =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'ADMIN_EMAIL_ALLOWLIST';

export function getAdminEmailAllowlist() {
  const raw = ADMIN_EMAIL_ALLOWLIST_ENV_KEYS.map((key) => process.env[key]).find(Boolean) ?? '';
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const allowlist = getAdminEmailAllowlist();
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

export function getAdminEnvIssues(): AdminEnvIssue[] {
  const issues: AdminEnvIssue[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    issues.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  if (getAdminEmailAllowlist().length === 0) {
    issues.push('ADMIN_EMAIL_ALLOWLIST');
  }

  return issues;
}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
