'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { duplicateNote, getNoteById, listOwnedUserShares, updateNote, type NoteGroupShare, softDeleteNote, type NoteInput, type NoteRecord, type NoteUserShare } from '@/lib/notes';
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
import { createRecordingSignedUrl, formatTranscriptText, transcribeRecording } from '@/lib/transcription';
import { getShowDeleteWarningPreference, setShowDeleteWarningPreference } from '@/lib/delete-warning-preference';
import { DeleteNotesDialog } from '@/components/notes/delete-notes-dialog';
import { ScriptureSearchPanel } from '@/components/notes/scripture-search-panel';

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
        const data = await listOwnedUserShares(note.id);
        if (!active) return;
        setUserShares(data);
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
  const metadataSummary = useMemo(() => {
    const parts = [
      `${wordCount} words`,
      `${readingMinutes} min read`,
      `${scriptureCount} ref${scriptureCount === 1 ? '' : 's'}`,
      note?.type ?? 'Note',
    ];

    if (groupShares.length + userShares.length > 0) {
      parts.push(`shared with ${groupShares.length + userShares.length}`);
    }

    return parts.join(' • ');
  }, [groupShares.length, note?.type, readingMinutes, scriptureCount, userShares.length, wordCount]);

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
      {notice ? <section className="empty-state status-message" role="status">{notice}</section> : null}

      {activeReference ? (
        <ScriptureReferencePreview
          onClose={() => setActiveReference(null)}
          reference={activeReference}
        />
      ) : null}

      <details className="panel" style={{ padding: '0.9rem 1rem' }}>
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 700,
            color: 'var(--text)',
            listStyle: 'none',
            display: 'grid',
            gap: '0.2rem',
          }}
        >
          <span>Note details</span>
          <span style={{ color: 'var(--muted)', fontSize: '0.92rem', fontWeight: 500 }}>{metadataSummary}</span>
        </summary>

        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.9rem' }}>
          <div
            style={{
              display: 'grid',
              gap: '0.6rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            <div className="status-card" style={{ padding: '0.9rem' }}>
              <span className="eyebrow">Length</span>
              <strong>{wordCount} words</strong>
              <span style={{ color: 'var(--muted)' }}>{readingMinutes} min read</span>
            </div>
            <div className="status-card" style={{ padding: '0.9rem' }}>
              <span className="eyebrow">Scripture</span>
              <strong>{scriptureCount}</strong>
              <span style={{ color: 'var(--muted)' }}>
                {scriptureCount === 1 ? 'reference detected' : 'references detected'}
              </span>
            </div>
            <div className="status-card" style={{ padding: '0.9rem' }}>
              <span className="eyebrow">Type</span>
              <strong>{note.type ?? 'Note'}</strong>
              <span style={{ color: 'var(--muted)' }}>{note.status?.trim() || 'No status'}</span>
            </div>
          </div>

          <div className="status-card" style={{ padding: '0.9rem', display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Guidance</span>
            <strong>Built for {note.type ?? 'general note'} reading</strong>
            <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{getNoteTypeGuidance(note.type)}</span>
          </div>

          {note.type === 'Prayer Requests' ? (
            <div className="status-card" style={{ padding: '0.9rem', display: 'grid', gap: '0.65rem' }}>
              <span className="eyebrow">Prayer workflow</span>
              <strong>{prayerRequest?.status ?? note.status ?? 'Ongoing'}</strong>
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

          <div className="status-card" style={{ padding: '0.9rem', display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Visibility</span>
            <strong>
              {groupShares.length + userShares.length > 0
                ? `Shared to ${groupShares.length} group${groupShares.length === 1 ? '' : 's'} and ${userShares.length} user${userShares.length === 1 ? '' : 's'}`
                : 'Private note'}
            </strong>
            <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              {groupShares.length + userShares.length > 0
                ? [
                    ...groupShares.map((share) => share.group_name),
                    ...userShares.map((share) => share.user_label),
                  ].join(', ')
                : 'Visible only to you.'}
            </span>
          </div>
        </div>
      </details>

      {detectedReferences.length > 0 ? (
        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
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
        </section>
      ) : null}

      <section className="panel" style={{ padding: '1rem' }}>
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

      <details className="panel" style={{ padding: '0.9rem 1rem' }}>
        <summary style={detailsSummaryStyle}>
          <span>Scripture search</span>
          <span style={detailsMetaStyle}>Reference, phrase, or keyword</span>
        </summary>
        <div style={{ marginTop: '0.85rem' }}>
          <ScriptureSearchPanel compact />
        </div>
      </details>

      {note.clips?.length ? (
        <NoteClipsList
          clips={note.clips}
          onTranscribeClip={onTranscribeClip}
        />
      ) : null}

      <details className="panel" style={{ padding: '0.9rem 1rem' }}>
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 700,
            color: 'var(--text)',
            listStyle: 'none',
          }}
        >
          Share note
        </summary>
        <div style={{ marginTop: '0.85rem' }}>
          <NoteSharePanel note={note} onSharesUpdated={setGroupShares} onUserSharesUpdated={setUserShares} />
        </div>
      </details>

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

const detailsSummaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  fontWeight: 700,
  color: 'var(--text)',
  listStyle: 'none',
  display: 'grid',
  gap: '0.2rem',
};

const detailsMetaStyle: React.CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.92rem',
  fontWeight: 500,
};
