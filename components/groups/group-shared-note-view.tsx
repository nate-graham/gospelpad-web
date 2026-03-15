'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export function GroupSharedNoteView({
  groupId,
  noteId,
}: {
  groupId: string;
  noteId: string;
}) {
  const router = useRouter();
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
        is_lucid_dream: false,
        dream_role: null,
      });
      router.push(`/notes/${duplicateId}?created=1`);
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
    <div className="page-section">
      <header className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', alignItems: 'center' }}>
          <span className="badge">
            {note.source === 'group' ? 'Group note' : (note.type ?? 'Shared note')}
          </span>
          {note.source === 'shared' ? <span style={{ color: 'var(--muted)' }}>Permission: {note.permissions}</span> : null}
          {'speaker' in note && note.speaker ? <span style={{ color: 'var(--muted)' }}>Speaker: {note.speaker}</span> : null}
        </div>
        <h1>{note.title?.trim() || 'Untitled'}</h1>
        <p className="page-description">
          {note.source === 'shared'
            ? `Shared to this group ${formatNoteDate(note.shared_at)} • Updated ${formatNoteDate(note.updated_at)}`
            : `Created ${formatNoteDate(note.created_at)} • Updated ${formatNoteDate(note.updated_at)}`}
        </p>
      </header>

      {actionNotice ? <section className="empty-state status-message" role="status">{actionNotice}</section> : null}
      {actionError ? <section className="error-state status-message" role="alert">{actionError}</section> : null}

      {activeReference ? (
        <ScriptureReferencePreview reference={activeReference} onClose={() => setActiveReference(null)} />
      ) : null}

      <section
        style={{
          display: 'grid',
          gap: '0.85rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        }}
      >
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Length</span>
          <strong style={{ fontSize: '1.15rem' }}>{wordCount} words</strong>
          <span style={{ color: 'var(--muted)' }}>{readingMinutes} min read</span>
        </article>
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Scripture</span>
          <strong style={{ fontSize: '1.15rem' }}>{scriptureCount}</strong>
          <span style={{ color: 'var(--muted)' }}>
            {scriptureCount === 1 ? 'reference detected' : 'references detected'}
          </span>
        </article>
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Preview</span>
          <strong style={{ fontSize: '1.05rem' }}>{getNoteExcerpt(note)}</strong>
          <span style={{ color: 'var(--muted)' }}>
            {note.source === 'shared'
              ? 'This note is visible through the existing note sharing model.'
              : 'This note comes from the dedicated group note sessions already stored in the repo.'}
          </span>
        </article>
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Source</span>
          <strong style={{ fontSize: '1.05rem' }}>{authorLabel}</strong>
          <span style={{ color: 'var(--muted)' }}>
            {note.source === 'shared'
              ? canManageShare
                ? 'You own the original note and can still manage its sharing.'
                : 'This is a shared personal note that still lives in someone else’s note library.'
              : 'This note belongs to the dedicated group note space, not a personal library.'}
          </span>
        </article>
      </section>

      {references.length > 0 ? (
        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
          <span className="eyebrow">Detected references</span>
          <div className="cta-row">
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
              text={(note.body ?? '').trim()}
              onReferenceClick={setActiveReference}
            />
          ) : (
            'No body content yet.'
          )}
        </div>
      </section>

      {note.source === 'shared' ? (
        <GroupNoteComments
          groupId={groupId}
          noteId={note.id}
          sharePermission={note.permissions}
          sharedBy={note.shared_by}
        />
      ) : (
        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
          <span className="eyebrow">Comments</span>
          <strong>Dedicated group-note comments stay deferred.</strong>
          <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            This note lives in `group_notes`. The separate `group_note_comments` table is still too open for a safe web launch, so this pass only enables comments on shared personal notes.
          </span>
        </section>
      )}

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div className="page-header" style={{ gap: '0.35rem' }}>
          <span className="eyebrow">Shared note workflow</span>
          <strong style={{ fontSize: '1.1rem' }}>
            {note.source === 'shared' ? 'Manage or reuse this shared note' : 'Reuse this group note'}
          </strong>
          <span style={{ color: 'var(--muted)' }}>
            {note.source === 'shared'
              ? 'This helps group members understand whether the note is a shared personal note or a dedicated group note, and what they can do next.'
              : 'Dedicated group notes are still separate from personal notes, but you can copy the content into your own library.'}
          </span>
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
        </div>
      </section>

      <div className="cta-row">
        <Link className="button button-secondary" href={`/groups/${groupId}`}>
          Back to group
        </Link>
      </div>
    </div>
  );
}
