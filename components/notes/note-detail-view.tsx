'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { duplicateNote, getNoteById, type NoteGroupShare, softDeleteNote, type NoteRecord } from '@/lib/notes';
import {
  formatNoteDate,
  getNoteReadingTimeMinutes,
  getNoteTypeGuidance,
  getNoteWordCount,
  getScriptureReferenceCount,
} from '@/components/notes/note-utils';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';
import { ScriptureReferenceText } from '@/components/notes/scripture-reference-text';
import { findScriptureReferences } from '@/lib/scripture-references';
import { NoteSharePanel } from '@/components/notes/note-share-panel';

export function NoteDetailView({ noteId }: { noteId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [groupShares, setGroupShares] = useState<NoteGroupShare[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getNoteById(noteId);
        if (!active) return;
        setNote(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load note.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [noteId]);

  const successMessage = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Note created successfully.';
    if (searchParams.get('updated') === '1') return 'Note updated successfully.';
    return null;
  }, [searchParams]);

  const detectedReferences = useMemo(
    () => findScriptureReferences(note?.body ?? ''),
    [note?.body]
  );
  const wordCount = useMemo(() => getNoteWordCount(note ?? { body: '' } as NoteRecord), [note]);
  const readingMinutes = useMemo(() => getNoteReadingTimeMinutes(note ?? { body: '' } as NoteRecord), [note]);
  const scriptureCount = useMemo(() => getScriptureReferenceCount(note ?? { body: '' } as NoteRecord), [note]);

  const onDelete = async () => {
    const confirmed = window.confirm('Delete this note? It will move into the existing soft-delete path.');
    if (!confirmed) return;

    try {
      setDeleting(true);
      await softDeleteNote(noteId);
      router.replace('/notes?deleted=1');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete note.');
      setDeleting(false);
    }
  };

  const onDuplicate = async () => {
    if (!note) return;

    try {
      setDuplicating(true);
      const duplicateId = await duplicateNote(note);
      router.replace(`/notes/${duplicateId}?created=1`);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Failed to duplicate note.');
      setDuplicating(false);
    }
  };

  if (loading) {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Loading note…</strong>
        <span style={{ color: 'var(--muted)' }}>Pulling the latest note contents from Supabase.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Unable to load note</strong>
        <span style={{ color: 'var(--muted)' }}>{error}</span>
        <Link className="button button-secondary" href="/notes">
          Back to notes
        </Link>
      </section>
    );
  }

  if (!note || note.deleted_at) {
    return (
      <section className="empty-state status-message" role="status">
        <strong>Note not found</strong>
        <span style={{ color: 'var(--muted)' }}>This note may have been deleted or may not belong to this account.</span>
        <Link className="button button-primary" href="/notes">
          Return to notes
        </Link>
      </section>
    );
  }

  return (
    <div className="page-section">
      <header className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', alignItems: 'center' }}>
          <span className="badge">{note.type ?? 'Note'}</span>
          {note.speaker ? <span style={{ color: 'var(--muted)' }}>Speaker: {note.speaker}</span> : null}
          {note.status ? <span style={{ color: 'var(--muted)' }}>Status: {note.status}</span> : null}
          {note.type === 'Dream' && note.is_lucid_dream ? <span style={{ color: 'var(--muted)' }}>Lucid dream</span> : null}
          {note.type === 'Dream' && note.dream_role ? <span style={{ color: 'var(--muted)' }}>Role: {note.dream_role}</span> : null}
        </div>
        <h1>{note.title?.trim() || 'Untitled'}</h1>
        <p className="page-description">
          Updated {formatNoteDate(note.updated_at)} • Created {formatNoteDate(note.created_at)}
        </p>
      </header>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}

      {activeReference ? (
        <ScriptureReferencePreview
          onClose={() => setActiveReference(null)}
          reference={activeReference}
        />
      ) : null}

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div
          style={{
            display: 'grid',
            gap: '0.85rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          <article className="status-card" style={{ padding: '1rem' }}>
            <span className="eyebrow">Length</span>
            <strong style={{ fontSize: '1.2rem' }}>{wordCount} words</strong>
            <span style={{ color: 'var(--muted)' }}>{readingMinutes} min read</span>
          </article>
          <article className="status-card" style={{ padding: '1rem' }}>
            <span className="eyebrow">Scripture</span>
            <strong style={{ fontSize: '1.2rem' }}>{scriptureCount}</strong>
            <span style={{ color: 'var(--muted)' }}>
              {scriptureCount === 1 ? 'reference detected' : 'references detected'}
            </span>
          </article>
          <article className="status-card" style={{ padding: '1rem' }}>
            <span className="eyebrow">Note type</span>
            <strong style={{ fontSize: '1.2rem' }}>{note.type ?? 'Note'}</strong>
            <span style={{ color: 'var(--muted)' }}>{note.status?.trim() || 'No explicit status set'}</span>
          </article>
          {note.type === 'Dream' ? (
            <article className="status-card" style={{ padding: '1rem' }}>
              <span className="eyebrow">Dream metadata</span>
              <strong style={{ fontSize: '1.2rem' }}>
                {note.is_lucid_dream ? 'Lucid dream' : 'Standard dream'}
              </strong>
              <span style={{ color: 'var(--muted)' }}>
                {note.dream_role ? `You were ${note.dream_role} in the dream.` : 'No dream role recorded.'}
              </span>
            </article>
          ) : null}
        </div>

        <div className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Reading guidance</span>
          <strong style={{ fontSize: '1.05rem' }}>Built for {note.type ?? 'general note'} reading</strong>
          <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{getNoteTypeGuidance(note.type)}</span>
        </div>

        <div className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Visibility</span>
          <strong style={{ fontSize: '1.05rem' }}>
            {groupShares.length > 0 ? `Shared to ${groupShares.length} group${groupShares.length === 1 ? '' : 's'}` : 'Private note'}
          </strong>
          <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            {groupShares.length > 0
              ? groupShares.map((share) => share.group_name).join(', ')
              : 'This note is currently visible only to you.'}
          </span>
        </div>

        {detectedReferences.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <span className="eyebrow">Detected references</span>
            <div className="cta-row">
              {detectedReferences.map((reference) => (
                <button
                  className="button button-secondary"
                  key={reference}
                  onClick={() => setActiveReference(reference)}
                  type="button"
                >
                  {reference}
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
              onReferenceClick={setActiveReference}
              text={(note.body ?? '').trim()}
            />
          ) : (
            'No body content yet.'
          )}
        </div>
      </section>

      <NoteSharePanel note={note} onSharesUpdated={setGroupShares} />

      <div className="cta-row">
        <Link className="button button-primary" href={`/notes/${note.id}/edit`}>
          Edit note
        </Link>
        <button className="button button-secondary" disabled={duplicating} onClick={onDuplicate} type="button">
          {duplicating ? 'Duplicating…' : 'Duplicate note'}
        </button>
        <button className="button button-ghost" disabled={deleting} onClick={onDelete} type="button">
          {deleting ? 'Deleting…' : 'Delete note'}
        </button>
        <Link className="button button-secondary" href="/notes">
          Back to list
        </Link>
      </div>
    </div>
  );
}
