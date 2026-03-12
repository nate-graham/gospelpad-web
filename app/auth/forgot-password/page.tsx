'use client';

import Link from 'next/link';
import type { CSSProperties, FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { AuthFrame } from '@/components/layout/auth-frame';
import { getRequiredEnvState, getWebAuthCallbackUrl } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const envState = useMemo(() => getRequiredEnvState(), []);
  const [email, setEmail] = useState('');
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

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getWebAuthCallbackUrl('/auth/reset-password'),
    });

    setPending(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess('If that account exists, a reset link has been sent.');
  };

  return (
    <AuthFrame
      eyebrow="Password Reset"
      title="Reset your password"
      description="Supabase will send a recovery link to the email address connected to your GospelPad account."
    >
      {!envState.ok ? (
        <div className="error-state">
          <strong>Missing environment configuration</strong>
          <span>{envState.message}</span>
        </div>
      ) : null}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
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
        {error ? <div className="error-state" style={{ color: 'var(--danger)' }}>{error}</div> : null}
        {success ? <div className="empty-state">{success}</div> : null}
        <div className="cta-row">
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? 'Sending…' : 'Send reset link'}
          </button>
          <Link className="button button-secondary" href="/auth/sign-in">
            Back to sign in
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
  background: 'rgba(255,255,255,0.72)',
  color: 'var(--text)',
};

