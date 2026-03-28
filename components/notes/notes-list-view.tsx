'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createNote, listNotes, listReceivedSharedNotes, NOTE_TYPES, softDeleteNotes, type NoteListQuery, type NoteRecord, type ReceivedSharedNoteSummary } from '@/lib/notes';
import { formatNoteDate, getNoteExcerpt } from '@/components/notes/note-utils';
import { DeleteNotesDialog } from '@/components/notes/delete-notes-dialog';
import { getShowDeleteWarningPreference, setShowDeleteWarningPreference } from '@/lib/delete-warning-preference';
import { ScriptureSearchPanel } from '@/components/notes/scripture-search-panel';
import type { ScriptureResult } from '@/lib/scripture';

export function NotesListView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [receivedSharedNotes, setReceivedSharedNotes] = useState<ReceivedSharedNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  const query = useMemo<NoteListQuery>(
    () => ({
      search: searchParams.get('q') ?? '',
      type: (searchParams.get('type') as NoteListQuery['type']) ?? 'all',
      status: (searchParams.get('status') as NoteListQuery['status']) ?? 'all',
      scope: (searchParams.get('scope') as NoteListQuery['scope']) ?? 'personal',
      sort: (searchParams.get('sort') as NoteListQuery['sort']) ?? 'updated-desc',
    }),
    [searchParams]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, received] = await Promise.all([
          listNotes(query),
          listReceivedSharedNotes(),
        ]);
        if (!active) return;
        setNotes(data);
        setReceivedSharedNotes(received);
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
  }, [query]);

  const successMessage = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Note created successfully.';
    if (searchParams.get('updated') === '1') return 'Note updated successfully.';
    if (searchParams.get('deleted') === '1') return 'Note deleted successfully.';
    return inlineNotice;
  }, [inlineNotice, searchParams]);

  const noteCountLabel = notes.length === 1 ? '1 note' : `${notes.length} notes`;

  const activeFilterCount = useMemo(() => {
    return [
      query.search?.trim(),
      query.type && query.type !== 'all' ? query.type : '',
      query.status && query.status !== 'all' ? query.status : '',
      query.scope && query.scope !== 'personal' ? query.scope : '',
      query.sort && query.sort !== 'updated-desc' ? query.sort : '',
    ].filter(Boolean).length;
  }, [query]);

  const updateQuery = (updates: Partial<NoteListQuery>) => {
    const next = new URLSearchParams(searchParams.toString());

    const merged: NoteListQuery = {
      ...query,
      ...updates,
    };

    setParam(next, 'q', merged.search?.trim() ?? '', '');
    setParam(next, 'type', merged.type ?? 'all', 'all');
    setParam(next, 'status', merged.status ?? 'all', 'all');
    setParam(next, 'scope', merged.scope ?? 'personal', 'personal');
    setParam(next, 'sort', merged.sort ?? 'updated-desc', 'updated-desc');

    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  };

  const resetFilters = () => {
    router.replace(pathname);
  };

  const toggleSelectionMode = () => {
    setSelectionMode((current) => {
      if (current) {
        setSelectedNoteIds([]);
      }
      return !current;
    });
  };

  const toggleSelectedNote = (noteId: string) => {
    setSelectedNoteIds((current) =>
      current.includes(noteId) ? current.filter((id) => id !== noteId) : [...current, noteId]
    );
  };

  const requestDeleteSelected = () => {
    if (selectedNoteIds.length === 0) return;
    if (getShowDeleteWarningPreference()) {
      setDeleteDialogOpen(true);
      return;
    }
    void confirmDeleteSelected(false);
  };

  const confirmDeleteSelected = async (hideWarningNextTime: boolean) => {
    if (selectedNoteIds.length === 0) return;
    if (hideWarningNextTime) {
      setShowDeleteWarningPreference(false);
    }

    try {
      setDeletingSelected(true);
      setDeleteDialogOpen(false);
      await softDeleteNotes(selectedNoteIds);
      setNotes((current) => current.filter((note) => !selectedNoteIds.includes(note.id)));
      setInlineNotice(
        selectedNoteIds.length === 1
          ? 'Note moved to recently deleted.'
          : `${selectedNoteIds.length} notes moved to recently deleted.`
      );
      setSelectedNoteIds([]);
      setSelectionMode(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete notes.');
    } finally {
      setDeletingSelected(false);
    }
  };

  const createScriptureNote = async (payload: string, result: ScriptureResult) => {
    const noteId = await createNote({
      title: result.reference,
      body: payload,
      speaker: '',
      type: 'Church notes',
    });
    router.push(`/notes/${noteId}/edit?created=1&from=scripture-search`);
  };

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
          <span className="eyebrow">Notes</span>
          <h1>Your notes</h1>
          <p className="page-description">
            Capture, organize, dictate, share, and revisit your notes across phone, tablet, and desktop.
          </p>
        </div>
        <div className="cta-row">
          <button className="button button-secondary" onClick={toggleSelectionMode} type="button">
            {selectionMode ? 'Cancel select' : 'Select'}
          </button>
          {selectionMode ? (
            <button
              className="button button-ghost"
              disabled={selectedNoteIds.length === 0 || deletingSelected}
              onClick={requestDeleteSelected}
              type="button"
            >
              {deletingSelected ? 'Deleting…' : selectedNoteIds.length > 0 ? `Delete selected (${selectedNoteIds.length})` : 'Delete selected'}
            </button>
          ) : null}
          <Link className="button button-secondary" href="/notes/dictate">
            Dictate note
          </Link>
          <Link className="button button-primary" href="/notes/new">
            New note
          </Link>
        </div>
      </header>

      {successMessage ? <div className="empty-state status-message" role="status" aria-live="polite">{successMessage}</div> : null}

      <details className="panel" style={{ padding: '0.9rem 1rem' }}>
        <summary style={summaryStyle}>
          <span>Overview</span>
          <span style={summaryMetaStyle}>
            {noteCountLabel} • {receivedSharedNotes.length} shared • Scripture-aware editor
          </span>
        </summary>
        <section className="responsive-grid compact" style={{ marginTop: '0.85rem' }}>
          <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Library</span>
            <strong style={{ fontSize: '1.5rem' }}>{noteCountLabel}</strong>
            <span style={{ color: 'var(--muted)' }}>
              {activeFilterCount > 0
                ? `${activeFilterCount} active discovery filter${activeFilterCount === 1 ? '' : 's'}.`
                : 'Everything you have saved is ready to browse here.'}
            </span>
          </article>
          <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Shared with you</span>
            <strong style={{ fontSize: '1.5rem' }}>
              {receivedSharedNotes.length} {receivedSharedNotes.length === 1 ? 'note' : 'notes'}
            </strong>
            <span style={{ color: 'var(--muted)' }}>
              Notes other people share with you will appear here.
            </span>
          </article>
          <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Writing tools</span>
            <strong style={{ fontSize: '1.5rem' }}>Scripture-aware editor</strong>
          </article>
        </section>
      </details>

      <details className="panel" style={{ padding: '0.9rem 1rem' }}>
        <summary style={summaryStyle}>
          <span>Discovery</span>
          <span style={summaryMetaStyle}>
            {activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : 'Search, filter, and sort'}
          </span>
        </summary>
        <section style={{ marginTop: '0.85rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Discovery</span>
            <strong style={{ fontSize: '1.1rem' }}>Search, filter, and sort your notes</strong>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '0.85rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Search</span>
              <input
                onChange={(event) => updateQuery({ search: event.target.value })}
                placeholder="Search title, speaker, or note body"
                style={inputStyle}
                value={query.search ?? ''}
              />
            </label>

            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Type</span>
              <select
                onChange={(event) => updateQuery({ type: event.target.value as NoteListQuery['type'] })}
                style={inputStyle}
                value={query.type ?? 'all'}
              >
                <option value="all">All note types</option>
                {NOTE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Status</span>
              <select
                onChange={(event) => updateQuery({ status: event.target.value as NoteListQuery['status'] })}
                style={inputStyle}
                value={query.status ?? 'all'}
              >
                <option value="all">Any status</option>
                <option value="with-status">Has status</option>
                <option value="no-status">No status</option>
              </select>
            </label>

            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Scope</span>
              <select
                onChange={(event) => updateQuery({ scope: event.target.value as NoteListQuery['scope'] })}
                style={inputStyle}
                value={query.scope ?? 'personal'}
              >
                <option value="personal">Personal notes</option>
                <option value="all">All available notes</option>
                <option value="group">Group-linked notes</option>
              </select>
            </label>

            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Sort</span>
              <select
                onChange={(event) => updateQuery({ sort: event.target.value as NoteListQuery['sort'] })}
                style={inputStyle}
                value={query.sort ?? 'updated-desc'}
              >
                <option value="updated-desc">Recently updated</option>
                <option value="updated-asc">Oldest updated</option>
                <option value="created-desc">Recently created</option>
                <option value="created-asc">Oldest created</option>
                <option value="title-asc">Title A-Z</option>
              </select>
            </label>
          </div>

          <div className="cta-row">
            <button className="button button-secondary" onClick={resetFilters} type="button">
              Reset filters
            </button>
          </div>
        </section>
      </details>

      <details className="panel" style={{ padding: '0.9rem 1rem' }}>
        <summary style={summaryStyle}>
          <span>Scripture search</span>
          <span style={summaryMetaStyle}>Reference, phrase, or keyword</span>
        </summary>
        <div style={{ marginTop: '0.85rem' }}>
          <ScriptureSearchPanel compact onCreateNote={createScriptureNote} />
        </div>
      </details>

      {loading ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading notes…</strong>
          <span style={{ color: 'var(--muted)' }}>Fetching your latest notes.</span>
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
          <strong>{activeFilterCount > 0 ? 'No notes match these filters' : 'No notes yet'}</strong>
          <span style={{ color: 'var(--muted)' }}>
            {activeFilterCount > 0
              ? 'Try broadening your search or resetting the current note filters.'
              : 'Start with a church note, study note, journal entry, dream note, or prayer request.'}
          </span>
          <div className="cta-row">
            {activeFilterCount > 0 ? (
              <button className="button button-secondary" onClick={resetFilters} type="button">
                Reset filters
              </button>
            ) : (
              <Link className="button button-primary" href="/notes/new">
                Create your first note
              </Link>
            )}
          </div>
        </section>
      ) : null}

      {!loading && !error && notes.length > 0 ? (
        <section className="responsive-grid">
          {notes.map((note) => (
            <article
              key={note.id}
              className="panel"
              onClick={() => {
                if (selectionMode) {
                  toggleSelectedNote(note.id);
                  return;
                }
                router.push(`/notes/${note.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (selectionMode) {
                    toggleSelectedNote(note.id);
                    return;
                  }
                  router.push(`/notes/${note.id}`);
                }
              }}
              role="button"
              aria-pressed={selectionMode ? selectedNoteIds.includes(note.id) : undefined}
              tabIndex={0}
              style={{
                padding: '1rem',
                display: 'grid',
                gap: '0.85rem',
                alignContent: 'start',
                cursor: selectionMode ? 'default' : 'pointer',
                outline: selectionMode && selectedNoteIds.includes(note.id) ? '2px solid var(--accent)' : undefined,
                background: selectionMode && selectedNoteIds.includes(note.id)
                  ? 'color-mix(in srgb, var(--field-bg) 72%, var(--accent-soft) 28%)'
                  : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <span className="badge">{note.type ?? 'Note'}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                    {note.type === 'Prayer Requests' && note.status ? (
                      <span style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>Prayer status: {note.status}</span>
                    ) : null}
                    {note.type === 'Dream' ? (
                      <span style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
                        {note.is_lucid_dream ? 'Lucid' : 'Not lucid'}
                      </span>
                    ) : null}
                    {note.shared ? (
                      <span style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>Shared</span>
                    ) : null}
                  </div>
                  <strong style={{ fontSize: '1.1rem', lineHeight: 1.3 }}>
                    {note.title?.trim() || 'Untitled'}
                  </strong>
                </div>
                <div style={{ display: 'grid', gap: '0.45rem', justifyItems: 'end' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'right' }}>
                    {formatNoteDate(note.updated_at)}
                  </span>
                  {selectionMode ? (
                    <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                      <input
                        checked={selectedNoteIds.includes(note.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleSelectedNote(note.id)}
                        type="checkbox"
                      />
                      {selectedNoteIds.includes(note.id) ? 'Selected' : 'Select'}
                    </label>
                  ) : null}
                </div>
              </div>
              <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{getNoteExcerpt(note)}</span>
              {note.speaker ? (
                <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>Speaker: {note.speaker}</span>
              ) : null}
              <div className="cta-row">
                <Link className="button button-primary" href={`/notes/${note.id}/edit`} onClick={(event) => event.stopPropagation()}>
                  Open
                </Link>
                <Link className="button button-secondary" href={`/notes/${note.id}`} onClick={(event) => event.stopPropagation()}>
                  View
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Shared with you</span>
            <strong style={{ fontSize: '1.1rem' }}>Notes other people shared directly with your account</strong>
          </div>

          {receivedSharedNotes.length === 0 ? (
            <section className="empty-state status-message" role="status">
              <strong>No direct shares yet</strong>
              <span style={{ color: 'var(--muted)' }}>
                When another user shares a note directly with you, it will appear here.
              </span>
            </section>
          ) : (
            <section className="responsive-grid">
              {receivedSharedNotes.map((share) => (
                <article
                  key={share.note.id}
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
                      <span className="badge">{share.note.type ?? 'Shared note'}</span>
                      <strong style={{ fontSize: '1.1rem', lineHeight: 1.3 }}>
                        {share.note.title?.trim() || 'Untitled'}
                      </strong>
                    </div>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'right' }}>
                      {formatNoteDate(share.shared_at)}
                    </span>
                  </div>
                  <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{getNoteExcerpt(share.note)}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                    Shared by {share.shared_by_label} • Permission: {share.permissions.join(', ')}
                  </span>
                  <div className="cta-row">
                    <Link className="button button-primary" href={`/notes/shared/${share.note.id}`}>
                      Open shared note
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          )}
        </section>
      ) : null}
      <DeleteNotesDialog
        deleting={deletingSelected}
        noteCount={selectedNoteIds.length}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDeleteSelected}
        open={deleteDialogOpen}
      />
    </div>
  );
}

function setParam(params: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (!value || value === defaultValue) {
    params.delete(key);
    return;
  }

  params.set(key, value);
}

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.72rem',
};

const inputStyle: React.CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid var(--line)',
  padding: '0.85rem 1rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
};

const summaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontWeight: 700,
  color: 'var(--text)',
  listStyle: 'none',
  display: 'grid',
  gap: '0.2rem',
};

const summaryMetaStyle: React.CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.92rem',
  fontWeight: 500,
};
