'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { duplicateNote, getReceivedSharedNote, type ReceivedSharedNoteSummary } from '@/lib/notes';
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
import { SharedNoteComments } from '@/components/notes/shared-note-comments';
import { NoteClipsList } from '@/components/notes/note-clips-list';
import { useRouter } from 'next/navigation';

export function ReceivedSharedNoteView({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [share, setShare] = useState<ReceivedSharedNoteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getReceivedSharedNote(noteId);
        if (!active) return;
        setShare(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load shared note.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [noteId]);

  const note = share?.note ?? null;
  const references = useMemo(() => findScriptureReferences(note?.body ?? ''), [note?.body]);
  const wordCount = useMemo(() => getNoteWordCount(note ?? { body: '' }), [note]);
  const readingMinutes = useMemo(() => getNoteReadingTimeMinutes(note ?? { body: '' }), [note]);
  const scriptureCount = useMemo(() => getScriptureReferenceCount(note ?? { body: '' }), [note]);
  const canEditSharedNote = share?.permissions.includes('edit') ?? false;

  const onCopyToMyNotes = async () => {
    if (!note) return;

    try {
      setDuplicating(true);
      const duplicateId = await duplicateNote(note);
      router.push(`/notes/${duplicateId}/edit?copied=1&from=direct-share`);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Failed to copy shared note.');
    } finally {
      setDuplicating(false);
    }
  };

  if (loading) {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Loading shared note…</strong>
        <span style={{ color: 'var(--muted)' }}>Getting the latest shared note.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Unable to load shared note</strong>
        <span style={{ color: 'var(--muted)' }}>{error}</span>
        <Link className="button button-secondary" href="/notes">
          Back to notes
        </Link>
      </section>
    );
  }

  if (!share || !note) {
    return (
      <section className="empty-state status-message" role="status">
        <strong>Shared note not found</strong>
        <span style={{ color: 'var(--muted)' }}>
          This note may have been unshared or may no longer be available to this account.
        </span>
        <Link className="button button-primary" href="/notes">
          Return to notes
        </Link>
      </section>
    );
  }

  return (
    <div className="page-container page-section">
      <header className="hero-surface">
        <div className="meta-row">
          <span className="badge">{note.type ?? 'Shared note'}</span>
          <span>Shared by {share.shared_by_label}</span>
          <span>Permission: {share.permissions.join(', ')}</span>
        </div>
        <h1>{note.title?.trim() || 'Untitled'}</h1>
        <p className="page-description">
          Shared {formatNoteDate(share.shared_at)} • Updated {formatNoteDate(note.updated_at)}
        </p>
      </header>

      <div className="note-detail-layout">
        <div className="note-detail-main">
          <section className="reading-surface" style={{ background: 'transparent', padding: 0, gap: '1.25rem' }}>
            <div className="meta-row">
              <span>{wordCount} words</span>
              <span>{readingMinutes} min read</span>
              <span>{scriptureCount} ref{scriptureCount === 1 ? '' : 's'}</span>
            </div>
            <div
              className="note-body-content"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.9,
                color: 'var(--text)',
                fontSize: '1.02rem',
                minHeight: '220px',
              }}
            >
              {(note.body ?? '').trim() ? (
                <ScriptureReferenceText text={(note.body ?? '').trim()} onReferenceClick={setActiveReference} />
              ) : (
                'No body content yet.'
              )}
            </div>
          </section>

          {note.clips?.length ? <NoteClipsList clips={note.clips} title="Shared audio clips" /> : null}

          <SharedNoteComments noteId={note.id} />

          <div className="cta-row">
            {canEditSharedNote ? (
              <Link className="button button-primary" href={`/notes/shared/${note.id}/edit`}>
                Edit together
              </Link>
            ) : null}
            <button className="button button-primary" type="button" disabled={duplicating} onClick={onCopyToMyNotes}>
              {duplicating ? 'Copying…' : 'Copy to my notes'}
            </button>
            <Link className="button button-secondary" href="/notes">
              Back to notes
            </Link>
          </div>
        </div>

        <aside className="note-detail-rail">
          {activeReference ? (
            <ScriptureReferencePreview reference={activeReference} onClose={() => setActiveReference(null)} />
          ) : null}

          <div className="inline-support-stack">
            <div className="support-block">
              <span className="eyebrow">Preview</span>
              <strong className="support-block-title">{getNoteExcerpt(note)}</strong>
            </div>
          </div>

          {references.length > 0 ? (
            <div className="inline-support-stack">
              <span className="eyebrow">Detected references</span>
              <div className="note-reference-row">
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
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
