'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useDisplayPreferences } from '@/components/providers/display-preferences-provider';
import { getShowDeleteWarningPreference, setShowDeleteWarningPreference } from '@/lib/delete-warning-preference';

export function SettingsView() {
  const router = useRouter();
  const { appearance, setAppearance } = useDisplayPreferences();
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(true);

  useEffect(() => {
    setShowDeleteWarning(getShowDeleteWarningPreference());
  }, []);

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
          Adjust how GospelPad looks and manage your account access.
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
            <label style={choiceRowStyle}>
              <input
                checked={appearance === 'dark'}
                name="appearance"
                onChange={() => setAppearance('dark')}
                type="radio"
              />
              <span>
                <strong>Dark</strong>
                <br />
                <span style={{ color: 'var(--muted)' }}>A lower-glare theme for evening reading and dim rooms.</span>
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

        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Delete warning</span>
            <strong style={{ fontSize: '1.1rem' }}>Confirm before moving notes to recently deleted</strong>
          </div>
          <label style={choiceRowStyle}>
            <input
              checked={showDeleteWarning}
              onChange={(event) => {
                const next = event.target.checked;
                setShowDeleteWarning(next);
                setShowDeleteWarningPreference(next);
              }}
              type="checkbox"
            />
            <span>
              <strong>Show delete warning</strong>
              <br />
              <span style={{ color: 'var(--muted)' }}>
                Turn this back on anytime if you want a confirmation before notes move to recently deleted.
              </span>
            </span>
          </label>
        </section>

        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">About</span>
            <strong style={{ fontSize: '1.1rem' }}>Legal and app info</strong>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <Link className="button button-secondary" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="button button-secondary" href="/terms">
              Terms of Service
            </Link>
            <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>Version 1.0.0</div>
          </div>
        </section>

        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Support</span>
            <strong style={{ fontSize: '1.1rem' }}>Help and contact</strong>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <a className="button button-secondary" href="mailto:support@gospelpad.com?subject=GospelPad%20Help%20Center">
              Help Center
            </a>
            <a className="button button-secondary" href="mailto:support@gospelpad.com?subject=GospelPad%20Contact">
              Contact Us
            </a>
            <a className="button button-secondary" href="mailto:support@gospelpad.com?subject=GospelPad%20Feedback">
              Send Feedback
            </a>
          </div>
        </section>
      </section>

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
