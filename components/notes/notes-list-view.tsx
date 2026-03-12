'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { listNotes, type NoteRecord } from '@/lib/notes';
import { formatNoteDate, getNoteExcerpt } from '@/components/notes/note-utils';

export function NotesListView() {
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listNotes();
        if (!active) return;
        setNotes(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load notes.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const successMessage = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Note created successfully.';
    if (searchParams.get('updated') === '1') return 'Note updated successfully.';
    if (searchParams.get('deleted') === '1') return 'Note deleted successfully.';
    return null;
  }, [searchParams]);

  const noteCountLabel = notes.length === 1 ? '1 note' : `${notes.length} notes`;

  return (
    <div className="page-section">
      <header
        className="page-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div className="page-header">
          <span className="eyebrow">V1 Notes</span>
          <h1>Your notes</h1>
          <p className="page-description">
            Simple, reliable note capture for web. This V1 deliberately focuses on durable CRUD and responsive reading/editing.
          </p>
        </div>
        <div className="cta-row">
          <Link className="button button-primary" href="/notes/new">
            New note
          </Link>
        </div>
      </header>

      {successMessage ? <div className="empty-state status-message" role="status" aria-live="polite">{successMessage}</div> : null}

      <section className="responsive-grid compact">
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Library</span>
          <strong style={{ fontSize: '1.5rem' }}>{noteCountLabel}</strong>
          <span style={{ color: 'var(--muted)' }}>All notes are loaded from the existing Supabase `notes` table.</span>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Editor Scope</span>
          <strong style={{ fontSize: '1.5rem' }}>V1 plain editor</strong>
          <span style={{ color: 'var(--muted)' }}>Rich text, audio, and advanced attachments stay deferred for now.</span>
        </article>
      </section>

      {loading ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading notes…</strong>
          <span style={{ color: 'var(--muted)' }}>Fetching your latest notes from Supabase.</span>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="error-state status-message" role="alert">
          <strong>Unable to load notes</strong>
          <span style={{ color: 'var(--muted)' }}>{error}</span>
          <Link className="button button-secondary" href="/notes">
            Refresh
          </Link>
        </section>
      ) : null}

      {!loading && !error && notes.length === 0 ? (
        <section className="empty-state status-message" role="status">
          <strong>No notes yet</strong>
          <span style={{ color: 'var(--muted)' }}>
            Start with a church note, study note, journal entry, or dream note.
          </span>
          <div className="cta-row">
            <Link className="button button-primary" href="/notes/new">
              Create your first note
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && !error && notes.length > 0 ? (
        <section className="responsive-grid">
          {notes.map((note) => (
            <article
              key={note.id}
              className="panel"
              style={{
                padding: '1rem',
                display: 'grid',
                gap: '0.85rem',
                alignContent: 'start',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <span className="badge">{note.type ?? 'Note'}</span>
                  <strong style={{ fontSize: '1.1rem', lineHeight: 1.3 }}>
                    {note.title?.trim() || 'Untitled'}
                  </strong>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'right' }}>
                  {formatNoteDate(note.updated_at)}
                </span>
              </div>
              <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{getNoteExcerpt(note)}</span>
              {note.speaker ? (
                <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>Speaker: {note.speaker}</span>
              ) : null}
              <div className="cta-row">
                <Link className="button button-primary" href={`/notes/${note.id}`}>
                  Open
                </Link>
                <Link className="button button-secondary" href={`/notes/${note.id}/edit`}>
                  Edit
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
