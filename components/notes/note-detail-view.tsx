'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { duplicateNote, getNoteById, updateNote, type NoteGroupShare, softDeleteNote, type NoteRecord } from '@/lib/notes';
import {
  formatNoteDate,
  getNoteReadingTimeMinutes,
  getNoteTypeGuidance,
  getNoteWordCount,
  getScriptureReferenceCount,
  supportsSpeakerField,
} from '@/components/notes/note-utils';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';
import { ScriptureReferenceText } from '@/components/notes/scripture-reference-text';
import { findScriptureReferences } from '@/lib/scripture-references';
import { NoteSharePanel } from '@/components/notes/note-share-panel';
import { getPrayerRequestById, type PrayerRequestRecord, type PrayerRequestStatus, upsertPrayerRequest } from '@/lib/prayer-requests';
import { SharedNoteComments } from '@/components/notes/shared-note-comments';
import { NoteClipsList } from '@/components/notes/note-clips-list';

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
  const [prayerRequest, setPrayerRequest] = useState<PrayerRequestRecord | null>(null);
  const [updatingPrayerStatus, setUpdatingPrayerStatus] = useState(false);

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
          {note.speaker && supportsSpeakerField(note.type) ? <span style={{ color: 'var(--muted)' }}>Speaker: {note.speaker}</span> : null}
          {note.status ? <span style={{ color: 'var(--muted)' }}>Status: {note.status}</span> : null}
          {note.type === 'Dream' && note.is_lucid_dream ? <span style={{ color: 'var(--muted)' }}>Lucid dream</span> : null}
          {note.type === 'Dream' && !note.is_lucid_dream ? <span style={{ color: 'var(--muted)' }}>Not lucid</span> : null}
          {note.type === 'Dream' && note.dream_role ? <span style={{ color: 'var(--muted)' }}>Role: {note.dream_role}</span> : null}
          {note.shared ? <span style={{ color: 'var(--muted)' }}>Shared</span> : null}
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
          {note.type === 'Prayer Requests' ? (
            <article className="status-card" style={{ padding: '1rem' }}>
              <span className="eyebrow">Prayer request</span>
              <strong style={{ fontSize: '1.2rem' }}>{prayerRequest?.status ?? note.status ?? 'Ongoing'}</strong>
              <span style={{ color: 'var(--muted)' }}>
                {prayerRequest?.answered_at
                  ? `Answered ${formatNoteDate(prayerRequest.answered_at)}`
                  : 'Still active and waiting for an answer.'}
              </span>
            </article>
          ) : null}
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

        {note.type === 'Prayer Requests' ? (
          <div className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            <span className="eyebrow">Prayer workflow</span>
            <strong style={{ fontSize: '1.05rem' }}>
              {prayerRequest?.status ?? note.status ?? 'Ongoing'}
            </strong>
            <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Prayer requests now persist as linked prayer-request records on web, matching the existing mobile product model. Browser reminders stay deferred for now.
            </span>
            <div className="cta-row">
              <button
                className="button button-secondary"
                disabled={updatingPrayerStatus || (prayerRequest?.status ?? note.status) === 'Ongoing'}
                onClick={() => onPrayerStatusChange('Ongoing')}
                type="button"
              >
                {updatingPrayerStatus ? 'Updating…' : 'Mark ongoing'}
              </button>
              <button
                className="button button-primary"
                disabled={updatingPrayerStatus || (prayerRequest?.status ?? note.status) === 'Answered'}
                onClick={() => onPrayerStatusChange('Answered')}
                type="button"
              >
                {updatingPrayerStatus ? 'Updating…' : 'Mark answered'}
              </button>
            </div>
          </div>
        ) : null}

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

      {note.clips?.length ? (
        <NoteClipsList clips={note.clips} />
      ) : null}

      <NoteSharePanel note={note} onSharesUpdated={setGroupShares} />

      {note.shared || groupShares.length > 0 ? (
        <SharedNoteComments noteId={note.id} />
      ) : null}

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
