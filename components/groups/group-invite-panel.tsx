'use client';

import { useMemo, useState } from 'react';
import { getGroupInviteLink, type Group, type GroupMembership } from '@/lib/groups';

export function GroupInvitePanel({
  group,
  membership,
}: {
  group: Group;
  membership: GroupMembership | null;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canInvite = Boolean(membership && (membership.role === 'admin' || group.created_by === membership.user_id));
  const inviteLink = useMemo(() => getGroupInviteLink(group.invite_code), [group.invite_code]);

  const copyText = async (value: string, successMessage: string) => {
    try {
      setError(null);
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
    } catch {
      setError('Copy failed in this browser. You can still select and copy the text manually.');
    }
  };

  return (
    <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div className="page-header" style={{ gap: '0.35rem' }}>
        <span className="eyebrow">Invite</span>
        <strong style={{ fontSize: '1.1rem' }}>
          {canInvite ? 'Share this group safely' : 'Invite sharing is limited'}
        </strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          {canInvite
            ? 'Owners and admins can share a reusable invite link or the invite code. Public groups join immediately; private groups create a join request for review.'
            : 'Only the owner or an admin can issue invites for this group. Members can still see the group status here, but they should ask an admin to share the invite.'}
        </span>
      </div>

      {canInvite ? (
        <>
          <div className="responsive-grid compact">
            <article className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.45rem' }}>
              <span className="eyebrow">Invite code</span>
              <strong style={{ fontSize: '1.25rem', letterSpacing: '0.08em' }}>{group.invite_code}</strong>
              <span style={{ color: 'var(--muted)' }}>
                Anyone with this code can use the existing join flow.
              </span>
            </article>
            <article className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.45rem' }}>
              <span className="eyebrow">Invite link</span>
              <strong style={{ fontSize: '1rem', overflowWrap: 'anywhere' }}>{inviteLink}</strong>
              <span style={{ color: 'var(--muted)' }}>
                Send this link directly so the code is prefilled on the web join page.
              </span>
            </article>
          </div>

          <div className="cta-row">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => void copyText(group.invite_code, 'Invite code copied.')}
            >
              Copy invite code
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void copyText(inviteLink, 'Invite link copied.')}
            >
              Copy invite link
            </button>
          </div>
        </>
      ) : (
        <section className="empty-state status-message" role="status">
          <strong>Ask an admin to invite someone</strong>
          <span style={{ color: 'var(--muted)' }}>
            This group already has an invite flow, but only admins and the owner can issue the shareable code or link from the web app.
          </span>
        </section>
      )}

      {notice ? <section className="empty-state status-message" role="status">{notice}</section> : null}
      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}
    </section>
  );
}
