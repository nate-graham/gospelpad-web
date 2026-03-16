'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { addSharedNoteComment, listSharedNoteComments, type SharedNoteComment } from '@/lib/group-comments';

type SharedNoteCommentsProps = {
  noteId: string;
};

export function SharedNoteComments({ noteId }: SharedNoteCommentsProps) {
  const [comments, setComments] = useState<SharedNoteComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!active) return;
          setViewerId(user?.id ?? null);
        }

        const data = await listSharedNoteComments(noteId);
        if (!active) return;
        setComments(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load comments.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [noteId]);

  const commentCountLabel = useMemo(
    () => `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`,
    [comments.length]
  );

  const submitComment = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    try {
      setSending(true);
      setError(null);
      await addSharedNoteComment(noteId, trimmed);
      const data = await listSharedNoteComments(noteId);
      setComments(data);
      setDraft('');
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : 'Failed to add comment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div className="page-header" style={{ gap: '0.35rem' }}>
        <span className="eyebrow">Shared note comments</span>
        <strong style={{ fontSize: '1.1rem' }}>{commentCountLabel}</strong>
        <span style={{ color: 'var(--muted)' }}>
          Keep the conversation going with everyone who can access this shared note.
        </span>
      </div>

      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}

      {loading ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading comments…</strong>
          <span style={{ color: 'var(--muted)' }}>Fetching the current shared-note discussion.</span>
        </section>
      ) : comments.length === 0 ? (
        <section className="empty-state status-message" role="status">
          <strong>No comments yet</strong>
          <span style={{ color: 'var(--muted)' }}>Start the conversation for everyone who can access this shared note.</span>
        </section>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {comments.map((comment) => (
            <article className="status-card" key={comment.id} style={{ padding: '1rem', display: 'grid', gap: '0.45rem' }}>
              <span style={{ color: 'var(--text)', lineHeight: 1.6 }}>{comment.body}</span>
              <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                {comment.user_id === viewerId ? 'You' : `Member ${comment.user_id.slice(0, 8)}`} • {new Date(comment.created_at).toLocaleString('en-GB')}
              </span>
            </article>
          ))}
        </div>
      )}

      <label style={fieldStyle}>
        <span className="eyebrow" style={labelTextStyle}>Add comment</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a comment about this shared note"
          style={textareaStyle}
        />
      </label>

      <div className="cta-row">
        <button
          className="button button-primary"
          type="button"
          disabled={!draft.trim() || sending}
          onClick={submitComment}
        >
          {sending ? 'Sending…' : 'Send comment'}
        </button>
      </div>
    </section>
  );
}

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.72rem',
};

const textareaStyle: React.CSSProperties = {
  minHeight: 110,
  borderRadius: 18,
  border: '1px solid var(--line)',
  padding: '1rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
  resize: 'vertical',
};
