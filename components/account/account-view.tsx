'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listDeletedNotes,
  permanentlyDeleteAllDeletedNotes,
  permanentlyDeleteNote,
  permanentlyDeleteNotes,
  restoreNote,
  NOTE_TYPES,
  type NoteRecord,
} from '@/lib/notes';
import { loadAccountProfile, loadAccountSummary, updateAccountProfile, type AccountProfile, type AccountSummary } from '@/lib/account';
import { getMyEntitlements, type EntitlementSummary } from '@/lib/entitlements';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useDisplayPreferences } from '@/components/providers/display-preferences-provider';
import { getShowDeleteWarningPreference, setShowDeleteWarningPreference } from '@/lib/delete-warning-preference';
import { BereaSeatsSection } from '@/components/account/berea-seats-section';

type NoteType = (typeof NOTE_TYPES)[number];

const PLAN_COPY: Record<string, { name: string; copy: string }> = {
  free: { name: 'Free', copy: 'Notes, sharing, lookup by reference and groups up to 5. Premium adds Berea study, dictation, transcription and phrase search.' },
  premium: { name: 'Premium', copy: 'Berea study, dictation, transcription, phrase search and groups up to 25.' },
  team: { name: 'Team', copy: 'Everything in Premium, groups up to 100, and Berea seats to give others.' },
  ministry: { name: 'Ministry', copy: 'Everything in Team, groups up to 300, and Berea seats to give others.' },
};

const APPEARANCES = [
  { value: 'warm', label: 'Warm', copy: 'The default GospelPad look.' },
  { value: 'dark', label: 'Dark', copy: 'Lower glare for evening reading.' },
  { value: 'contrast', label: 'Higher contrast', copy: 'Stronger text and borders.' },
] as const;

