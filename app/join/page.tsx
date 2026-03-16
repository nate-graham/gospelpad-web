'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { joinGroupByCode } from '@/lib/groups';
import { getSafeNextPath } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { AuthFrame } from '@/components/layout/auth-frame';

export default function JoinGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = useMemo(() => searchParams.get('code')?.trim().toUpperCase() ?? '', [searchParams]);
  const [code, setCode] = useState(initialCode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const next = getSafeNextPath(`/join?code=${encodeURIComponent(code || initialCode)}`, '/groups');

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not configured for this browser session.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/auth/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }

    try {
      setPending(true);
      setError(null);
      setNotice(null);

      const result = await joinGroupByCode(code);

      if (result.status === 'pending') {
        setNotice(`Join request sent to ${result.group.name}. An admin will need to approve it.`);
        setPending(false);
        return;
      }

      router.replace(`/groups/${result.group.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to use this invite right now.');
      setPending(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="Group Invite"
      title="Join a GospelPad group"
      description="Use an invite code or link to join a public group immediately or request access to a private group."
    >
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.45rem' }}>
          <span className="eyebrow" style={{ fontSize: '0.72rem' }}>Invite code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABCDEFGH2"
            required
            style={inputStyle}
          />
        </label>

        <div className="status-card" style={{ padding: '1rem' }}>
          <strong>How it works</strong>
          <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Public groups join instantly. Private groups will send a join request to the group owner or an admin for review.
          </span>
        </div>

        {notice ? <div className="empty-state status-message" role="status">{notice}</div> : null}
        {error ? <div className="error-state status-message" role="alert">{error}</div> : null}

        <div className="cta-row">
          <button className="button button-primary" disabled={pending || !code.trim()} type="submit">
            {pending ? 'Joining…' : 'Continue with invite'}
          </button>
          <Link className="button button-secondary" href="/groups">
            Back to groups
          </Link>
        </div>
      </form>
    </AuthFrame>
  );
}

const inputStyle = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid var(--line)',
  padding: '0.85rem 1rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
} as const;
