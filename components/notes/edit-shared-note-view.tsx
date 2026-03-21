'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSharedNoteAccess, updateSharedNote, type NoteInput, type SharedNoteAccessSummary } from '@/lib/notes';
import { NoteForm } from '@/components/notes/note-form';

export function EditSharedNoteView({ noteId }: { noteId: string }) {
  const [share, setShare] = useState<SharedNoteAccessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getSharedNoteAccess(noteId);
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

  if (loading) {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Loading collaborative editor…</strong>
        <span style={{ color: 'var(--muted)' }}>Checking your access to this shared note.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Unable to open this shared note</strong>
        <span style={{ color: 'var(--muted)' }}>{error}</span>
        <Link className="button button-secondary" href={`/notes/shared/${noteId}`}>
          Back to shared note
        </Link>
      </section>
    );
  }

  if (!share?.note || !share.permissions.includes('edit')) {
    return (
      <section className="empty-state status-message" role="status">
        <strong>Collaboration is not available here</strong>
        <span style={{ color: 'var(--muted)' }}>
          This shared note is read-only for your account. The owner needs to share it with `edit` permission before you can collaborate on the original.
        </span>
        <Link className="button button-primary" href={`/notes/shared/${noteId}`}>
          Return to shared note
        </Link>
      </section>
    );
  }

  return (
    <NoteForm
      cancelHref={`/notes/shared/${noteId}`}
      editDescription="You are editing the original shared note. Changes here affect everyone who can access this note."
      editEyebrow="Collaborative note"
      editTitle="Edit shared note together"
      mode="edit"
      note={share.note}
      onSaveOverride={async (payload: NoteInput) => {
        await updateSharedNote(noteId, payload);
        return `/notes/shared/${noteId}?updated=1`;
      }}
    />
  );
}