/** Profile and settings on one page, as in the mockups. */
export function AccountView({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const { appearance, setAppearance } = useDisplayPreferences();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [plan, setPlan] = useState<EntitlementSummary | null>(null);
  const [form, setForm] = useState<{ name: string; church: string; defaultNoteType: NoteType }>({
    name: '',
    church: '',
    defaultNoteType: NOTE_TYPES[0],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const [deletedNotes, setDeletedNotes] = useState<NoteRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [trashNotice, setTrashNotice] = useState<string | null>(null);

  useEffect(() => {
    setShowDeleteWarning(getShowDeleteWarningPreference());
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const [nextProfile, nextSummary, nextDeleted] = await Promise.all([
          loadAccountProfile(),
          loadAccountSummary(),
          listDeletedNotes(),
        ]);
        if (!active) return;
        setProfile(nextProfile);
        setSummary(nextSummary);
        setDeletedNotes(nextDeleted);
        setForm({
          name: nextProfile.name ?? '',
          church: nextProfile.church ?? '',
          defaultNoteType: NOTE_TYPES.includes((nextProfile.defaultNoteType ?? '') as NoteType)
            ? (nextProfile.defaultNoteType as NoteType)
            : NOTE_TYPES[0],
        });
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load your account.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    getMyEntitlements()
      .then((next) => active && setPlan(next))
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (loading || typeof window === 'undefined' || window.location.hash !== '#recently-deleted') return;
    document.getElementById('recently-deleted')?.scrollIntoView({ block: 'start' });
  }, [loading]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateAccountProfile(form);
      setProfile(await loadAccountProfile());
      setSuccess('Profile saved.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace('/auth/sign-in');
  };

  const removeFromTrash = (ids: string[]) => {
    const gone = new Set(ids);
    setDeletedNotes((current) => current.filter((note) => !gone.has(note.id)));
    setSelectedIds((current) => current.filter((id) => !gone.has(id)));
  };

  const runTrash = async (key: string, action: () => Promise<void>, done: string) => {
    try {
      setBusy(key);
      setTrashNotice(null);
      setError(null);
      await action();
      setTrashNotice(done);
    } catch (trashError) {
      setError(trashError instanceof Error ? trashError.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const onRestore = (note: NoteRecord) =>
    runTrash(
      `restore-${note.id}`,
      async () => {
        await restoreNote(note.id);
        removeFromTrash([note.id]);
        setSummary(await loadAccountSummary());
      },
      `“${note.title?.trim() || 'Untitled'}” is back in your notebook.`
    );

  const onDeleteForever = (note: NoteRecord) => {
    if (!window.confirm(`Delete “${note.title?.trim() || 'Untitled'}” forever? This can’t be undone.`)) return;
    void runTrash(
      `delete-${note.id}`,
      async () => {
        await permanentlyDeleteNote(note.id);
        removeFromTrash([note.id]);
      },
      'Note deleted forever.'
    );
  };

  const onDeleteSelected = () => {
    const ids = [...selectedIds];
    if (!ids.length || !window.confirm(`Delete ${ids.length} ${ids.length === 1 ? 'note' : 'notes'} forever? This can’t be undone.`)) return;
    void runTrash(
      'delete-selected',
      async () => {
        await permanentlyDeleteNotes(ids);
        removeFromTrash(ids);
      },
      `${ids.length} ${ids.length === 1 ? 'note' : 'notes'} deleted forever.`
    );
  };

  const onEmptyTrash = () => {
    if (!deletedNotes.length || !window.confirm('Delete everything in Recently deleted forever? This can’t be undone.')) return;
    void runTrash(
      'empty',
      async () => {
        await permanentlyDeleteAllDeletedNotes();
        setDeletedNotes([]);
        setSelectedIds([]);
      },
      'Recently deleted is empty.'
    );
  };

  const planInfo = PLAN_COPY[plan?.planCode ?? 'free'] ?? PLAN_COPY.free;
  const allTicked = deletedNotes.length > 0 && selectedIds.length === deletedNotes.length;

  return (
    <div className="page-container page-section account-page">
      <header className="notebook-header">
        <div>
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>Your account</span>
          <h1>
            Profile and <em>settings.</em>
          </h1>
        </div>
      </header>

      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}

      <div className="group-columns">
        <div className="group-main account-main">
          <form className="account-section" onSubmit={onSubmit}>
            <span className="rail-heading">Profile</span>
            {loading ? (
              <p className="composer-hint" role="status">Loading your details…</p>
            ) : (
              <>
                <div className="account-fields">
                  <label className="composer-field">
                    Name
                    <input onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} />
                  </label>
                  <label className="composer-field">
                    Church
                    <input onChange={(event) => setForm((current) => ({ ...current, church: event.target.value }))} value={form.church} />
                  </label>
                  <label className="composer-field">
                    Default note type
                    <select
                      onChange={(event) => setForm((current) => ({ ...current, defaultNoteType: event.target.value as NoteType }))}
                      value={form.defaultNoteType}
                    >
                      {NOTE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type === 'Prayer Requests' ? 'Prayer request' : type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="composer-field">
                    Email
                    <input disabled readOnly value={profile?.email ?? ''} />
                  </label>
                  <label className="composer-field">
                    Username
                    <input disabled readOnly value={profile?.username ? `@${profile.username}` : 'Not set'} />
                  </label>
                </div>
                <div className="account-actions">
                  <button className="button button-primary" disabled={saving} type="submit">
                    {saving ? 'Saving…' : 'Save profile'}
                  </button>
                  {success ? <span className="composer-hint" role="status">{success}</span> : null}
                </div>
              </>
            )}
          </form>

          <section className="account-section">
            <span className="rail-heading">Appearance</span>
            <div className="appearance-grid" role="radiogroup" aria-label="Appearance">
              {APPEARANCES.map((option) => (
                <label className={`appearance-card${appearance === option.value ? ' is-selected' : ''}`} key={option.value}>
                  <span className={`appearance-preview is-${option.value}`} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="appearance-label">
                    <input
                      checked={appearance === option.value}
                      name="appearance"
                      onChange={() => setAppearance(option.value)}
                      type="radio"
                    />
                    {option.label}
                  </span>
                  <span className="appearance-copy">{option.copy}</span>
                </label>
              ))}
            </div>
            <label className="group-check account-check">
              <input
                checked={showDeleteWarning}
                onChange={(event) => {
                  setShowDeleteWarning(event.target.checked);
                  setShowDeleteWarningPreference(event.target.checked);
                }}
                type="checkbox"
              />
              <span>Confirm before moving notes to recently deleted</span>
            </label>
          </section>

          <BereaSeatsSection />

          <section className="account-section" id="recently-deleted">
            <span className="rail-heading account-heading-row">
              <span>Recently deleted</span>
              <span className="account-heading-aside">Restore within 30 days</span>
            </span>
            {trashNotice ? <p className="composer-hint" role="status">{trashNotice}</p> : null}
            {loading ? null : deletedNotes.length === 0 ? (
              <p className="composer-hint">Nothing here. Notes you delete stay here for 30 days before they’re removed for good.</p>
            ) : (
              <>
                <div className="group-quick-actions">
                  <label className="select-all" style={{ marginLeft: 0 }}>
                    <input checked={allTicked} onChange={(event) => setSelectedIds(event.target.checked ? deletedNotes.map((note) => note.id) : [])} type="checkbox" />
                    Tick all ({deletedNotes.length})
                  </label>
                  <button
                    className="button button-vermilion"
                    disabled={!selectedIds.length || busy === 'delete-selected'}
                    onClick={onDeleteSelected}
                    type="button"
                  >
                    {busy === 'delete-selected' ? 'Deleting…' : `Delete forever${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
                  </button>
                  <button className="button button-secondary" disabled={busy === 'empty'} onClick={onEmptyTrash} type="button">
                    {busy === 'empty' ? 'Emptying…' : 'Empty all'}
                  </button>
                </div>
                <ul className="notebook-list">
                  {deletedNotes.map((note) => {
                    const deletedAt = note.deleted_at ? new Date(note.deleted_at) : null;
                    const daysLeft = deletedAt ? Math.max(0, 30 - Math.floor((Date.now() - deletedAt.getTime()) / 86400000)) : 30;
                    const selected = selectedIds.includes(note.id);
                    return (
                      <li key={note.id}>
                        <div className={`trash-row${selected ? ' is-selected' : ''}`}>
                          <input
                            aria-label={`Select ${note.title || 'note'}`}
                            checked={selected}
                            onChange={() =>
                              setSelectedIds((current) => (selected ? current.filter((id) => id !== note.id) : [...current, note.id]))
                            }
                            type="checkbox"
                          />
                          <span className="notebook-row-main">
                            <span className="notebook-row-title">{note.title?.trim() || 'Untitled'}</span>
                            <span className="notebook-row-excerpt">
                              {note.type === 'Prayer Requests' ? 'Prayer request' : note.type ?? 'Note'} · deleted{' '}
                              {deletedAt ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(deletedAt) : 'recently'} ·{' '}
                              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                            </span>
                          </span>
                          <button className="button button-secondary" disabled={busy === `restore-${note.id}`} onClick={() => void onRestore(note)} type="button">
                            {busy === `restore-${note.id}` ? 'Restoring…' : 'Restore'}
                          </button>
                          <button className="feed-link is-danger" disabled={busy === `delete-${note.id}`} onClick={() => onDeleteForever(note)} type="button">
                            {busy === `delete-${note.id}` ? 'Deleting…' : 'Delete forever'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>

        <aside className="group-rail">
          <section className="plan-card">
            <span className="plan-card-eyebrow">Your plan</span>
            <strong>{planInfo.name}</strong>
            <p>{planInfo.copy}</p>
            {summary ? (
              <span className="plan-card-stats">
                {summary.noteCount} {summary.noteCount === 1 ? 'note' : 'notes'} · {summary.groupCount} {summary.groupCount === 1 ? 'group' : 'groups'}
              </span>
            ) : null}
            <Link className="button" href="/pricing">
              {plan?.planCode && plan.planCode !== 'free' ? 'Change plan' : 'See plans'}
            </Link>
          </section>

          <section className="rail-section">
            <span className="rail-heading">Help and account</span>
            <ul className="account-links">
              <li>
                <a href="mailto:support@gospelpad.com?subject=GospelPad%20Help">Help and contact</a>
              </li>
              <li>
                <a href="mailto:support@gospelpad.com?subject=GospelPad%20Feedback">Send feedback</a>
              </li>
              <li>
                <Link href="/privacy">Privacy policy</Link>
              </li>
              <li>
                <Link href="/terms">Terms of service</Link>
              </li>
              <li>
                <Link href="/auth/forgot-password">Reset password</Link>
              </li>
              {isAdmin ? (
                <li>
                  <Link href="/admin/signups">Admin · sign-ups</Link>
                </li>
              ) : null}
              <li>
                <button className="is-danger" disabled={signingOut} onClick={signOut} type="button">
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </li>
            </ul>
            <span className="composer-hint">Version 1.0.0</span>
          </section>
        </aside>
      </div>
    </div>
  );
}
