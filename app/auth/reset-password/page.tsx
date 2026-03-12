'use client';

import Link from 'next/link';
import type { CSSProperties, FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { AuthFrame } from '@/components/layout/auth-frame';
import { getRequiredEnvState } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const envState = useMemo(() => getRequiredEnvState(), []);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess('Your password has been updated. Continue back into GospelPad.');
  };

  return (
    <AuthFrame
      eyebrow="New Password"
      title="Choose a new password"
      description="If your recovery session is valid, this will update the password immediately."
    >
      {!envState.ok ? (
        <div className="error-state">
          <strong>Missing environment configuration</strong>
          <span>{envState.message}</span>
        </div>
      ) : null}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label style={fieldStyle}>
          <span className="eyebrow" style={labelTextStyle}>New password</span>
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
        <label style={fieldStyle}>
          <span className="eyebrow" style={labelTextStyle}>Confirm password</span>
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            placeholder="Repeat password"
            required
            minLength={6}
            style={inputStyle}
          />
        </label>
        {error ? <div className="error-state" style={{ color: 'var(--danger)' }}>{error}</div> : null}
        {success ? (
          <div className="empty-state">
            <span>{success}</span>
            <Link className="button button-primary" href="/notes">
              Continue to app
            </Link>
          </div>
        ) : (
          <div className="cta-row">
            <button className="button button-primary" disabled={pending} type="submit">
              {pending ? 'Updating…' : 'Update password'}
            </button>
            <Link className="button button-secondary" href="/auth/sign-in">
              Back to sign in
            </Link>
          </div>
        )}
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
