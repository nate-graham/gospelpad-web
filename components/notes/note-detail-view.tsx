'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createNote, duplicateNote, getNoteById, listOwnedGroupShares, listOwnedUserShares, updateNote, type NoteGroupShare, softDeleteNote, type NoteInput, type NoteRecord, type NoteUserShare } from '@/lib/notes';
import {
  formatNoteDate,
  getNoteReadingTimeMinutes,
  getNoteTypeGuidance,
  getNoteWordCount,
  getScriptureReferenceCount,
  supportsSpeakerField,
} from '@/components/notes/note-utils';
import { formatVerseReference, ScriptureReferenceText } from '@/components/notes/scripture-reference-text';
import { findScriptureReferences } from '@/lib/scripture-references';
import { NoteSharePanel } from '@/components/notes/note-share-panel';
import { getPrayerRequestById, type PrayerRequestRecord, type PrayerRequestStatus, upsertPrayerRequest } from '@/lib/prayer-requests';
import { SharedNoteComments } from '@/components/notes/shared-note-comments';
import { NoteClipsList } from '@/components/notes/note-clips-list';
import { createRecordingSignedUrl, formatTranscriptText, transcribeRecording } from '@/lib/transcription';
import { getShowDeleteWarningPreference, setShowDeleteWarningPreference } from '@/lib/delete-warning-preference';
import { DeleteNotesDialog } from '@/components/notes/delete-notes-dialog';
import { ScriptureSearchPanel } from '@/components/notes/scripture-search-panel';
import { fetchScriptureByReference, type ScriptureResult } from '@/lib/scripture';
import { bereaHrefForReference, isBereaNote } from '@/lib/berea';

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
  const [userShares, setUserShares] = useState<NoteUserShare[]>([]);
  const [prayerRequest, setPrayerRequest] = useState<PrayerRequestRecord | null>(null);
  const [updatingPrayerStatus, setUpdatingPrayerStatus] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

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

  useEffect(() => {
    let active = true;

    if (note?.type !== 'Prayer Requests' || !note.prayer_request_id) {
      setPrayerRequest(null);
      return;
    }

    const loadPrayerRequest = async () => {
      try {
        const data = await getPrayerRequestById(note.prayer_request_id as string);
        if (!active) return;
        setPrayerRequest(data);
      } catch {
        if (!active) return;
        setPrayerRequest(null);
      }
    };

    void loadPrayerRequest();

    return () => {
      active = false;
    };
  }, [note?.prayer_request_id, note?.type]);

  useEffect(() => {
    let active = true;

    if (!note) {
      setUserShares([]);
      return;
    }

    const loadUserShares = async () => {
      try {
        const [users, groups] = await Promise.all([
          listOwnedUserShares(note.id),
          listOwnedGroupShares(note.id).catch(() => [] as NoteGroupShare[]),
        ]);
        if (!active) return;
        setUserShares(users);
        setGroupShares(groups);
      } catch {
        if (!active) return;
        setUserShares([]);
      }
    };

    void loadUserShares();

    return () => {
      active = false;
    };
  }, [note?.id]);

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
  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setShareOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shareOpen]);

  const onDelete = async () => {
    if (getShowDeleteWarningPreference()) {
      setDeleteDialogOpen(true);
      return;
    }

    try {
      setDeleting(true);
      await softDeleteNote(noteId);
      router.replace('/notes?deleted=1');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete note.');
      setDeleting(false);
    }
  };

  const confirmDelete = async (hideWarningNextTime: boolean) => {
    if (hideWarningNextTime) {
      setShowDeleteWarningPreference(false);
    }
    try {
      setDeleting(true);
      setDeleteDialogOpen(false);
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
      router.replace(`/notes/${duplicateId}/edit?copied=1&from=personal-note`);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Failed to duplicate note.');
      setDuplicating(false);
    }
  };

  const insertScriptureIntoNote = async (payload: string) => {
    if (!note) return;

    const nextBody = note.body?.trim()
      ? `${note.body.trimEnd()}\n\n${payload}`
      : payload;

    await updateNote(note.id, {
      title: note.title ?? '',
      body: nextBody,
      speaker: note.speaker ?? '',
      type: note.type === 'Dream' || note.type === 'Prayer Requests' || note.type === 'Study' || note.type === 'Journal' || note.type === 'Church notes'
        ? note.type
        : 'Church notes',
      isLucidDream: note.type === 'Dream' ? Boolean(note.is_lucid_dream) : undefined,
      dreamRole: note.type === 'Dream' ? (note.dream_role ?? 'observing') : undefined,
      prayerStatus: note.type === 'Prayer Requests' && note.status === 'Answered' ? 'Answered' : note.type === 'Prayer Requests' ? 'Ongoing' : undefined,
      prayerRequestId: note.type === 'Prayer Requests' ? note.prayer_request_id ?? null : undefined,
      clips: note.clips ?? undefined,
    });

    setNote((current) =>
      current
        ? {
            ...current,
            body: nextBody,
            updated_at: new Date().toISOString(),
          }
        : current
    );
    setNotice('Scripture inserted into this note.');
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

  const onPrayerStatusChange = async (nextStatus: PrayerRequestStatus) => {
    if (!note || note.type !== 'Prayer Requests') return;

    try {
      setUpdatingPrayerStatus(true);
      const nextPrayerRequestId = await upsertPrayerRequest({
        id: note.prayer_request_id ?? undefined,
        title: note.title ?? 'Untitled prayer request',
        body: note.body ?? '',
        status: nextStatus,
        groupId: null,
        shared: false,
        accepted: false,
      });

      await updateNote(note.id, {
        title: note.title ?? '',
        body: note.body ?? '',
        speaker: note.speaker ?? '',
        type: 'Prayer Requests',
        prayerStatus: nextStatus,
        prayerRequestId: nextPrayerRequestId,
      });

      setNote((current) =>
        current
          ? {
              ...current,
              status: nextStatus,
              prayer_request_id: nextPrayerRequestId,
              updated_at: new Date().toISOString(),
            }
          : current
      );

      const refreshedPrayerRequest = await getPrayerRequestById(nextPrayerRequestId);
      setPrayerRequest(refreshedPrayerRequest);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update prayer status.');
    } finally {
      setUpdatingPrayerStatus(false);
    }
  };

  const onTranscribeClip = async (clip: NonNullable<NoteRecord['clips']>[number]) => {
    if (!note) return;
    const clipUrl = /^https?:\/\//i.test(clip.uri) ? clip.uri : await createRecordingSignedUrl(clip.uri);
    const result = await transcribeRecording(clipUrl, clip.uri);
    const transcript = formatTranscriptText(result.text?.trim() || '');

    if (!transcript) {
      throw new Error('No transcription text was returned for this clip.');
    }

    const nextBody = note.body?.trim() ? `${note.body.trimEnd()}\n\n${transcript}` : transcript;

    await updateNote(note.id, {
      title: note.title ?? '',
      body: nextBody,
      speaker: note.speaker ?? '',
      type: ((note.type as NoteInput['type']) ?? 'Church notes'),
      isLucidDream: note.type === 'Dream' ? Boolean(note.is_lucid_dream) : undefined,
      dreamRole: note.type === 'Dream' ? note.dream_role ?? 'observing' : undefined,
      prayerStatus: note.type === 'Prayer Requests' ? (prayerRequest?.status ?? note.status ?? 'Ongoing') as PrayerRequestStatus : undefined,
      prayerRequestId: note.type === 'Prayer Requests' ? note.prayer_request_id : undefined,
      clips: note.clips ?? undefined,
    });

    setNote((current) =>
      current
        ? {
            ...current,
            body: nextBody,
            updated_at: new Date().toISOString(),
          }
        : current
    );
    setNotice(`Transcription added from ${clip.name || 'audio clip'}.`);
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

  const isBerea = isBereaNote(note);
  const typeLabel = isBerea ? 'Berea study' : note.type === 'Prayer Requests' ? 'Prayer request' : note.type ?? 'Note';
  const subtitle = [note.speaker && supportsSpeakerField(note.type) ? note.speaker : null, detectedReferences[0]?.split(':')[0] ?? null].filter(Boolean);
  const shareCount = groupShares.length + userShares.length;
  const railReference = activeReference ?? detectedReferences[0] ?? null;
  const prayerStatus = (prayerRequest?.status ?? note.status ?? 'Ongoing') as PrayerRequestStatus;

  return (
    <div className="page-container page-section note-view">
      <div className="note-view-topbar">
        <Link className="back-link" href="/notes">
          <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 11 18" width="7">
            <path d="M9 1L1 9l8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
          Notebook
        </Link>
        <span className="note-view-crumb">
          / {typeLabel} · {shareCount > 0 ? `Shared with ${shareCount}` : 'Saved'}
        </span>
        <div className="note-view-actions">
          <button className="button button-secondary" onClick={() => setShareOpen(true)} type="button">
            <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
            Share
          </button>
          <Link className="button button-primary" href={isBerea ? `/berea/${note.id}` : `/notes/${note.id}/edit`}>
            {isBerea ? 'Open in Berea' : 'Edit note'}
          </Link>
          <details className="more-menu">
            <summary aria-label="More actions">⋯</summary>
            <div className="more-menu-list" role="menu">
              {isBerea ? (
                <Link href={`/notes/${note.id}/edit`} role="menuitem">
                  Edit as text
                </Link>
              ) : null}
              <button disabled={duplicating} onClick={onDuplicate} role="menuitem" type="button">
                {duplicating ? 'Duplicating…' : 'Duplicate'}
              </button>
              <button className="is-danger" disabled={deleting} onClick={onDelete} role="menuitem" type="button">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </details>
        </div>
      </div>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}
      {notice ? <section className="empty-state status-message" role="status">{notice}</section> : null}

      <div className="note-view-columns">
        <article className="note-view-main">
          <header className="note-page-header">
            <span className="eyebrow" style={{ color: 'var(--vermilion)' }}>
              {[
                typeLabel,
                format(new Date(note.created_at), 'EEEE · d MMMM yyyy'),
                note.clips?.length ? `${note.clips.length} audio clip${note.clips.length === 1 ? '' : 's'}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <h1>{note.title?.trim() || 'Untitled'}</h1>
            {subtitle.length ? <p className="note-page-subtitle">{subtitle.join(' · ')}</p> : null}
            {note.status || note.type === 'Dream' || note.shared ? (
              <div className="meta-row" style={{ fontSize: '0.84rem' }}>
                {note.status && note.type !== 'Prayer Requests' ? <span className="note-status-pill">{note.status}</span> : null}
                {note.type === 'Dream' ? <span className="note-status-pill">{note.is_lucid_dream ? 'Lucid dream' : 'Standard dream'}</span> : null}
                {note.type === 'Dream' && note.dream_role ? <span className="note-status-pill">{note.dream_role === 'involved' ? 'Involved' : 'Observing'}</span> : null}
                {note.shared ? <span className="note-status-pill">Shared</span> : null}
              </div>
            ) : null}
          </header>

          {note.type === 'Prayer Requests' ? (
            <div className="note-prayer-status">
              <span className={`note-status-pill${prayerStatus === 'Answered' ? ' is-answered' : ''}`}>{prayerStatus}</span>
              <div className="segmented" role="group" aria-label="Prayer status">
                {(['Ongoing', 'Answered'] as PrayerRequestStatus[]).map((status) => (
                  <button
                    aria-pressed={prayerStatus === status}
                    disabled={updatingPrayerStatus}
                    key={status}
                    onClick={() => prayerStatus !== status && onPrayerStatusChange(status)}
                    type="button"
                  >
                    {status === 'Answered' ? 'Mark answered' : 'Ongoing'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="note-body-content note-view-body">
            {(note.body ?? '').trim() ? (
              <ScriptureReferenceText onReferenceClick={setActiveReference} text={(note.body ?? '').trim()} />
            ) : (
              <span style={{ color: 'var(--muted)' }}>No body content yet.</span>
            )}
          </div>

          {note.shared || groupShares.length > 0 ? <SharedNoteComments noteId={note.id} /> : null}
        </article>

        <aside className="note-view-rail">
          {isBerea ? (
            <section className="rail-section">
              <span className="rail-heading">Berea study</span>
              <div className="verse-focus">
                <p className="verse-focus-copy">This note is an inductive study. Keep working through observe, interpret and apply.</p>
                <Link className="berea-cta" href={`/berea/${note.id}`}>
                  <span>
                    <strong>Open in Berea</strong>
                    <small>Pick up where you left off</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </Link>
              </div>
            </section>
          ) : detectedReferences.length ? (
            <section className="rail-section">
              <span className="rail-heading">Verses in this note</span>
              <VerseFocus
                bereaHref={bereaHrefForReference(railReference as string, { id: note.id, title: note.title })}
                reference={railReference as string}
              />
              {detectedReferences
                .filter((reference) => reference !== railReference)
                .map((reference) => (
                  <div className="verse-row" key={reference}>
                    <button onClick={() => setActiveReference(reference)} type="button">
                      <span className="pilcrow" aria-hidden="true">¶</span>
                      {formatVerseReference(reference)}
                    </button>
                    <Link href={bereaHrefForReference(reference, { id: note.id, title: note.title })}>Study</Link>
                  </div>
                ))}
            </section>
          ) : null}

          {note.clips?.length ? (
            <section className="rail-section">
              <span className="rail-heading">Recording</span>
              <NoteClipsList clips={note.clips} onTranscribeClip={onTranscribeClip} />
            </section>
          ) : null}

          <section className="rail-section">
            <span className="rail-heading">Note details</span>
            <dl className="note-facts">
              <div>
                <dt>Type</dt>
                <dd>{typeLabel}</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>
                  {wordCount} words · {readingMinutes} min
                </dd>
              </div>
              <div>
                <dt>References</dt>
                <dd>{scriptureCount}</dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>
                  {shareCount > 0
                    ? [...groupShares.map((share) => share.group_name), ...userShares.map((share) => share.user_label)].join(', ')
                    : 'Private · only you'}
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatNoteDate(note.updated_at)}</dd>
              </div>
            </dl>
          </section>

          <details className="rail-section rail-details">
            <summary className="rail-heading">Add Scripture</summary>
            <ScriptureSearchPanel compact onCreateNote={createScriptureNote} onInsert={insertScriptureIntoNote} />
          </details>

          <p className="composer-guidance">{getNoteTypeGuidance(note.type ?? 'Note')}</p>
        </aside>
      </div>

      {shareOpen ? (
        <div className="share-dialog-backdrop" onClick={() => setShareOpen(false)} role="presentation">
          <section
            aria-labelledby="share-dialog-title"
            aria-modal="true"
            className="share-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="share-dialog-header">
              <div>
                <span className="eyebrow" style={{ color: 'var(--accent)' }}>Share note</span>
                <h2 id="share-dialog-title">{note.title?.trim() || 'Untitled'}</h2>
                <p>Share with people, post it to a group, or send a read-only link.</p>
              </div>
              <button aria-label="Close" className="share-dialog-close" onClick={() => setShareOpen(false)} type="button">
                ×
              </button>
            </header>
            <NoteSharePanel note={note} onSharesUpdated={setGroupShares} onUserSharesUpdated={setUserShares} />
            <div className="share-dialog-footer">
              <button className="button button-primary" onClick={() => setShareOpen(false)} type="button">
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <DeleteNotesDialog
        deleting={deleting}
        noteCount={1}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        open={deleteDialogOpen}
      />
    </div>
  );
}

/** The verse in focus beside the note: its text, and the way into a Berea study of it. */
function VerseFocus({ reference, bereaHref }: { reference: string; bereaHref: string }) {
  const [result, setResult] = useState<ScriptureResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setResult(null);
    setFailed(false);
    fetchScriptureByReference(reference, 'KJV')
      .then((next) => active && setResult(next))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [reference]);

  return (
    <div className="verse-focus">
      <div className="verse-focus-head">
        <span className="pilcrow" aria-hidden="true">¶</span>
        <strong>{formatVerseReference(reference)}</strong>
      </div>
      {result ? <p className="verse-focus-text">{result.text.trim()}</p> : null}
      {!result && !failed ? <p className="verse-focus-copy">Loading the verse…</p> : null}
      <Link className="berea-cta" href={bereaHref}>
        <span>
          <strong>Examine in Berea</strong>
          <small>Study {formatVerseReference(reference)} · observe, interpret, apply</small>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
    </div>
  );
}
