'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPublicAppUrl, getWebAuthCallbackUrl } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useDisplayPreferences } from '@/components/providers/display-preferences-provider';

export function SettingsView() {
  const router = useRouter();
  const { appearance, setAppearance } = useDisplayPreferences();
  const [signingOut, setSigningOut] = useState(false);
  const appUrl = useMemo(() => getPublicAppUrl(), []);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.replace('/auth/sign-in');
  };

  return (
    <div className="page-section">
      <header className="page-header">
        <span className="eyebrow">Settings</span>
        <h1>Settings</h1>
        <p className="page-description">
          Manage appearance, session access, and the current deployment assumptions that affect your GospelPad web account.
        </p>
      </header>

      <section className="responsive-grid">
        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.9rem' }}>
          <fieldset style={fieldSetStyle}>
            <legend style={legendStyle}>
              <span className="eyebrow">Display preference</span>
              <strong style={{ fontSize: '1.1rem' }}>Appearance</strong>
            </legend>
            <label style={choiceRowStyle}>
              <input
                checked={appearance === 'warm'}
                name="appearance"
                onChange={() => setAppearance('warm')}
                type="radio"
              />
              <span>
                <strong>Warm</strong>
                <br />
                <span style={{ color: 'var(--muted)' }}>Matches the default GospelPad web look.</span>
              </span>
            </label>
            <label style={choiceRowStyle}>
              <input
                checked={appearance === 'contrast'}
                name="appearance"
                onChange={() => setAppearance('contrast')}
                type="radio"
              />
              <span>
                <strong>Higher contrast</strong>
                <br />
                <span style={{ color: 'var(--muted)' }}>Stronger text and borders for easier reading.</span>
              </span>
            </label>
          </fieldset>
        </section>

        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Session</span>
            <strong style={{ fontSize: '1.1rem' }}>Access and security</strong>
          </div>
          <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Sign-out remains available from the shell and here in settings so it is always reachable on phone, tablet, and desktop.
          </span>
          <button className="button button-primary" disabled={signingOut} onClick={signOut} type="button">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </section>
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.9rem' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Production assumptions</span>
          <strong style={{ fontSize: '1.1rem' }}>Config reminders</strong>
        </div>
        <DetailRow label="Base URL" value={appUrl} />
        <DetailRow label="Auth callback" value={getWebAuthCallbackUrl('/notes')} />
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Production deploys must register the matching callback URL in Supabase Auth and keep the canonical deployed host consistent with `NEXT_PUBLIC_APP_URL`.
        </span>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
      <span className="eyebrow">{label}</span>
      <strong style={{ fontSize: '0.96rem', overflowWrap: 'anywhere' }}>{value}</strong>
    </div>
  );
}

const choiceRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.8rem',
  alignItems: 'flex-start',
  lineHeight: 1.6,
};

const fieldSetStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  border: 0,
  display: 'grid',
  gap: '0.9rem',
};

const legendStyle: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  padding: 0,
};
