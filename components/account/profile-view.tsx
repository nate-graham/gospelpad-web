'use client';

import Link from 'next/link';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { NOTE_TYPES } from '@/lib/notes';
import { loadAccountProfile, loadAccountSummary, updateAccountProfile, type AccountProfile, type AccountSummary } from '@/lib/account';

export function ProfileView() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [form, setForm] = useState<{
    name: string;
    church: string;
    defaultNoteType: (typeof NOTE_TYPES)[number];
  }>({
    name: '',
    church: '',
    defaultNoteType: NOTE_TYPES[0],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [nextProfile, nextSummary] = await Promise.all([
          loadAccountProfile(),
          loadAccountSummary(),
        ]);

        if (!active) return;
        setProfile(nextProfile);
        setSummary(nextSummary);
        setForm({
          name: nextProfile.name ?? '',
          church: nextProfile.church ?? '',
          defaultNoteType: NOTE_TYPES.includes((nextProfile.defaultNoteType ?? '') as (typeof NOTE_TYPES)[number])
            ? (nextProfile.defaultNoteType as (typeof NOTE_TYPES)[number])
            : NOTE_TYPES[0],
        });
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(
    () => [
      { label: 'Notes', value: summary?.noteCount ?? 0 },
      { label: 'Groups', value: summary?.groupCount ?? 0 },
    ],
    [summary]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateAccountProfile(form);
      const refreshed = await loadAccountProfile();
      setProfile(refreshed);
      setSuccess('Profile preferences saved.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Loading profile…</strong>
        <span style={{ color: 'var(--muted)' }}>Fetching your account details.</span>
      </section>
    );
  }

  if (error && !profile) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Unable to load profile</strong>
        <span style={{ color: 'var(--muted)' }}>{error}</span>
      </section>
    );
  }

  return (
    <div className="page-section">
      <header className="page-header">
        <span className="eyebrow">Profile</span>
        <h1>Your account</h1>
        <p className="page-description">
          Keep your profile details up to date and choose the note type you want to start with most often.
        </p>
      </header>

      <section className="responsive-grid compact">
        {stats.map((item) => (
          <article className="panel" key={item.label} style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">{item.label}</span>
            <strong style={{ fontSize: '1.6rem' }}>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="two-column-layout">
        <form className="panel" onSubmit={onSubmit} style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Editable details</span>
            <strong style={{ fontSize: '1.1rem' }}>Basic profile preferences</strong>
          </div>
          <label style={fieldStyle}>
            <span className="eyebrow" style={labelTextStyle}>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span className="eyebrow" style={labelTextStyle}>Church</span>
            <input
              value={form.church}
              onChange={(event) => setForm((current) => ({ ...current, church: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span className="eyebrow" style={labelTextStyle}>Default note type</span>
            <select
              value={form.defaultNoteType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  defaultNoteType: event.target.value as (typeof NOTE_TYPES)[number],
                }))
              }
              style={inputStyle}
            >
              {NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {error ? <div className="error-state status-message" role="alert">{error}</div> : null}
          {success ? <div className="empty-state status-message" role="status">{success}</div> : null}
          <div className="cta-row">
            <button className="button button-primary" disabled={saving} type="submit">
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <Link className="button button-secondary" href="/settings">
              Open settings
            </Link>
          </div>
        </form>

        <aside className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Read-only account data</span>
            <strong style={{ fontSize: '1.1rem' }}>Current session details</strong>
          </div>
          <DetailRow label="Email" value={profile?.email ?? 'Not available'} />
          <DetailRow label="Username" value={profile?.username ?? 'Not set'} />
          <DetailRow label="Onboarding" value={profile?.onboardingCompleted ? 'Complete' : 'Not completed'} />
          <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Your username is shown here so other people can recognize you in shared notes and groups.
          </span>
        </aside>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: '0.2rem' }}>
      <span className="eyebrow">{label}</span>
      <strong style={{ fontSize: '0.98rem', overflowWrap: 'anywhere' }}>{value}</strong>
    </div>
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
