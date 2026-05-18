'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  approveJoinRequest,
  createGroupAnnouncement,
  deleteGroupAnnouncement,
  declineJoinRequest,
  getCurrentMembership,
  getGroupById,
  leaveGroup,
  listGroupAnnouncements,
  listGroupJoinRequests,
  listGroupMembers,
  listGroupNativeNotes,
  listGroupSharedNotes,
  removeGroupMember,
  updateGroupMemberRole,
  type Group,
  type GroupAnnouncement,
  type GroupJoinRequestSummary,
  type GroupMemberSummary,
  type GroupMembership,
  type GroupNativeNoteSummary,
  type GroupSharedNoteSummary,
} from '@/lib/groups';
import { formatGroupDate, getGroupMemberLabel, getGroupVisibilityLabel } from '@/components/groups/group-utils';
import { getNoteExcerpt, getScriptureReferenceCount } from '@/components/notes/note-utils';
import { GroupInvitePanel } from '@/components/groups/group-invite-panel';

export function GroupDetailView({ groupId }: { groupId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMembership | null>(null);
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequestSummary[]>([]);
  const [nativeNotes, setNativeNotes] = useState<GroupNativeNoteSummary[]>([]);
  const [sharedNotes, setSharedNotes] = useState<GroupSharedNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [nextGroup, nextMembership, nextMembers, nextAnnouncements, nextNativeNotes, nextSharedNotes] = await Promise.all([
          getGroupById(groupId),
          getCurrentMembership(groupId),
          listGroupMembers(groupId),
          listGroupAnnouncements(groupId),
          listGroupNativeNotes(groupId),
          listGroupSharedNotes(groupId),
        ]);

        if (!active) return;

        setGroup(nextGroup);
        setMembership(nextMembership);
        setMembers(nextMembers);
        setAnnouncements(nextAnnouncements);
        setNativeNotes(nextNativeNotes);
        setSharedNotes(nextSharedNotes);

        const canLoadRequests =
          nextMembership &&
          (nextMembership.role === 'admin' || (nextGroup?.created_by ?? null) === nextMembership.user_id);

        if (canLoadRequests) {
          const nextRequests = await listGroupJoinRequests(groupId);
          if (!active) return;
          setJoinRequests(nextRequests);
        } else {
          setJoinRequests([]);
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load group.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [groupId]);

  const successMessage = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Group created successfully.';
    if (searchParams.get('left') === '1') return 'You left the group.';
    if (searchParams.get('unshared') === '1') return 'Shared note removed from this group.';
    return null;
  }, [searchParams]);

  const canManageRequests = Boolean(
    membership && (membership.role === 'admin' || (group?.created_by ?? null) === membership.user_id)
  );
  const canManageAnnouncements = canManageRequests;
  const canLeaveGroup = Boolean(membership && (group?.created_by ?? null) !== membership.user_id);
  const isOwner = Boolean(membership && (group?.created_by ?? null) === membership.user_id);
  const memberMap = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);

  const getRequestLabel = (request: GroupJoinRequestSummary) =>
    request.name?.trim() || request.display_name?.trim() || request.username?.trim() || 'Pending member';
  const getMemberRoleSummary = (member: GroupMemberSummary) =>
    member.is_owner ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member';

  const canRemoveMember = (member: GroupMemberSummary) => {
    if (!membership || member.user_id === membership.user_id || member.is_owner) return false;
    if (isOwner) return true;
    return membership.role === 'admin' && member.role === 'member';
  };

  const canToggleAdmin = (member: GroupMemberSummary) =>
    Boolean(isOwner && !member.is_owner && member.user_id !== membership?.user_id);

  const getAnnouncementAuthorLabel = (announcement: GroupAnnouncement) => {
    const author = announcement.created_by ? memberMap.get(announcement.created_by) : null;
    return author ? getGroupMemberLabel(author) : 'Group admin';
  };

  const onLeaveGroup = async () => {
    if (!group || !canLeaveGroup) return;
    if (!window.confirm(`Leave ${group.name}? You will lose access to its shared notes and member activity.`)) {
      return;
    }

    try {
      setPendingAction('leave');
      setActionError(null);
      setActionNotice(null);
      await leaveGroup(group.id);
      router.replace('/groups?left=1');
    } catch (leaveError) {
      setActionError(leaveError instanceof Error ? leaveError.message : 'Failed to leave group.');
    } finally {
      setPendingAction(null);
    }
  };

  const onApproveRequest = async (request: GroupJoinRequestSummary) => {
    if (!window.confirm(`Approve ${getRequestLabel(request)} to join this group?`)) {
      return;
    }

    try {
      setPendingAction(`approve-${request.id}`);
      setActionError(null);
      setActionNotice(null);
      await approveJoinRequest(request.id, request.group_id, request.user_id);
      const [nextMembers, nextRequests] = await Promise.all([
        listGroupMembers(groupId),
        listGroupJoinRequests(groupId),
      ]);
      setMembers(nextMembers);
      setJoinRequests(nextRequests);
      setActionNotice(`${getRequestLabel(request)} joined the group.`);
    } catch (approveError) {
      setActionError(approveError instanceof Error ? approveError.message : 'Failed to approve join request.');
    } finally {
      setPendingAction(null);
    }
  };

  const onDeclineRequest = async (request: GroupJoinRequestSummary) => {
    if (!window.confirm(`Decline ${getRequestLabel(request)}'s request to join this group?`)) {
      return;
    }

    try {
      setPendingAction(`decline-${request.id}`);
      setActionError(null);
      setActionNotice(null);
      await declineJoinRequest(request.id);
      const nextRequests = await listGroupJoinRequests(groupId);
      setJoinRequests(nextRequests);
      setActionNotice(`Declined ${getRequestLabel(request)}'s join request.`);
    } catch (declineError) {
      setActionError(declineError instanceof Error ? declineError.message : 'Failed to decline join request.');
    } finally {
      setPendingAction(null);
    }
  };

  const onRemoveMember = async (member: GroupMemberSummary) => {
    if (!window.confirm(`Remove ${getGroupMemberLabel(member)} from this group?`)) {
      return;
    }

    try {
      setPendingAction(`remove-${member.id}`);
      setActionError(null);
      setActionNotice(null);
      await removeGroupMember(groupId, member.id);
      const nextMembers = await listGroupMembers(groupId);
      setMembers(nextMembers);
      setActionNotice(`${getGroupMemberLabel(member)} was removed from the group.`);
    } catch (removeError) {
      setActionError(removeError instanceof Error ? removeError.message : 'Failed to remove member.');
    } finally {
      setPendingAction(null);
    }
  };

  const onToggleAdmin = async (member: GroupMemberSummary) => {
    const nextRole = member.role === 'admin' ? 'member' : 'admin';

    if (
      !window.confirm(
        nextRole === 'admin'
          ? `Promote ${getGroupMemberLabel(member)} to admin?`
          : `Demote ${getGroupMemberLabel(member)} to member?`
      )
    ) {
      return;
    }

    try {
      setPendingAction(`role-${member.id}`);
      setActionError(null);
      setActionNotice(null);
      await updateGroupMemberRole(groupId, member.id, nextRole);
      const nextMembers = await listGroupMembers(groupId);
      setMembers(nextMembers);
      setActionNotice(
        nextRole === 'admin'
          ? `${getGroupMemberLabel(member)} is now an admin.`
          : `${getGroupMemberLabel(member)} is now a member.`
      );
    } catch (roleError) {
      setActionError(roleError instanceof Error ? roleError.message : 'Failed to update member role.');
    } finally {
      setPendingAction(null);
    }
  };

  const onCreateAnnouncement = async () => {
    if (!canManageAnnouncements || !group) return;
    const title = announcementTitle.trim();

    if (!title) {
      setActionError('Announcement title is required.');
      return;
    }

    try {
      setPendingAction('create-announcement');
      setActionError(null);
      setActionNotice(null);
      const created = await createGroupAnnouncement({
        groupId: group.id,
        title,
        body: announcementBody,
      });
      setAnnouncements((current) => [created, ...current]);
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setActionNotice('Announcement posted.');
    } catch (announcementError) {
      setActionError(announcementError instanceof Error ? announcementError.message : 'Failed to post announcement.');
    } finally {
      setPendingAction(null);
    }
  };

  const onDeleteAnnouncement = async (announcement: GroupAnnouncement) => {
    if (!canManageAnnouncements) return;
    if (!window.confirm(`Delete "${announcement.title}"?`)) {
      return;
    }

    try {
      setPendingAction(`delete-announcement-${announcement.id}`);
      setActionError(null);
      setActionNotice(null);
      await deleteGroupAnnouncement(announcement.id);
      setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
      setActionNotice('Announcement deleted.');
    } catch (announcementError) {
      setActionError(announcementError instanceof Error ? announcementError.message : 'Failed to delete announcement.');
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Loading group…</strong>
        <span style={{ color: 'var(--muted)' }}>Pulling the current group details from Supabase.</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Unable to load group</strong>
        <span style={{ color: 'var(--muted)' }}>{error}</span>
        <Link className="button button-secondary" href="/groups">
          Back to groups
        </Link>
      </section>
    );
  }

  if (!group) {
    return (
      <section className="empty-state status-message" role="status">
        <strong>Group not found</strong>
        <span style={{ color: 'var(--muted)' }}>This group may have been removed or is no longer available.</span>
        <Link className="button button-primary" href="/groups">
          Return to groups
        </Link>
      </section>
    );
  }

  if (!membership && group.created_by !== null) {
    return (
      <section className="error-state status-message" role="alert">
        <strong>Group access is limited</strong>
        <span style={{ color: 'var(--muted)' }}>
          You need to be part of this group to view its members, notes, and announcements.
        </span>
        <Link className="button button-secondary" href="/groups">
          Back to groups
        </Link>
      </section>
    );
  }

  return (
    <div className="page-container page-section">
      <header className="hero-surface">
        <div className="meta-row">
          <span className="badge">{getGroupVisibilityLabel(group)}</span>
          {membership ? <span>Your role: {membership.role}</span> : null}
        </div>
        <h1>{group.name}</h1>
        <p className="page-description">
          {group.description?.trim() || 'No description yet.'}
        </p>
      </header>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}
      {actionNotice ? <section className="empty-state status-message" role="status">{actionNotice}</section> : null}
      {actionError ? <section className="error-state status-message" role="alert">{actionError}</section> : null}

      <div className="group-screen-grid">
        <div className="group-screen-main">
      <section className="support-tray" style={{ gap: '0.55rem' }}>
        <div className="meta-row">
          <span>Created {formatGroupDate(group.created_at)}</span>
          <span>{group.is_public ? 'Members can join instantly.' : 'Private groups require a join request.'}</span>
        </div>
      </section>

      <GroupInvitePanel group={group} membership={membership} />

      <section className="reading-surface" style={{ background: 'transparent', padding: 0, gap: '1rem' }}>
        <div className="support-block" style={{ gap: '0.35rem' }}>
          <span className="eyebrow">Announcements</span>
          <strong className="support-block-title">
            {announcements.length} {announcements.length === 1 ? 'announcement' : 'announcements'}
          </strong>
          <p className="support-block-copy">
            Keep everyone in the group up to date from one place.
          </p>
        </div>

        {canManageAnnouncements ? (
          <div
            className="support-tray"
            style={{
              display: 'grid',
              gap: '0.85rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Announcement title</span>
              <input
                value={announcementTitle}
                onChange={(event) => setAnnouncementTitle(event.target.value)}
                placeholder="Announcement title"
                style={inputStyle}
              />
            </label>

            <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <span className="eyebrow" style={labelTextStyle}>Announcement details</span>
              <textarea
                value={announcementBody}
                onChange={(event) => setAnnouncementBody(event.target.value)}
                placeholder="Optional details for the group"
                style={textareaStyle}
              />
            </label>

            <div className="cta-row">
              <button
                className="button button-primary"
                type="button"
                disabled={pendingAction === 'create-announcement'}
                onClick={onCreateAnnouncement}
              >
                {pendingAction === 'create-announcement' ? 'Posting…' : 'Post announcement'}
              </button>
            </div>
          </div>
        ) : (
          <section className="support-block">
            <strong>Member view</strong>
            <span className="support-block-copy">
              Only the group owner and admins can post or delete announcements.
            </span>
          </section>
        )}

        {announcements.length === 0 ? (
          <section className="empty-state status-message" role="status">
            <strong>No announcements yet</strong>
            <span style={{ color: 'var(--muted)' }}>
              Group-wide updates posted by the owner or admins will appear here.
            </span>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {announcements.map((announcement) => (
              <article key={announcement.id} style={{ display: 'grid', gap: '0.6rem', padding: '0.35rem 0 1rem', borderBottom: '1px solid rgba(255, 248, 235, 0.06)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'grid', gap: '0.3rem' }}>
                    <strong>{announcement.title}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                      Posted by {getAnnouncementAuthorLabel(announcement)} on {formatGroupDate(announcement.created_at)}
                    </span>
                  </div>
                  {canManageAnnouncements ? (
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={pendingAction === `delete-announcement-${announcement.id}`}
                      onClick={() => onDeleteAnnouncement(announcement)}
                    >
                      {pendingAction === `delete-announcement-${announcement.id}` ? 'Deleting…' : 'Delete'}
                    </button>
                  ) : null}
                </div>
                {announcement.body?.trim() ? (
                  <span style={{ color: 'var(--muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {announcement.body.trim()}
                  </span>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="support-tray">
        <div className="support-block" style={{ gap: '0.35rem' }}>
          <span className="eyebrow">Membership</span>
          <strong className="support-block-title">
            {membership ? `You are a ${membership.role}` : 'Access inherited from owner visibility'}
          </strong>
          <p className="support-block-copy">
            Manage your place in the group, review requests, and keep member roles organized.
          </p>
        </div>

        <div className="cta-row">
          {canLeaveGroup ? (
            <button
              className="button button-secondary"
              type="button"
              disabled={pendingAction === 'leave'}
              onClick={onLeaveGroup}
            >
              {pendingAction === 'leave' ? 'Leaving…' : 'Leave group'}
            </button>
          ) : (
            <div className="support-block">
              <strong>{group.created_by === membership?.user_id ? 'Owner cannot leave yet' : 'Membership action unavailable'}</strong>
              <span className="support-block-copy">
                {group.created_by === membership?.user_id
                  ? 'The group owner needs to stay connected to the group right now.'
                  : 'This account does not currently have a leave action available.'}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="two-column-layout">
        <section className="reading-surface" style={{ background: 'transparent', padding: 0 }}>
          <div className="support-block" style={{ gap: '0.35rem' }}>
            <span className="eyebrow">Members</span>
            <strong className="support-block-title">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </strong>
            <p className="support-block-copy">
              See who is in the group and what role they hold.
            </p>
          </div>

          {members.length === 0 ? (
            <section className="empty-state status-message" role="status">
              <strong>No members found</strong>
              <span style={{ color: 'var(--muted)' }}>
                No visible members were returned for this group.
              </span>
            </section>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {members.map((member) => (
                <article key={member.id} style={{ display: 'grid', gap: '0.45rem', padding: '0.35rem 0 1rem', borderBottom: '1px solid rgba(255, 248, 235, 0.06)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{getGroupMemberLabel(member)}</strong>
                    {member.is_owner ? <span className="badge">Owner</span> : null}
                    {!member.is_owner && member.role === 'admin' ? <span className="badge">Admin</span> : null}
                    {member.user_id === membership?.user_id ? <span className="badge">You</span> : null}
                  </div>
                  <span style={{ color: 'var(--muted)' }}>
                    {member.username ? `@${member.username}` : 'No public username'} • Joined {formatGroupDate(member.joined_at)}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>
                    Role: {getMemberRoleSummary(member)}
                  </span>
                  {canRemoveMember(member) || canToggleAdmin(member) ? (
                    <div className="cta-row">
                      {canToggleAdmin(member) ? (
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={pendingAction === `role-${member.id}` || pendingAction === `remove-${member.id}`}
                          onClick={() => onToggleAdmin(member)}
                        >
                          {pendingAction === `role-${member.id}`
                            ? 'Updating…'
                            : member.role === 'admin'
                              ? 'Make member'
                              : 'Make admin'}
                        </button>
                      ) : null}
                      {canRemoveMember(member) ? (
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={pendingAction === `role-${member.id}` || pendingAction === `remove-${member.id}`}
                          onClick={() => onRemoveMember(member)}
                        >
                          {pendingAction === `remove-${member.id}` ? 'Removing…' : 'Remove member'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="reading-surface" style={{ background: 'transparent', padding: 0 }}>
          <div className="support-block" style={{ gap: '0.35rem' }}>
            <span className="eyebrow">Group notes</span>
            <strong className="support-block-title">
              {nativeNotes.length} {nativeNotes.length === 1 ? 'group note' : 'group notes'}
            </strong>
            <p className="support-block-copy">
              Keep shared study notes and meeting notes together for the whole group.
            </p>
          </div>

          <div className="cta-row">
            <Link className="button button-primary" href={`/groups/${group.id}/notes/new`}>
              New group note
            </Link>
          </div>

          {nativeNotes.length === 0 ? (
            <section className="empty-state status-message" role="status">
              <strong>No group notes yet</strong>
              <span style={{ color: 'var(--muted)' }}>
                This group does not have any dedicated group notes yet.
              </span>
            </section>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {nativeNotes.map((note) => (
                <article key={note.id} style={{ display: 'grid', gap: '0.55rem', padding: '0.35rem 0 1rem', borderBottom: '1px solid rgba(255, 248, 235, 0.06)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{note.title?.trim() || 'Untitled'}</strong>
                    <span className="badge">group note</span>
                  </div>
                  <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{getNoteExcerpt(note)}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', color: 'var(--muted)' }}>
                    <span>Updated {formatGroupDate(note.updated_at)}</span>
                    <span>{getScriptureReferenceCount(note)} scripture refs</span>
                  </div>
                  <div className="cta-row">
                    <Link className="button button-secondary" href={`/groups/${group.id}/notes/${note.id}`}>
                      Open group note
                    </Link>
                    {membership && (membership.role === 'admin' || membership.user_id === note.created_by) ? (
                      <Link className="button button-secondary" href={`/groups/${group.id}/notes/${note.id}/edit`}>
                        Edit group note
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {canManageRequests && !group.is_public ? (
        <section className="support-tray">
          <div className="support-block" style={{ gap: '0.35rem' }}>
            <span className="eyebrow">Join requests</span>
            <strong className="support-block-title">
              {joinRequests.length} {joinRequests.length === 1 ? 'pending request' : 'pending requests'}
            </strong>
            <p className="support-block-copy">
              Private groups can review pending requests here. Public groups join immediately and do not use this queue.
            </p>
          </div>

          {joinRequests.length === 0 ? (
            <section className="empty-state status-message" role="status">
              <strong>No pending join requests</strong>
              <span style={{ color: 'var(--muted)' }}>
                New private-group join requests will appear here for admins and the owner.
              </span>
            </section>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {joinRequests.map((request) => (
                <article key={request.id} style={{ display: 'grid', gap: '0.65rem', padding: '0.35rem 0 1rem', borderBottom: '1px solid rgba(255, 248, 235, 0.06)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{getRequestLabel(request)}</strong>
                    <span className="badge">{request.username ? `@${request.username}` : 'Pending member'}</span>
                  </div>
                  <span style={{ color: 'var(--muted)' }}>
                    Requested {formatGroupDate(request.created_at)}
                  </span>
                  <div className="cta-row">
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={pendingAction === `approve-${request.id}` || pendingAction === `decline-${request.id}`}
                      onClick={() => onApproveRequest(request)}
                    >
                      {pendingAction === `approve-${request.id}` ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={pendingAction === `approve-${request.id}` || pendingAction === `decline-${request.id}`}
                      onClick={() => onDeclineRequest(request)}
                    >
                      {pendingAction === `decline-${request.id}` ? 'Declining…' : 'Decline'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      </div>

      <aside className="group-screen-rail">
      <section className="support-tray">
        <div className="support-block" style={{ gap: '0.35rem' }}>
          <span className="eyebrow">Shared personal notes</span>
          <strong className="support-block-title">
            {sharedNotes.length} {sharedNotes.length === 1 ? 'shared note' : 'shared notes'}
          </strong>
          <p className="support-block-copy">
            These are personal notes that people have shared into the group.
          </p>
        </div>

        {sharedNotes.length === 0 ? (
          <section className="empty-state status-message" role="status">
            <strong>No shared personal notes yet</strong>
            <span style={{ color: 'var(--muted)' }}>
              Shared notes will appear here when someone shares one into the group.
            </span>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {sharedNotes.map((note) => (
              <article key={`shared-${note.id}`} style={{ display: 'grid', gap: '0.55rem', padding: '0.35rem 0 1rem', borderBottom: '1px solid rgba(255, 248, 235, 0.06)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <strong>{note.title?.trim() || 'Untitled'}</strong>
                  <span className="badge">{note.permissions}</span>
                  {note.type ? <span style={{ color: 'var(--muted)' }}>{note.type}</span> : null}
                </div>
                <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{getNoteExcerpt(note)}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', color: 'var(--muted)' }}>
                  <span>Updated {formatGroupDate(note.updated_at)}</span>
                  <span>{getScriptureReferenceCount(note)} scripture refs</span>
                </div>
                <Link className="button button-secondary" href={`/groups/${group.id}/notes/${note.id}`}>
                  Open shared note
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="support-tray" style={{ gap: '0.75rem' }}>
        <span className="eyebrow">Current scope</span>
        <strong>Groups bring announcements, members, shared notes, and group notes together in one place.</strong>
        <span className="support-block-copy">
          More advanced group management options will be added over time.
        </span>
      </section>
      </aside>
      </div>

      <div className="cta-row">
        <Link className="button button-secondary" href="/groups">
          Back to groups
        </Link>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.72rem',
};

const inputStyle: React.CSSProperties = {
  minHeight: 54,
  borderRadius: 18,
  padding: '0.95rem 1.05rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
};

const textareaStyle: React.CSSProperties = {
  minHeight: 120,
  borderRadius: 18,
  padding: '1rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
  resize: 'vertical',
};
