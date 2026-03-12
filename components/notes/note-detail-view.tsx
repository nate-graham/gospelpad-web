'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getNoteById, softDeleteNote, type NoteRecord } from '@/lib/notes';
import { formatNoteDate } from '@/components/notes/note-utils';

export function NoteDetailView({ noteId }: { noteId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        </div>
        <h1>{note.title?.trim() || 'Untitled'}</h1>
        <p className="page-description">
          Updated {formatNoteDate(note.updated_at)} • Created {formatNoteDate(note.created_at)}
        </p>
      </header>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.8,
            color: 'var(--text)',
            fontSize: '1rem',
            minHeight: '220px',
          }}
        >
          {(note.body ?? '').trim() || 'No body content yet.'}
        </div>
      </section>

      <div className="cta-row">
        <Link className="button button-primary" href={`/notes/${note.id}/edit`}>
          Edit note
        </Link>
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
