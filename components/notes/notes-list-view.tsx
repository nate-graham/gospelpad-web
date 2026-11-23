'use client';

import Link from 'next/link';
import { isBereaNote } from '@/lib/berea';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { listNotes, listReceivedSharedNotes, NOTE_TYPES, softDeleteNotes, type NoteListQuery, type NoteRecord, type ReceivedSharedNoteSummary } from '@/lib/notes';
import { getNoteExcerpt, getScriptureReferenceCount } from '@/components/notes/note-utils';
import { DeleteNotesDialog } from '@/components/notes/delete-notes-dialog';
import { getShowDeleteWarningPreference, setShowDeleteWarningPreference } from '@/lib/delete-warning-preference';
import { useSupabaseAuth } from '@/components/providers/supabase-auth-provider';

export function NotesListView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSupabaseAuth();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [receivedSharedNotes, setReceivedSharedNotes] = useState<ReceivedSharedNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  const headerName =
    (typeof user?.user_metadata?.username === 'string' && user.user_metadata.username.trim()) ||
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()) ||
    (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    user?.email?.split('@')[0] ||
    'Account';

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
          listNotes({ ...query, type: 'all' }),
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
  }, [query.search, query.status, query.scope, query.sort]);

  const successMessage = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Note created successfully.';
    if (searchParams.get('updated') === '1') return 'Note updated successfully.';
    if (searchParams.get('deleted') === '1') return 'Note deleted successfully.';
    return inlineNotice;
  }, [inlineNotice, searchParams]);

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

  const view = searchParams.get('view') === 'shared' ? 'shared' : query.scope === 'group' ? 'group' : 'personal';
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((note) => counts.set(note.type ?? 'Note', (counts.get(note.type ?? 'Note') ?? 0) + 1));
    return counts;
  }, [notes]);
  const visibleNotes = useMemo(
    () => (query.type && query.type !== 'all' ? notes.filter((note) => note.type === query.type) : notes),
    [notes, query.type]
  );

  const setView = (next: 'personal' | 'shared' | 'group') => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('view');
    params.delete('scope');
    if (next === 'shared') params.set('view', 'shared');
    if (next === 'group') params.set('scope', 'group');
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const openNote = (note: NoteRecord) => {
    if (selectionMode) {
      toggleSelectedNote(note.id);
      return;
    }
    router.push(isBereaNote(note) ? `/berea/${note.id}` : `/notes/${note.id}`);
  };

  return (
    <div className="page-container page-section notebook-page">
      <header className="notebook-header">
        <div>
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>
            {headerName}’s library
          </span>
          <h1>Notebook</h1>
        </div>
        <div className="notebook-actions">
          <button className="button button-secondary" onClick={toggleSelectionMode} type="button">
            {selectionMode ? 'Cancel' : 'Select'}
          </button>
          {selectionMode ? (
            <button
              className="button button-vermilion"
              disabled={selectedNoteIds.length === 0 || deletingSelected}
              onClick={requestDeleteSelected}
              type="button"
            >
              {deletingSelected ? 'Deleting…' : `Delete${selectedNoteIds.length ? ` (${selectedNoteIds.length})` : ''}`}
            </button>
          ) : (
            <Link className="button button-secondary" href="/notes/dictate">
              <svg width="12" height="15" viewBox="0 0 16 20" fill="none" aria-hidden="true"><rect x="4.5" y="1" width="7" height="12" rx="3.5" stroke="var(--vermilion)" strokeWidth="1.8" /><path d="M1.5 9.5a6.5 6.5 0 0013 0M8 16v3" stroke="var(--vermilion)" strokeWidth="1.8" strokeLinecap="round" /></svg>
              Record
            </Link>
          )}
          <Link className="button button-primary" href="/notes/new">
            <span aria-hidden="true">+</span> New note
          </Link>
        </div>
      </header>

      <nav className="notebook-tabs" aria-label="Notebook sections">
        <button aria-current={view === 'personal' ? 'page' : undefined} onClick={() => setView('personal')} type="button">
          Personal notes {view === 'personal' && !loading ? <span>{notes.length}</span> : null}
        </button>
        <button aria-current={view === 'shared' ? 'page' : undefined} onClick={() => setView('shared')} type="button">
          Shared with you {!loading ? <span>{receivedSharedNotes.length}</span> : null}
        </button>
        <button aria-current={view === 'group' ? 'page' : undefined} onClick={() => setView('group')} type="button">
          Group notes {view === 'group' && !loading ? <span>{notes.length}</span> : null}
        </button>
      </nav>

      {view !== 'shared' ? (
        <>
          <div className="notebook-filters">
            <label className="notebook-search">
              <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
              <input
                aria-label="Search notes"
                onChange={(event) => updateQuery({ search: event.target.value })}
                placeholder="Search titles, speakers and text…"
                type="search"
                value={query.search ?? ''}
              />
            </label>
            <label className="notebook-select">
              Status
              <select onChange={(event) => updateQuery({ status: event.target.value as NoteListQuery['status'] })} value={query.status ?? 'all'}>
                <option value="all">Any status</option>
                <option value="with-status">Has status</option>
                <option value="no-status">No status</option>
              </select>
            </label>
            <label className="notebook-select">
              Sort
              <select onChange={(event) => updateQuery({ sort: event.target.value as NoteListQuery['sort'] })} value={query.sort ?? 'updated-desc'}>
                <option value="updated-desc">Recently updated</option>
                <option value="updated-asc">Oldest updated</option>
                <option value="created-desc">Recently created</option>
                <option value="created-asc">Oldest created</option>
                <option value="title-asc">Title A–Z</option>
              </select>
            </label>
          </div>

          <div className="notebook-chips" role="group" aria-label="Filter by type">
            <button aria-pressed={!query.type || query.type === 'all'} onClick={() => updateQuery({ type: 'all' })} type="button">
              All types
            </button>
            {NOTE_TYPES.map((type) => (
              <button aria-pressed={query.type === type} key={type} onClick={() => updateQuery({ type })} type="button">
                {type === 'Prayer Requests' ? 'Prayer requests' : type === 'Church notes' ? 'Church notes' : type}
                {typeCounts.get(type) ? ` · ${typeCounts.get(type)}` : ''}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {successMessage ? <div className="empty-state status-message" role="status" aria-live="polite">{successMessage}</div> : null}

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

      {!loading && !error && view !== 'shared' && visibleNotes.length === 0 ? (
        <section className="notebook-empty" role="status">
          <strong>{activeFilterCount > 0 ? 'No notes match these filters' : 'No notes yet'}</strong>
          <span>
            {activeFilterCount > 0
              ? 'Try a broader search, or clear the filters.'
              : 'Start with a church note, study, journal entry, dream or prayer request.'}
          </span>
          {activeFilterCount > 0 ? (
            <button className="button button-secondary" onClick={resetFilters} type="button">
              Clear filters
            </button>
          ) : (
            <Link className="button button-primary" href="/notes/new">
              Write your first note
            </Link>
          )}
        </section>
      ) : null}

      {!loading && !error && view !== 'shared' && visibleNotes.length > 0 ? (
        <ul className="notebook-list">
          {visibleNotes.map((note) => {
            const refs = getScriptureReferenceCount(note);
            const berea = isBereaNote(note);
            const selected = selectedNoteIds.includes(note.id);
            return (
              <li key={note.id}>
                <div
                  aria-pressed={selectionMode ? selected : undefined}
                  className={`notebook-row${selected ? ' is-selected' : ''}`}
                  onClick={() => openNote(note)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openNote(note);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {selectionMode ? (
                    <input
                      aria-label={`Select ${note.title || 'note'}`}
                      checked={selected}
                      onChange={() => toggleSelectedNote(note.id)}
                      onClick={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                  ) : null}
                  <span className={`notebook-type type-${typeSlug(berea ? 'Berea' : note.type)}`}>
                    {berea ? 'Berea study' : note.type === 'Prayer Requests' ? 'Prayer request' : note.type ?? 'Note'}
                  </span>
                  <span className="notebook-row-main">
                    <span className="notebook-row-title">
                      {note.title?.trim() || 'Untitled'}
                      {note.speaker?.trim() && !berea ? <em> · {note.speaker.trim()}</em> : null}
                    </span>
                    <span className="notebook-row-excerpt">{getNoteExcerpt(note)}</span>
                  </span>
                  <span className="notebook-row-meta">
                    {note.status ? <span className={`note-status-pill${note.status === 'Answered' ? ' is-answered' : ''}`}>{note.status}</span> : null}
                    {note.type === 'Dream' ? (
                      <span className="notebook-pill">
                        {note.dream_role === 'involved' ? 'Involved' : 'Observing'} · {note.is_lucid_dream ? 'lucid' : 'not lucid'}
                      </span>
                    ) : null}
                    {refs > 0 ? (
                      <span className="verse-chip">
                        ¶ {refs} {refs === 1 ? 'reference' : 'references'}
                      </span>
                    ) : null}
                    {note.clips?.length ? <span className="notebook-date">Audio ·</span> : null}
                    <span className="notebook-date">{shortDate(note.updated_at)}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && !error && view === 'shared' ? (
        receivedSharedNotes.length ? (
          <ul className="notebook-list">
            {receivedSharedNotes.map((item) => (
              <li key={item.note.id}>
                <Link className="notebook-row" href={`/notes/shared/${item.note.id}`}>
                  <span className={`notebook-type type-${typeSlug(item.note.type)}`}>
                    {item.note.type === 'Prayer Requests' ? 'Prayer request' : item.note.type ?? 'Note'}
                  </span>
                  <span className="notebook-row-main">
                    <span className="notebook-row-title">
                      {item.note.title?.trim() || 'Untitled'}
                      <em> · from {item.shared_by_label}</em>
                    </span>
                    <span className="notebook-row-excerpt">{getNoteExcerpt(item.note)}</span>
                  </span>
                  <span className="notebook-row-meta">
                    <span className="notebook-pill">{item.permissions.includes('edit') ? 'Can edit' : item.permissions.includes('comment') ? 'Can comment' : 'Read-only'}</span>
                    <span className="notebook-date">{shortDate(item.shared_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <section className="notebook-empty" role="status">
            <strong>Nothing shared with you yet</strong>
            <span>When someone shares a note with you, it appears here.</span>
          </section>
        )
      ) : null}

      {!loading && !error && view === 'personal' ? (
        <Link className="notebook-footer-link" href="/settings#recently-deleted">
          Recently deleted · restorable for 30 days →
        </Link>
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

function typeSlug(type: string | null | undefined) {
  return (type ?? 'note').toLowerCase().replace(/[^a-z]+/g, '-');
}

/** "Today", a weekday within the last week, otherwise "8 Jul". */
function shortDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' }).format(date);
}

function setParam(params: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (!value || value === defaultValue) {
    params.delete(key);
    return;
  }

  params.set(key, value);
}
