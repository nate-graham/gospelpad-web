'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getGroupSharedNoteById, type GroupSharedNoteSummary } from '@/lib/groups';
import {
  formatNoteDate,
  getNoteExcerpt,
  getNoteReadingTimeMinutes,
  getScriptureReferenceCount,
  getNoteWordCount,
} from '@/components/notes/note-utils';
import { findScriptureReferences } from '@/lib/scripture-references';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';
import { ScriptureReferenceText } from '@/components/notes/scripture-reference-text';

export function GroupSharedNoteView({
  groupId,
  noteId,
}: {
  groupId: string;
  noteId: string;
}) {
  const [note, setNote] = useState<GroupSharedNoteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReference, setActiveReference] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const nextNote = await getGroupSharedNoteById(groupId, noteId);
        if (!active) return;
        setNote(nextNote);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load group note.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [groupId, noteId]);

  const references = useMemo(() => findScriptureReferences(note?.body ?? ''), [note?.body]);
  const wordCount = useMemo(() => getNoteWordCount(note ?? { body: '' }), [note]);
  const readingMinutes = useMemo(() => getNoteReadingTimeMinutes(note ?? { body: '' }), [note]);
  const scriptureCount = useMemo(() => getScriptureReferenceCount(note ?? { body: '' }), [note]);

  if (loading) {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Loading shared note…</strong>
        <span style={{ color: 'var(--muted)' }}>Checking the group-scoped note access path.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Unable to load shared note</strong>
        <span style={{ color: 'var(--muted)' }}>{error}</span>
        <Link className="button button-secondary" href={`/groups/${groupId}`}>
          Back to group
        </Link>
      </section>
    );
  }

  if (!note) {
    return (
      <section className="empty-state status-message" role="status">
        <strong>Shared note not found</strong>
        <span style={{ color: 'var(--muted)' }}>
          This note may no longer be shared with the current group or may not be visible to this account.
        </span>
        <Link className="button button-primary" href={`/groups/${groupId}`}>
          Return to group
        </Link>
      </section>
    );
  }

  return (
    <div className="page-section">
      <header className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', alignItems: 'center' }}>
          <span className="badge">{note.type ?? 'Shared note'}</span>
          <span style={{ color: 'var(--muted)' }}>Permission: {note.permissions}</span>
          {note.speaker ? <span style={{ color: 'var(--muted)' }}>Speaker: {note.speaker}</span> : null}
        </div>
        <h1>{note.title?.trim() || 'Untitled'}</h1>
        <p className="page-description">
          Shared to this group {formatNoteDate(note.shared_at)} • Updated {formatNoteDate(note.updated_at)}
        </p>
      </header>

      {activeReference ? (
        <ScriptureReferencePreview reference={activeReference} onClose={() => setActiveReference(null)} />
      ) : null}

      <section
        style={{
          display: 'grid',
          gap: '0.85rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        }}
      >
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Length</span>
          <strong style={{ fontSize: '1.15rem' }}>{wordCount} words</strong>
          <span style={{ color: 'var(--muted)' }}>{readingMinutes} min read</span>
        </article>
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Scripture</span>
          <strong style={{ fontSize: '1.15rem' }}>{scriptureCount}</strong>
          <span style={{ color: 'var(--muted)' }}>
            {scriptureCount === 1 ? 'reference detected' : 'references detected'}
          </span>
        </article>
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Preview</span>
          <strong style={{ fontSize: '1.05rem' }}>{getNoteExcerpt(note)}</strong>
          <span style={{ color: 'var(--muted)' }}>
            Group notes surface currently follows the existing note sharing model.
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
            <ScriptureReferenceText
              text={(note.body ?? '').trim()}
              onReferenceClick={setActiveReference}
            />
          ) : (
            'No body content yet.'
          )}
        </div>
      </section>

      <div className="cta-row">
        <Link className="button button-secondary" href={`/groups/${groupId}`}>
          Back to group
        </Link>
      </div>
    </div>
  );
}
