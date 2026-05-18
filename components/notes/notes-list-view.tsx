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
  const [coarsePointer, setCoarsePointer] = useState(false);

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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarsePointer(media.matches);
    update();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

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
    <div className="page-container page-section notes-list-page" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header 
        className="note-list-hero" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '0.25rem',
          gap: '2rem'
        }}
      >
        <div className="note-list-title" style={{ letterSpacing: '-0.02em' }}>
          <span className="eyebrow" style={{ color: 'var(--tertiary)', letterSpacing: '0.05em', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0', display: 'block', opacity: 0.7, textTransform: 'none' }}>{headerName}</span>
          <h1 style={{ margin: 0, fontSize: '4.2rem', fontWeight: 500, letterSpacing: '-0.05em', color: 'var(--secondary)', lineHeight: 1 }}>Your notes</h1>
        </div>
        <div className="cta-row notes-list-actions" style={{ flexShrink: 0, gap: '1.25rem', alignItems: 'center' }}>
          <button className="button button-secondary" onClick={toggleSelectionMode} type="button" style={{ borderRadius: '24px', padding: '0.4rem 1rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', opacity: 0.8 }}>
            {selectionMode ? 'Cancel' : 'Select'}
          </button>
          {selectionMode ? (
            <button
              className="button button-primary"
              disabled={selectedNoteIds.length === 0 || deletingSelected}
              onClick={requestDeleteSelected}
              type="button" style={{ borderRadius: '24px', padding: '0.4rem 1.25rem' }}
            >
              {deletingSelected ? 'Deleting…' : selectedNoteIds.length > 0 ? `Delete selected (${selectedNoteIds.length})` : 'Delete selected'}
            </button>
          ) : null}
          <Link className="button" href="/notes/dictate" style={{ borderRadius: '24px', padding: '0.4rem 1.25rem', background: '#1A1D26', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--tertiary)', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', fontWeight: 500 }}>
            <span style={{ fontSize: '1rem', opacity: 0.6 }}>🎙</span> Dictate note
          </Link>
          <Link className="button button-primary" href="/notes/new" style={{ borderRadius: '24px', padding: '0.4rem 1.4rem', background: '#D1AC70', color: '#101319', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.8rem' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 300, marginTop: '-1px' }}>+</span> New note
          </Link>
        </div>
      </header>

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

      {!loading && !error ? (
        <div className="note-library-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem', alignItems: 'start' }}>
          <aside className="note-library-rail" style={{ display: 'grid', gap: '1rem' }}>
            <section style={panelCardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                <span className="eyebrow" style={{ color: '#D1AC70', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.1em' }}>OVERVIEW</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--tertiary)', transform: 'rotate(180deg)' }}>▼</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--tertiary)', fontSize: '0.9rem', opacity: 0.8 }}>Total Reflections</span>
                <strong style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--secondary)', letterSpacing: '-0.02em' }}>{notes.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.2rem', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--tertiary)', fontSize: '0.9rem', opacity: 0.8 }}>Recent Activity</span>
                <strong style={{ fontSize: '0.92rem', fontWeight: 500, color: '#D1AC70' }}>2 hours ago</strong>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' }}>
                <p style={{ color: 'var(--tertiary)', fontStyle: 'italic', fontSize: '0.92rem', lineHeight: 1.9, margin: 0, opacity: 0.6 }}>
                  "The heart of the discerning acquires knowledge, for the ears of the wise seek it out."
                </p>
              </div>
            </section>

            <details style={panelCardStyle}>
              <summary style={panelSummaryStyle}>
                <span className="eyebrow" style={{ color: 'var(--secondary)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>DISCOVERY</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--tertiary)' }}>▼</span>
              </summary>
              <div style={{ display: 'grid', gap: '1.5rem', paddingTop: '1.5rem' }}>
                <label style={fieldStyle}>
                  <span className="eyebrow" style={labelTextStyle}>Search</span>
                  <input
                    onChange={(e) => updateQuery({ search: e.target.value })}
                    placeholder="Search title, speaker, or body..."
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
            </details>

            <details style={panelCardStyle}>
              <summary style={panelSummaryStyle}>
                <span className="eyebrow" style={{ color: 'var(--secondary)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>SCRIPTURE SEARCH</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--tertiary)' }}>▼</span>
              </summary>
              <div style={{ paddingTop: '1.5rem' }}>
                <ScriptureSearchPanel compact onCreateNote={createScriptureNote} />
              </div>
            </details>
          </aside>

          <div className="note-library-main">
            <nav 
              className="tab-bar" 
              style={{ 
                position: 'relative',
                display: 'flex', 
                gap: '3.5rem', 
                justifyContent: 'center',
                marginBottom: '0.5rem', 
                borderBottom: '1px solid var(--border-soft)' 
              }}
            >
              <button 
                className="tab-item" 
                onClick={() => resetFilters()}
                style={{ 
                  position: 'relative',
                  background: 'none', 
                  border: 'none', 
                  padding: '1.2rem 0', 
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  color: activeFilterCount === 0 ? 'var(--secondary)' : 'var(--tertiary)',
                  fontWeight: activeFilterCount === 0 ? 500 : 400,
                  opacity: activeFilterCount === 0 ? 1 : 0.4
                }}
              >
                All Notes
                {activeFilterCount === 0 && (
                  <div style={{ position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)', width: '20px', height: '2px', background: '#D1AC70' }} />
                )}
              </button>
              <button 
                className="tab-item" 
                disabled
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  padding: '1.2rem 0', 
                  cursor: 'not-allowed',
                  fontSize: '0.95rem',
                  color: 'var(--tertiary)',
                  opacity: 0.3
                }}
              >
                Favorites
              </button>
              <button 
                className="tab-item" 
                onClick={() => updateQuery({ sort: 'updated-desc' })}
                style={{ 
                  position: 'relative',
                  background: 'none', 
                  border: 'none', 
                  padding: '1.2rem 0', 
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  color: query.sort === 'updated-desc' && activeFilterCount > 0 ? 'var(--secondary)' : 'var(--tertiary)',
                  fontWeight: query.sort === 'updated-desc' && activeFilterCount > 0 ? 500 : 400,
                  opacity: query.sort === 'updated-desc' && activeFilterCount > 0 ? 1 : 0.4
                }}
              >
                Recent
                {query.sort === 'updated-desc' && activeFilterCount > 0 && (
                  <div style={{ position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)', width: '20px', height: '2px', background: '#D1AC70' }} />
                )}
              </button>
              <button 
                style={{ 
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--tertiary)', 
                  fontSize: '1.2rem', 
                  cursor: 'pointer', 
                  padding: 0, 
                  opacity: 0.5 
                }}
              >
                ⊞
              </button>
            </nav>

            {notes.length > 0 ? (
              <section className="note-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.2rem' }}>
                {notes.map((note) => (
                  <article
                    key={note.id}
                    className="note-card"
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelectedNote(note.id);
                        return;
                      }
                      if (coarsePointer) {
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
                    role={coarsePointer && !selectionMode ? undefined : 'button'}
                    aria-pressed={selectionMode ? selectedNoteIds.includes(note.id) : undefined}
                    tabIndex={coarsePointer && !selectionMode ? -1 : 0}
                    style={{
                      cursor: selectionMode ? 'default' : 'pointer',
                      outline: selectionMode && selectedNoteIds.includes(note.id) ? '2px solid #D1AC70' : undefined,
                      background: '#1A1D26',
                      borderRadius: '20px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '240px',
                      border: '1px solid rgba(255,255,255,0.03)',
                      boxShadow: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--secondary)', padding: '0.5rem 1rem', borderRadius: '14px', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em' }}>
                          {(note.type ?? 'Note').toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {selectionMode && (
                          <input
                            checked={selectedNoteIds.includes(note.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleSelectedNote(note.id)}
                            type="checkbox"
                            style={{ width: '18px', height: '18px', accentColor: '#D1AC70' }}
                          />
                        )}
                        <button style={{ background: 'none', border: 'none', color: 'var(--tertiary)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>⋮</button>
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.6rem', fontWeight: 500, lineHeight: 1.3, marginBottom: '0.4rem', color: 'var(--secondary)', letterSpacing: '-0.02em' }}>
                      {note.title?.trim() || 'Untitled'}
                    </h3>
                    <p style={{ color: 'var(--tertiary)', fontSize: '0.92rem', lineHeight: 1.4, margin: 0, opacity: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {getNoteExcerpt(note)}
                    </p>
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '2.5rem' }}>
                      <span style={{ color: 'var(--tertiary)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {formatNoteDate(note.updated_at)}
                      </span>
                      <span style={{ color: '#D1AC70', fontSize: '1.4rem', fontWeight: 300 }}>→</span>
                    </div>
                  </article>
                ))}
                {!selectionMode && (
                  <Link href="/notes/new" style={{ background: 'transparent', borderRadius: '20px', border: '2px dashed rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '240px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#D1AC70', fontSize: '1.8rem', fontWeight: 300 }}>
                      +
                    </div>
                  </Link>
                )}
              </section>
            ) : null}
          </div>
        </div>
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

const panelCardStyle: React.CSSProperties = {
  background: '#1A1D26',
  borderRadius: '20px',
  padding: '1.5rem',
  border: '1px solid rgba(255,255,255,0.03)',
  width: '100%',
};

const panelSummaryStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  listStyle: 'none',
};

function setParam(params: URLSearchParams, key: string, value: string, defaultValue: string) {
  if (!value || value === defaultValue) {
    params.delete(key);
    return;
  }

  params.set(key, value);
}

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.4rem',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--tertiary)',
};

const inputStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 0,
  padding: '0.4rem 0',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255, 248, 235, 0.1)',
  color: 'var(--text)',
  fontSize: '0.9rem',
};
