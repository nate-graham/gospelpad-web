'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getNoteById, type NoteRecord } from '@/lib/notes';
import { NoteForm } from '@/components/notes/note-form';

export function EditNoteView({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Loading note editor…</strong>
        <span style={{ color: 'var(--muted)' }}>Fetching the current note before editing.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Unable to open this note</strong>
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
        <strong>Note not available</strong>
        <span style={{ color: 'var(--muted)' }}>This note may have been deleted or may not belong to your account.</span>
        <Link className="button button-primary" href="/notes">
          Return to notes
        </Link>
      </section>
    );
  }

  return <NoteForm mode="edit" note={note} />;
}
