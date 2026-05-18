'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getCurrentMembership,
  getGroupNativeNoteById,
  getGroupSharedNoteById,
  listGroupMembers,
  type GroupMemberSummary,
  type GroupNativeNoteSummary,
  type GroupSharedNoteSummary,
} from '@/lib/groups';
import {
  formatNoteDate,
  getNoteExcerpt,
  getNoteReadingTimeMinutes,
  getScriptureReferenceCount,
  getNoteWordCount,
} from '@/components/notes/note-utils';
import { NOTE_TYPES, duplicateNote, removeOwnedGroupShare } from '@/lib/notes';
import { findScriptureReferences } from '@/lib/scripture-references';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';
import { ScriptureReferenceText } from '@/components/notes/scripture-reference-text';
import { GroupNoteComments } from '@/components/groups/group-note-comments';
import { NoteClipsList } from '@/components/notes/note-clips-list';

export function GroupSharedNoteView({
  groupId,
  noteId,
}: {
  groupId: string;
  noteId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [note, setNote] = useState<(GroupSharedNoteSummary & { source: 'shared' }) | (GroupNativeNoteSummary & { source: 'group' }) | null>(null);
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [unsharing, setUnsharing] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [nativeNote, sharedNote, groupMembers, membership] = await Promise.all([
          getGroupNativeNoteById(groupId, noteId),
          getGroupSharedNoteById(groupId, noteId),
          listGroupMembers(groupId),
          getCurrentMembership(groupId),
        ]);
        if (!active) return;
        setMembers(groupMembers);
        setViewerId(membership?.user_id ?? null);
        if (nativeNote) {
          setNote({ ...nativeNote, source: 'group' });
          return;
        }
        if (sharedNote) {
          setNote({ ...sharedNote, source: 'shared' });
          return;
        }
        setNote(null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load group note.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [groupId, noteId]);

  const references = useMemo(() => findScriptureReferences(note?.body ?? ''), [note?.body]);
  const wordCount = useMemo(() => getNoteWordCount(note ?? { body: '' }), [note]);
  const readingMinutes = useMemo(() => getNoteReadingTimeMinutes(note ?? { body: '' }), [note]);
  const scriptureCount = useMemo(() => getScriptureReferenceCount(note ?? { body: '' }), [note]);
  const memberMap = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);
  const authorMember = note?.source === 'shared' ? memberMap.get(note.shared_by ?? '') ?? null : memberMap.get(note?.created_by ?? '') ?? null;
  const authorLabel = authorMember?.name?.trim()
    || authorMember?.display_name?.trim()
    || authorMember?.username?.trim()
    || (note?.source === 'shared' ? 'Shared note owner' : 'Group member');
  const canManageShare = Boolean(note?.source === 'shared' && note.shared_by && viewerId === note.shared_by);
  const canOpenOriginal = Boolean(note?.source === 'shared' && note.shared_by && viewerId === note.shared_by);
  const canEditGroupNote = Boolean(
    note?.source === 'group' && viewerId && (note.created_by === viewerId || members.some((member) => member.user_id === viewerId && (member.is_owner || member.role === 'admin')))
  );
  const successMessage = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Group note created successfully.';
    if (searchParams.get('updated') === '1') return 'Group note updated successfully.';
    return null;
  }, [searchParams]);

  const onCopyToMyNotes = async () => {
    if (!note) return;

    try {
      setDuplicating(true);
      setActionError(null);
      setActionNotice(null);
      const duplicateId = await duplicateNote({
        title: note.title,
        body: note.body,
        speaker: 'speaker' in note ? note.speaker : null,
        type: NOTE_TYPES.includes((('type' in note ? note.type : null) ?? '') as (typeof NOTE_TYPES)[number])
          ? (('type' in note ? note.type : NOTE_TYPES[0]) as (typeof NOTE_TYPES)[number])
          : NOTE_TYPES[0],
        status: 'status' in note ? note.status : null,
        clips: 'clips' in note ? note.clips ?? null : null,
        is_lucid_dream: false,
        dream_role: null,
      });
      router.push(`/notes/${duplicateId}/edit?copied=1&from=group-share`);
    } catch (duplicateError) {
      setActionError(duplicateError instanceof Error ? duplicateError.message : 'Failed to copy note into your library.');
    } finally {
      setDuplicating(false);
    }
  };

  const onRemoveFromGroup = async () => {
    if (!note || note.source !== 'shared') return;
    if (!window.confirm('Remove this shared note from the current group? Group members will lose access to it here.')) {
      return;
    }

    try {
      setUnsharing(true);
      setActionError(null);
      setActionNotice(null);
      await removeOwnedGroupShare(note.id, groupId);
      router.replace(`/groups/${groupId}?unshared=1`);
    } catch (unshareError) {
      setActionError(unshareError instanceof Error ? unshareError.message : 'Failed to remove the note from this group.');
    } finally {
      setUnsharing(false);
    }
  };

  if (loading) {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Loading group note…</strong>
        <span style={{ color: 'var(--muted)' }}>Checking the available group note access paths.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Unable to load group note</strong>
        <span style={{ color: 'var(--muted)' }}>{error}</span>
        <Link className="button button-secondary" href={`/groups/${groupId}`}>
          Back to group
        </Link>
      </section>
    );
  }

  if (!note) {
    return (
      <section className="empty-state status-message" role="status">
        <strong>Group note not found</strong>
        <span style={{ color: 'var(--muted)' }}>
          This note may not belong to the current group or may no longer be visible to this account.
        </span>
        <Link className="button button-primary" href={`/groups/${groupId}`}>
          Return to group
        </Link>
      </section>
    );
  }

  return (
    <div className="page-container page-section">
      <header className="hero-surface">
        <div className="meta-row">
          <span className="badge">
            {note.source === 'group' ? 'Group note' : (note.type ?? 'Shared note')}
          </span>
          {note.source === 'shared' ? <span>Permission: {note.permissions}</span> : null}
          {'speaker' in note && note.speaker ? <span>Speaker: {note.speaker}</span> : null}
        </div>
        <h1>{note.title?.trim() || 'Untitled'}</h1>
        <p className="page-description">
          {note.source === 'shared'
            ? `Shared to this group ${formatNoteDate(note.shared_at)} • Updated ${formatNoteDate(note.updated_at)}`
            : `Created ${formatNoteDate(note.created_at)} • Updated ${formatNoteDate(note.updated_at)}`}
        </p>
      </header>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}
      {actionNotice ? <section className="empty-state status-message" role="status">{actionNotice}</section> : null}
      {actionError ? <section className="error-state status-message" role="alert">{actionError}</section> : null}

      <div className="note-detail-layout">
        <div className="note-detail-main">
          <section className="reading-surface" style={{ background: 'transparent', padding: 0, gap: '1.25rem' }}>
            <div className="meta-row">
              <span>{wordCount} words</span>
              <span>{readingMinutes} min read</span>
              <span>{scriptureCount} ref{scriptureCount === 1 ? '' : 's'}</span>
              <span>{authorLabel}</span>
            </div>
            <div
              className="note-body-content"
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.9,
                color: 'var(--text)',
                fontSize: '1.02rem',
                minHeight: '220px',
              }}
            >
              {(note.body ?? '').trim() ? (
                <ScriptureReferenceText
                  text={(note.body ?? '').trim()}
                  onReferenceClick={setActiveReference}
                />
              ) : (
                'No body content yet.'
              )}
            </div>
          </section>

          {note.source === 'shared' && note.clips?.length ? (
            <NoteClipsList
              clips={note.clips}
              title="Shared audio clips"
              description="These clips stay attached to the original shared note and can be previewed or downloaded here."
            />
          ) : null}

          {note.source === 'shared' ? (
            <GroupNoteComments
              groupId={groupId}
              noteId={note.id}
              sharePermission={note.permissions}
              sharedBy={note.shared_by}
            />
          ) : (
            <section className="support-tray" style={{ gap: '0.75rem' }}>
              <span className="eyebrow">Comments</span>
              <strong>Comments are not available for this note yet.</strong>
              <span className="support-block-copy">
                You can still read and reuse this group note, but commenting is currently limited to shared personal notes.
              </span>
            </section>
          )}

          <section className="support-tray">
            <div className="support-block" style={{ gap: '0.35rem' }}>
              <span className="eyebrow">Shared note workflow</span>
              <strong className="support-block-title">
                {note.source === 'shared' ? 'Manage or reuse this shared note' : 'Reuse this group note'}
              </strong>
              <p className="support-block-copy">
                {note.source === 'shared'
                  ? 'Choose what you want to do next with this shared note.'
                  : 'You can copy this group note into your own notes if you want to keep working with it personally.'}
              </p>
            </div>

            <div className="cta-row">
              <button
                className="button button-primary"
                type="button"
                disabled={duplicating}
                onClick={onCopyToMyNotes}
              >
                {duplicating ? 'Copying…' : 'Copy to my notes'}
              </button>

              {note.source === 'shared' && note.permissions === 'edit' ? (
                <Link className="button button-secondary" href={`/notes/shared/${note.id}/edit`}>
                  Edit together
                </Link>
              ) : null}

              {canOpenOriginal ? (
                <Link className="button button-secondary" href={`/notes/${note.id}`}>
                  Open original note
                </Link>
              ) : null}

              {canManageShare ? (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={unsharing}
                  onClick={onRemoveFromGroup}
                >
                  {unsharing ? 'Removing…' : 'Remove from this group'}
                </button>
              ) : null}

              {canEditGroupNote && note.source === 'group' ? (
                <Link className="button button-secondary" href={`/groups/${groupId}/notes/${note.id}/edit`}>
                  Edit group note
                </Link>
              ) : null}
            </div>
          </section>

          <div className="cta-row">
            <Link className="button button-secondary" href={`/groups/${groupId}`}>
              Back to group
            </Link>
          </div>
        </div>

        <aside className="note-detail-rail">
          {activeReference ? (
            <ScriptureReferencePreview reference={activeReference} onClose={() => setActiveReference(null)} />
          ) : null}

          {references.length > 0 ? (
            <div className="inline-support-stack">
              <div className="support-block">
                <span className="eyebrow">Detected references</span>
                <p className="support-block-copy">Read references in place while staying close to the note.</p>
              </div>
              <div className="note-reference-row">
                {references.map((reference) => (
                  <button
                    key={reference}
                    type="button"
                    className="button button-secondary"
                    onClick={() => setActiveReference(reference)}
                  >
                    {reference}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
