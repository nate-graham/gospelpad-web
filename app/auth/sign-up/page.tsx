'use client';

import Link from 'next/link';
import type { CSSProperties, FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthFrame } from '@/components/layout/auth-frame';
import { getRequiredEnvState, getSafeNextPath, getWebAuthCallbackUrl } from '@/lib/env';
import { ensureProfileForUser } from '@/lib/supabase/profile';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const envState = useMemo(() => getRequiredEnvState(), []);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.');
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    const next = getSafeNextPath(searchParams.get('next'));

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getWebAuthCallbackUrl(next),
        data: {
          username,
          name: username,
          dyslexic_mode: false,
        },
      },
    });

    if (signUpError) {
      setPending(false);
      setError(signUpError.message);
      return;
    }

    if (data.user?.id && data.session) {
      const profileError = await ensureProfileForUser({
        id: data.user.id,
        username,
        name: username,
      });

      if (profileError) {
        setPending(false);
        setError(profileError);
        return;
      }

      window.location.assign(next);
      return;
    }

    setSuccess('Account created. Check your email to complete sign-up.');
    setPending(false);
  };

  return (
    <AuthFrame
      eyebrow="Sign up"
      title="Create a GospelPad web account"
      description="Create an account to start writing notes, joining groups, and sharing with others."
    >
      {!envState.ok ? (
        <div className="error-state">
          <strong>Missing environment configuration</strong>
          <span>{envState.message}</span>
        </div>
      ) : null}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label style={fieldStyle}>
          <span className="eyebrow" style={labelTextStyle}>Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            type="text"
            placeholder="yourname"
            required
            minLength={2}
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span className="eyebrow" style={labelTextStyle}>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="you@example.com"
            required
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span className="eyebrow" style={labelTextStyle}>Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="At least 6 characters"
            required
            minLength={6}
            style={inputStyle}
          />
        </label>
        {error ? <div className="error-state" style={{ color: 'var(--danger)' }}>{error}</div> : null}
        {success ? <div className="empty-state">{success}</div> : null}
        <div className="cta-row">
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? 'Creating account…' : 'Create account'}
          </button>
          <Link className="button button-secondary" href={`/auth/sign-in?next=${encodeURIComponent(getSafeNextPath(searchParams.get('next')))}`}>
            Already have an account?
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
};

const labelTextStyle: CSSProperties = {
  fontSize: '0.72rem',
};

const inputStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid var(--line)',
  padding: '0.85rem 1rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
};
