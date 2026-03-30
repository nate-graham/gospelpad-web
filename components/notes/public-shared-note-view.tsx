'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { duplicatePublicNote, getPublicSharedNote, type PublicSharedNoteRecord } from '@/lib/notes';
import {
  formatNoteDate,
  getNoteExcerpt,
  getNoteReadingTimeMinutes,
  getNoteWordCount,
  getScriptureReferenceCount,
} from '@/components/notes/note-utils';
import { findScriptureReferences } from '@/lib/scripture-references';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';
import { ScriptureReferenceText } from '@/components/notes/scripture-reference-text';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function PublicSharedNoteView({ shareToken }: { shareToken: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [note, setNote] = useState<PublicSharedNoteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyHandled, setCopyHandled] = useState(false);

  const copyRedirectPath = useMemo(() => `/s/${shareToken}?copy=1`, [shareToken]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPublicSharedNote(shareToken);
        if (!active) return;
        setNote(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load the shared note.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [shareToken]);

  useEffect(() => {
    let active = true;

    const loadAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          if (active) setAuthenticated(false);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;
        setAuthenticated(Boolean(user?.id));
      } catch {
        if (!active) return;
        setAuthenticated(false);
      }
    };

    void loadAuth();

    return () => {
      active = false;
    };
  }, []);

  const onCopyToMyNotes = async () => {
    if (!note || copying) return;

    try {
      setCopying(true);
      setError(null);
      const duplicateId = await duplicatePublicNote(note);
      setCopyHandled(true);
      router.push(`/notes/${duplicateId}/edit?copied=1&from=public-share`);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Failed to copy this shared note.');
      setCopying(false);
    }
  };

  useEffect(() => {
    if (!note || !authenticated || copyHandled || searchParams.get('copy') !== '1') {
      return;
    }

    void onCopyToMyNotes();
  }, [authenticated, copyHandled, note, searchParams]);

  const references = useMemo(() => findScriptureReferences(note?.body ?? ''), [note?.body]);
  const wordCount = useMemo(() => getNoteWordCount(note ?? { body: '' }), [note]);
  const readingMinutes = useMemo(() => getNoteReadingTimeMinutes(note ?? { body: '' }), [note]);
  const scriptureCount = useMemo(() => getScriptureReferenceCount(note ?? { body: '' }), [note]);

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading shared note…</strong>
          <span style={{ color: 'var(--muted)' }}>Opening the public read-only version of this note.</span>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <section className="error-state status-message" role="alert">
          <strong>Unable to load this shared note</strong>
          <span style={{ color: 'var(--muted)' }}>{error}</span>
          <div className="cta-row">
            <Link className="button button-primary" href={`/auth/sign-up?next=${encodeURIComponent(copyRedirectPath)}`}>
              Sign up for GospelPad
            </Link>
            <Link className="button button-secondary" href={`/auth/sign-in?next=${encodeURIComponent(copyRedirectPath)}`}>
              Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!note) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <section className="empty-state status-message" role="status">
          <strong>Shared note not found</strong>
          <span style={{ color: 'var(--muted)' }}>
            This link may have expired or the note may no longer be available.
          </span>
          <Link className="button button-primary" href={`/auth/sign-up?next=${encodeURIComponent(copyRedirectPath)}`}>
            Create an account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: '1rem', display: 'grid', justifyItems: 'center' }}>
      <div className="page-section shell-page" style={{ width: 'min(100%, 960px)', paddingBottom: '2rem' }}>
        <header className="page-header">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', alignItems: 'center' }}>
            <span className="badge">{note.type ?? 'Shared note'}</span>
            <span style={{ color: 'var(--muted)' }}>Read-only public share</span>
          </div>
          <h1>{note.title?.trim() || 'Untitled'}</h1>
          <p className="page-description">
            Updated {formatNoteDate(note.updated_at)} • {wordCount} words • {readingMinutes} min read
          </p>
        </header>

        {activeReference ? (
          <ScriptureReferencePreview reference={activeReference} onClose={() => setActiveReference(null)} />
        ) : null}

        <section className="responsive-grid compact">
          <article className="status-card" style={{ padding: '1rem' }}>
            <span className="eyebrow">Preview</span>
            <strong style={{ fontSize: '1.05rem' }}>{getNoteExcerpt(note)}</strong>
            <span style={{ color: 'var(--muted)' }}>You can read the full note here, then sign up to save your own copy or collaborate.</span>
          </article>
          <article className="status-card" style={{ padding: '1rem' }}>
            <span className="eyebrow">Scripture</span>
            <strong style={{ fontSize: '1.05rem' }}>{scriptureCount}</strong>
            <span style={{ color: 'var(--muted)' }}>
              {scriptureCount === 1 ? 'reference detected' : 'references detected'}
            </span>
          </article>
        </section>

        {references.length > 0 ? (
          <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            <span className="eyebrow">Detected references</span>
            <div className="cta-row">
              {references.map((reference) => (
                <button
                  key={reference}
                  type="button"
                  className="button button-secondary"
                  onClick={() => setActiveReference(reference)}
                >
                  {reference}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel" style={{ padding: '1rem' }}>
          <div
            className="note-body-content"
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.8,
              color: 'var(--text)',
              fontSize: '1rem',
              minHeight: '220px',
              padding: '0.25rem 0',
            }}
          >
            {(note.body ?? '').trim() ? (
              <ScriptureReferenceText text={(note.body ?? '').trim()} onReferenceClick={setActiveReference} />
            ) : (
              'No body content yet.'
            )}
          </div>
        </section>

        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
          <span className="eyebrow">Keep going in GospelPad</span>
          <strong style={{ fontSize: '1.05rem' }}>
            {authenticated ? 'Copy this note into your own library and keep editing from there.' : 'Create an account to copy this note into your own library and keep editing.'}
          </strong>
          <div className="cta-row">
            {authenticated ? (
              <button className="button button-primary" disabled={copying} onClick={() => void onCopyToMyNotes()} type="button">
                {copying ? 'Copying…' : 'Copy to my notes'}
              </button>
            ) : (
              <>
                <Link className="button button-primary" href={`/auth/sign-up?next=${encodeURIComponent(copyRedirectPath)}`}>
                  Sign up
                </Link>
                <Link className="button button-secondary" href={`/auth/sign-in?next=${encodeURIComponent(copyRedirectPath)}`}>
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
