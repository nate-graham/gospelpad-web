'use client';

import { useEffect, useMemo, useState } from 'react';
import { addSharedNoteComment, listSharedNoteComments, type SharedNoteComment } from '@/lib/group-comments';
import { listGroupMembers, type GroupMemberSummary } from '@/lib/groups';

function formatCommentDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getMemberLabel(member: GroupMemberSummary) {
  return member.name?.trim() || member.display_name?.trim() || member.username?.trim() || 'Group member';
}

export function GroupNoteComments({
  groupId,
  noteId,
  sharePermission,
  sharedBy,
}: {
  groupId: string;
  noteId: string;
  sharePermission: 'view' | 'comment' | 'edit';
  sharedBy: string | null;
}) {
  const [comments, setComments] = useState<SharedNoteComment[]>([]);
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [nextComments, nextMembers] = await Promise.all([
          listSharedNoteComments(noteId),
          listGroupMembers(groupId),
        ]);
        if (!active) return;
        setComments(nextComments);
        setMembers(nextMembers);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load comments.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [groupId, noteId]);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.user_id, member])),
    [members]
  );

  const canComment = sharePermission === 'comment' || sharePermission === 'edit';

  const onSubmit = async () => {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const created = await addSharedNoteComment(noteId, draft);
      setComments((current) => [...current, created]);
      setDraft('');
      setNotice('Comment added.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to add comment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div className="page-header" style={{ gap: '0.35rem' }}>
        <span className="eyebrow">Comments</span>
        <strong style={{ fontSize: '1.1rem' }}>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Group members can talk about shared notes here.
        </span>
      </div>

      {loading ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading comments…</strong>
          <span style={{ color: 'var(--muted)' }}>Pulling the current shared-note discussion for this group.</span>
        </section>
      ) : null}

      {!loading && comments.length === 0 ? (
        <section className="empty-state status-message" role="status">
          <strong>No comments yet</strong>
          <span style={{ color: 'var(--muted)' }}>
            This shared note does not have any group discussion yet.
          </span>
        </section>
      ) : null}

      {!loading && comments.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {comments.map((comment) => {
            const member = memberMap.get(comment.user_id);
            const authorLabel = member
              ? getMemberLabel(member)
              : comment.user_id === sharedBy
                ? 'Shared note owner'
                : 'Group member';
            const secondaryLabel = member?.username
              ? `@${member.username}`
              : member?.is_owner
                ? 'Owner'
                : member?.role === 'admin'
                  ? 'Admin'
                  : 'Member';

            return (
              <article
                key={comment.id}
                className="status-card"
                style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <strong>{authorLabel}</strong>
                  <span className="badge">{secondaryLabel}</span>
                  <span style={{ color: 'var(--muted)' }}>{formatCommentDate(comment.created_at)}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: 'var(--text)' }}>{comment.body}</div>
              </article>
            );
          })}
        </div>
      ) : null}

      {canComment ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label htmlFor="group-note-comment" className="eyebrow">
            Add comment
          </label>
          <textarea
            id="group-note-comment"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Add a comment for the group…"
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--line)',
              background: 'var(--field-bg)',
              color: 'var(--text)',
              padding: '0.9rem 1rem',
              resize: 'vertical',
              minHeight: '120px',
            }}
          />
          <div className="cta-row">
            <button
              className="button button-primary"
              type="button"
              disabled={saving || draft.trim().length === 0}
              onClick={onSubmit}
            >
              {saving ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </div>
      ) : (
        <section className="empty-state status-message" role="status">
          <strong>Comments are read-only for this share</strong>
          <span style={{ color: 'var(--muted)' }}>
            This note is visible in the group, but the current share permission is `{sharePermission}` rather than `comment` or `edit`.
          </span>
        </section>
      )}

      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}
      {notice ? <section className="empty-state status-message" role="status">{notice}</section> : null}
    </section>
  );
}
