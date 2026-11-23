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

  if (!canInvite) {
    return (
      <section className="invite-card is-muted">
        <span className="rail-heading">Invite people</span>
        <p>Only the owner or an admin can share this group’s invite. Ask one of them to send it.</p>
      </section>
    );
  }

  return (
    <section className="invite-card">
      <span className="invite-card-heading">Invite people</span>
      <p>
        {group.is_public
          ? 'Share the link or the code. Because this group is public, people join straight away.'
          : 'Share the link or the code. Because this group is private, each person sends a join request for you to review.'}
      </p>
      <span className="invite-card-label">Invite link</span>
      <div className="invite-card-row">
        <input aria-label="Invite link" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} />
        <button className="button button-lapis" type="button" onClick={() => void copyText(inviteLink, 'Invite link copied.')}>
          Copy
        </button>
      </div>
      <span className="invite-card-label">Invite code</span>
      <div className="invite-card-row">
        <strong className="invite-code">{group.invite_code}</strong>
        <button className="button button-secondary" type="button" onClick={() => void copyText(group.invite_code, 'Invite code copied.')}>
          Copy code
        </button>
      </div>
      {notice ? <span className="invite-card-notice" role="status">{notice}</span> : null}
      {error ? <span className="invite-card-notice is-error" role="alert">{error}</span> : null}
    </section>
  );
}
