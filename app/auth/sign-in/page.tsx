'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthFrame } from '@/components/layout/auth-frame';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getRequiredEnvState, getSafeNextPath } from '@/lib/env';
import { ensureProfileForUser } from '@/lib/supabase/profile';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const envState = useMemo(() => getRequiredEnvState(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.');
      return;
    }

    setPending(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setPending(false);
      setError(signInError.message);
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
      setPending(false);
      setError(sessionError?.message ?? 'Sign-in completed but no active session was returned.');
      return;
    }

    const { user } = session;

    if (user?.id) {
      const metadata = user.user_metadata ?? {};
      const profileError = await ensureProfileForUser({
        id: user.id,
        username: String(metadata.username ?? '').trim(),
        name: String(metadata.name ?? metadata.username ?? '').trim(),
      });

      if (profileError) {
        setPending(false);
        setError(profileError);
        return;
      }
    }

    const next = getSafeNextPath(searchParams.get('next'));
    window.location.assign(next);
  };

  return (
    <AuthFrame
      eyebrow="Sign in"
      title="Use GospelPad from any screen"
      description="Sign in to open your notes, groups, and shared activity."
    >
      {!envState.ok ? (
        <div className="error-state">
          <strong>Missing environment configuration</strong>
          <span>{envState.message}</span>
        </div>
      ) : null}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.45rem' }}>
          <span className="eyebrow" style={{ fontSize: '0.72rem' }}>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="you@example.com"
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.45rem' }}>
          <span className="eyebrow" style={{ fontSize: '0.72rem' }}>Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Your password"
            required
            style={inputStyle}
          />
        </label>
        {error ? <div className="error-state" style={{ color: 'var(--danger)' }}>{error}</div> : null}
        <div className="cta-row">
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          <Link className="button button-ghost" href="/auth/forgot-password">
            Forgot password
          </Link>
        </div>
        <div className="cta-row">
          <Link className="button button-secondary" href="/auth/sign-up">
            Create account
          </Link>
          <Link className="button button-secondary" href="/">
            Back
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid var(--line)',
  padding: '0.85rem 1rem',
  background: 'rgba(255,255,255,0.72)',
  color: 'var(--text)',
};
