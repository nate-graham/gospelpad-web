'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  approveJoinRequest,
  createGroupAnnouncement,
  deleteGroup,
  deleteGroupNotes,
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
import { removeOwnedGroupShare } from '@/lib/notes';

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectingNotes, setSelectingNotes] = useState(false);
  const [selectedNoteKeys, setSelectedNoteKeys] = useState<string[]>([]);
  const [confirmNoteDelete, setConfirmNoteDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTabState] = useState<'feed' | 'notes' | 'announcements' | 'members'>(
    initialTab === 'notes' || initialTab === 'announcements' || initialTab === 'members' ? initialTab : 'feed'
  );
  const setActiveTab = (next: 'feed' | 'notes' | 'announcements' | 'members') => {
    setActiveTabState(next);
    setSelectingNotes(false);
    setSelectedNoteKeys([]);
    setConfirmNoteDelete(false);
  };

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
    if (searchParams.get('noteDeleted') === '1') return 'Group note deleted.';
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

  const isAdminViewer = Boolean(membership && (membership.role === 'admin' || isOwner));
  const canDeleteNativeNote = (note: GroupNativeNoteSummary) =>
    Boolean(membership && (isAdminViewer || note.created_by === membership.user_id));
  const canRemoveSharedNote = (note: GroupSharedNoteSummary) =>
    Boolean(membership && note.shared_by && note.shared_by === membership.user_id);
  const removableCount =
    nativeNotes.filter(canDeleteNativeNote).length + sharedNotes.filter(canRemoveSharedNote).length;

  const toggleNoteKey = (key: string) =>
    setSelectedNoteKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  const stopSelectingNotes = () => {
    setSelectingNotes(false);
    setSelectedNoteKeys([]);
    setConfirmNoteDelete(false);
  };

  const selectedNative = selectedNoteKeys.filter((key) => key.startsWith('g:')).map((key) => key.slice(2));
  const selectedShared = selectedNoteKeys.filter((key) => key.startsWith('s:')).map((key) => key.slice(2));

  const onDeleteSelectedNotes = async () => {
    if (!group || selectedNoteKeys.length === 0) return;
    try {
      setPendingAction('delete-notes');
      setActionError(null);
      setActionNotice(null);
      const deleted = await deleteGroupNotes(selectedNative);
      for (const noteId of selectedShared) {
        await removeOwnedGroupShare(noteId, group.id);
      }
      const [nextNative, nextShared] = await Promise.all([listGroupNativeNotes(group.id), listGroupSharedNotes(group.id)]);
      setNativeNotes(nextNative);
      setSharedNotes(nextShared);
      const parts = [
        deleted ? `${deleted} group ${deleted === 1 ? 'note' : 'notes'} deleted` : '',
        selectedShared.length ? `${selectedShared.length} shared ${selectedShared.length === 1 ? 'note' : 'notes'} removed from the group` : '',
      ].filter(Boolean);
      setActionNotice(parts.length ? `${parts.join(' and ')}.` : 'Nothing was deleted.');
      if (deleted < selectedNative.length) {
        setActionError('Some notes could not be deleted. Only a note’s author or a group admin can delete it.');
      }
      stopSelectingNotes();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Failed to delete notes.');
    } finally {
      setPendingAction(null);
    }
  };

  const onDeleteGroup = async () => {
    if (!group || !isOwner || deleteConfirm.trim() !== group.name.trim()) return;

    try {
      setPendingAction('delete-group');
      setActionError(null);
      setActionNotice(null);
      await deleteGroup(group.id);
      router.replace('/groups?deleted=1');
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Failed to delete group.');
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

  const tab = activeTab;
  const myMember = membership ? memberMap.get(membership.user_id) : undefined;
  const roleLabel = myMember?.is_owner || isOwner ? 'owner' : membership?.role ?? 'member';
  const feed = [
    ...announcements.map((announcement) => ({ kind: 'announcement' as const, at: announcement.created_at, announcement })),
    ...sharedNotes.map((note) => ({ kind: 'shared' as const, at: note.shared_at || note.updated_at, note })),
    ...nativeNotes.map((note) => ({ kind: 'group-note' as const, at: note.updated_at, note })),
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  const memberName = (userId: string | null) => {
    const member = userId ? memberMap.get(userId) : undefined;
    return member ? getGroupMemberLabel(member) : 'A member';
  };

  const announcementComposer = canManageAnnouncements ? (
    <section className="group-composer">
      <span className="rail-heading">Post an announcement</span>
      <input
        aria-label="Announcement title"
        onChange={(event) => setAnnouncementTitle(event.target.value)}
        placeholder="Announce something to the group…"
        value={announcementTitle}
      />
      {announcementTitle.trim() ? (
        <>
      <textarea
            aria-label="Announcement details"
            onChange={(event) => setAnnouncementBody(event.target.value)}
            placeholder="Details for the group (optional)"
            rows={3}
            value={announcementBody}
          />
          <div className="group-composer-actions">
            <button
              className="button button-primary"
              disabled={pendingAction === 'create-announcement' || !announcementTitle.trim()}
              onClick={onCreateAnnouncement}
              type="button"
            >
              {pendingAction === 'create-announcement' ? 'Posting…' : 'Post announcement'}
            </button>
          </div>
        </>
      ) : null}
    </section>
  ) : null;

  return (
    <div className="page-container page-section group-page">
      <Link className="back-link" href="/groups">
        <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 11 18" width="7">
          <path d="M9 1L1 9l8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
        Groups
      </Link>

      <header className="group-header">
        <div className="group-header-text">
          <div className="group-header-eyebrow">
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Group</span>
            <span className="group-visibility">{group.is_public ? 'Public · join instantly' : 'Private · join by request'}</span>
          </div>
          <h1>{group.name}</h1>
          {group.description?.trim() ? <p className="note-page-subtitle">{group.description.trim()}</p> : null}
        </div>
        <div className="group-header-side">
          <div className="avatar-stack" aria-hidden="true">
            {members.slice(0, 4).map((member) => (
              <Avatar key={member.id} member={member} />
            ))}
          </div>
          <span className="group-header-count">
            {members.length} {members.length === 1 ? 'member' : 'members'} ·{' '}
            {roleLabel === 'owner' ? 'you’re the owner' : roleLabel === 'admin' ? 'you’re an admin' : 'you’re a member'}
          </span>
          {canManageRequests ? (
            <button className="button button-secondary" onClick={() => setActiveTab('members')} type="button">
              Invite
            </button>
          ) : null}
        </div>
      </header>

      <nav className="notebook-tabs" aria-label="Group sections">
        <button aria-current={tab === 'feed' ? 'page' : undefined} onClick={() => setActiveTab('feed')} type="button">
          Feed
        </button>
        <button aria-current={tab === 'notes' ? 'page' : undefined} onClick={() => setActiveTab('notes')} type="button">
          Group notes <span>{nativeNotes.length + sharedNotes.length}</span>
        </button>
        <button aria-current={tab === 'announcements' ? 'page' : undefined} onClick={() => setActiveTab('announcements')} type="button">
          Announcements <span>{announcements.length}</span>
        </button>
        <button aria-current={tab === 'members' ? 'page' : undefined} onClick={() => setActiveTab('members')} type="button">
          Members <span>{members.length}</span>
          {canManageRequests && joinRequests.length ? <em className="tab-alert">{joinRequests.length}</em> : null}
        </button>
      </nav>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}
      {actionNotice ? <section className="empty-state status-message" role="status">{actionNotice}</section> : null}
      {actionError ? <section className="error-state status-message" role="alert">{actionError}</section> : null}

      <div className="group-columns">
        <div className="group-main">
          {tab === 'feed' ? (
            <>
              {canManageAnnouncements ? announcementComposer : null}
              <div className="group-quick-actions">
                <Link className="button button-primary" href={`/groups/${group.id}/notes/new`}>
                  + New group note
                </Link>
                <Link className="button button-secondary" href="/notes">
                  Share one of your notes
                </Link>
              </div>
              {feed.length === 0 ? (
                <section className="notebook-empty" role="status">
                  <strong>Nothing here yet</strong>
                  <span>Announcements, group notes and notes people share with the group will appear here.</span>
                </section>
              ) : (
                <ul className="group-feed">
                  {feed.map((item) =>
                    item.kind === 'announcement' ? (
                      <li className="feed-item" key={`a-${item.announcement.id}`}>
                        <div className="feed-meta">
                          <strong>{getAnnouncementAuthorLabel(item.announcement)}</strong>
                          <span className="feed-kind is-lapis">Announcement</span>
                          <time>{shortGroupDate(item.at)}</time>
                        </div>
                        <p className="feed-title">{item.announcement.title}</p>
                        {item.announcement.body?.trim() ? <p className="feed-body">{item.announcement.body.trim()}</p> : null}
                        {canManageAnnouncements ? (
                          <button
                            className="feed-link is-danger"
                            disabled={pendingAction === `delete-announcement-${item.announcement.id}`}
                            onClick={() => onDeleteAnnouncement(item.announcement)}
                            type="button"
                          >
                            {pendingAction === `delete-announcement-${item.announcement.id}` ? 'Deleting…' : 'Delete'}
                          </button>
                        ) : null}
                      </li>
                    ) : item.kind === 'shared' ? (
                      <li className="feed-item" key={`s-${item.note.id}`}>
                        <div className="feed-meta">
                          <strong>{memberName(item.note.shared_by)}</strong>
                          <span>shared a note</span>
                          <time>{shortGroupDate(item.at)}</time>
                        </div>
                        <Link className="feed-note" href={`/groups/${group.id}/notes/${item.note.id}`}>
                          <span className="feed-note-title">“{item.note.title?.trim() || 'Untitled'}”</span>
                          <span className="feed-note-meta">
                            {item.note.type ?? 'Note'}
                            {getScriptureReferenceCount(item.note) ? ` · ¶ ${getScriptureReferenceCount(item.note)} refs` : ''}
                            {item.note.permissions !== 'view' ? ` · members can ${item.note.permissions}` : ''}
                          </span>
                          <span className="feed-body">{getNoteExcerpt(item.note)}</span>
                        </Link>
                      </li>
                    ) : (
                      <li className="feed-item" key={`g-${item.note.id}`}>
                        <div className="feed-meta">
                          <strong>{memberName(item.note.created_by)}</strong>
                          <span className="feed-kind">Group note</span>
                          <time>{shortGroupDate(item.at)}</time>
                        </div>
                        <Link className="feed-note" href={`/groups/${group.id}/notes/${item.note.id}`}>
                          <span className="feed-note-title">{item.note.title?.trim() || 'Untitled'}</span>
                          <span className="feed-body">{getNoteExcerpt(item.note)}</span>
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              )}
            </>
          ) : null}

          {tab === 'notes' ? (
            <>
              <div className="group-quick-actions">
                {selectingNotes ? (
                  <>
                    <button className="button button-secondary" onClick={stopSelectingNotes} type="button">
                      Cancel
                    </button>
                    <button
                      className="button button-vermilion"
                      disabled={selectedNoteKeys.length === 0 || pendingAction === 'delete-notes'}
                      onClick={() => setConfirmNoteDelete(true)}
                      type="button"
                    >
                      Delete{selectedNoteKeys.length ? ` (${selectedNoteKeys.length})` : ''}
                    </button>
                    <span className="composer-hint">Tick the notes to delete.</span>
                  </>
                ) : (
                  <>
                    <Link className="button button-primary" href={`/groups/${group.id}/notes/new`}>
                      + New group note
                    </Link>
                    {removableCount > 0 ? (
                      <button className="button button-secondary" onClick={() => setSelectingNotes(true)} type="button">
                        Select
                      </button>
                    ) : null}
                  </>
                )}
              </div>

              {confirmNoteDelete && selectedNoteKeys.length ? (
                <section className="danger-zone confirm-card" role="alertdialog" aria-label="Confirm delete">
                  <p>
                    {selectedNative.length
                      ? `Delete ${selectedNative.length} group ${selectedNative.length === 1 ? 'note' : 'notes'} and ${selectedNative.length === 1 ? 'its' : 'their'} comments for everyone. This can’t be undone.`
                      : ''}
                    {selectedNative.length && selectedShared.length ? ' ' : ''}
                    {selectedShared.length
                      ? selectedShared.length === 1
                        ? 'Remove your shared note from the group (it stays in your notebook).'
                        : `Remove ${selectedShared.length} of your shared notes from the group (they stay in your notebook).`
                      : ''}
                  </p>
                  <div className="danger-zone-actions">
                    <button className="button button-secondary" onClick={() => setConfirmNoteDelete(false)} type="button">
                      Keep them
                    </button>
                    <button
                      className="button button-vermilion"
                      disabled={pendingAction === 'delete-notes'}
                      onClick={onDeleteSelectedNotes}
                      type="button"
                    >
                      {pendingAction === 'delete-notes' ? 'Deleting…' : 'Yes, delete'}
                    </button>
                  </div>
                </section>
              ) : null}
              {nativeNotes.length + sharedNotes.length === 0 ? (
                <section className="notebook-empty" role="status">
                  <strong>No group notes yet</strong>
                  <span>Write a note for the whole group, or share one of your own notes into it.</span>
                </section>
              ) : (
                <ul className="notebook-list">
                  {nativeNotes.map((note) => (
                    <li key={`g-${note.id}`}>
                      <div className={`notebook-row${selectedNoteKeys.includes(`g:${note.id}`) ? ' is-selected' : ''}`}>
                        {selectingNotes ? (
                          <input
                            aria-label={`Select ${note.title || 'note'}`}
                            checked={selectedNoteKeys.includes(`g:${note.id}`)}
                            disabled={!canDeleteNativeNote(note)}
                            onChange={() => toggleNoteKey(`g:${note.id}`)}
                            type="checkbox"
                          />
                        ) : null}
                        <span className="notebook-type type-berea">Group note</span>
                        <Link className="notebook-row-main" href={`/groups/${group.id}/notes/${note.id}`}>
                          <span className="notebook-row-title">
                            {note.title?.trim() || 'Untitled'}
                            <em> · {memberName(note.created_by)}</em>
                          </span>
                          <span className="notebook-row-excerpt">{getNoteExcerpt(note)}</span>
                        </Link>
                        <span className="notebook-row-meta">
                          {getScriptureReferenceCount(note) ? <span className="verse-chip">¶ {getScriptureReferenceCount(note)}</span> : null}
                          {membership && (membership.role === 'admin' || membership.user_id === note.created_by) ? (
                            <Link className="feed-link" href={`/groups/${group.id}/notes/${note.id}/edit`}>
                              Edit
                            </Link>
                          ) : null}
                          <span className="notebook-date">{shortGroupDate(note.updated_at)}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                  {sharedNotes.map((note) => (
                    <li key={`s-${note.id}`}>
                      <div className={`notebook-row${selectedNoteKeys.includes(`s:${note.id}`) ? ' is-selected' : ''}`}>
                        {selectingNotes ? (
                          <input
                            aria-label={`Select ${note.title || 'note'}`}
                            checked={selectedNoteKeys.includes(`s:${note.id}`)}
                            disabled={!canRemoveSharedNote(note)}
                            onChange={() => toggleNoteKey(`s:${note.id}`)}
                            title={canRemoveSharedNote(note) ? undefined : 'Only the person who shared it can remove it'}
                            type="checkbox"
                          />
                        ) : null}
                        <span className={`notebook-type type-${(note.type ?? 'note').toLowerCase().replace(/[^a-z]+/g, '-')}`}>Shared</span>
                        <Link className="notebook-row-main" href={`/groups/${group.id}/notes/${note.id}`}>
                          <span className="notebook-row-title">
                            {note.title?.trim() || 'Untitled'}
                            <em> · {memberName(note.shared_by)}</em>
                          </span>
                          <span className="notebook-row-excerpt">{getNoteExcerpt(note)}</span>
                        </Link>
                        <span className="notebook-row-meta">
                          <span className="notebook-pill">{note.permissions === 'edit' ? 'Can edit' : note.permissions === 'comment' ? 'Can comment' : 'Read-only'}</span>
                          <span className="notebook-date">{shortGroupDate(note.shared_at || note.updated_at)}</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {tab === 'announcements' ? (
            <>
              {announcementComposer ?? (
                <p className="composer-hint">Only the group owner and admins can post announcements.</p>
              )}
              {announcements.length === 0 ? (
                <section className="notebook-empty" role="status">
                  <strong>No announcements yet</strong>
                  <span>Updates posted by the owner or admins will appear here.</span>
                </section>
              ) : (
                <ul className="group-feed">
                  {announcements.map((announcement) => (
                    <li className="feed-item" key={announcement.id}>
                      <div className="feed-meta">
                        <strong>{getAnnouncementAuthorLabel(announcement)}</strong>
                        <span className="feed-kind is-lapis">Announcement</span>
                        <time>{shortGroupDate(announcement.created_at)}</time>
                      </div>
                      <p className="feed-title">{announcement.title}</p>
                      {announcement.body?.trim() ? <p className="feed-body">{announcement.body.trim()}</p> : null}
                      {canManageAnnouncements ? (
                        <button
                          className="feed-link is-danger"
                          disabled={pendingAction === `delete-announcement-${announcement.id}`}
                          onClick={() => onDeleteAnnouncement(announcement)}
                          type="button"
                        >
                          {pendingAction === `delete-announcement-${announcement.id}` ? 'Deleting…' : 'Delete'}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {tab === 'members' ? (
            <>
              {canManageRequests && !group.is_public ? (
                <section className="rail-section">
                  <span className="rail-heading is-vermilion">
                    Waiting to join · {joinRequests.length}
                  </span>
                  {joinRequests.length === 0 ? (
                    <p className="composer-hint">No one is waiting. New join requests will appear here.</p>
                  ) : (
                    joinRequests.map((request) => (
                      <div className="request-card" key={request.id}>
                        <Avatar member={request} />
                        <span className="member-name">
                          <strong>{getRequestLabel(request)}</strong>
                          <small>
                            {request.username ? `@${request.username} · ` : ''}asked {shortGroupDate(request.created_at)}
                          </small>
                        </span>
                        <button
                          className="button button-primary"
                          disabled={pendingAction === `approve-${request.id}` || pendingAction === `decline-${request.id}`}
                          onClick={() => onApproveRequest(request)}
                          type="button"
                        >
                          {pendingAction === `approve-${request.id}` ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          className="button button-secondary"
                          disabled={pendingAction === `approve-${request.id}` || pendingAction === `decline-${request.id}`}
                          onClick={() => onDeclineRequest(request)}
                          type="button"
                        >
                          {pendingAction === `decline-${request.id}` ? 'Declining…' : 'Decline'}
                        </button>
                      </div>
                    ))
                  )}
                </section>
              ) : null}

              <section className="rail-section">
                <span className="rail-heading member-heading">
                  <span>Members</span>
                  <span>Role</span>
                </span>
                {members.length === 0 ? (
                  <p className="composer-hint">No members were returned for this group.</p>
                ) : (
                  <ul className="member-list">
                    {members.map((member) => (
                      <li className="member-row" key={member.id}>
                        <Avatar member={member} />
                        <span className="member-name">
                          <strong>
                            {getGroupMemberLabel(member)}
                            {member.user_id === membership?.user_id ? <em> (you)</em> : null}
                          </strong>
                          <small>
                            {member.username ? `@${member.username} · ` : ''}joined {formatGroupDate(member.joined_at)}
                          </small>
                        </span>
                        {canToggleAdmin(member) ? (
                          <select
                            aria-label={`Role for ${getGroupMemberLabel(member)}`}
                            disabled={pendingAction === `role-${member.id}`}
                            onChange={() => onToggleAdmin(member)}
                            value={member.role}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`member-role${member.is_owner ? ' is-owner' : ''}`}>{getMemberRoleSummary(member)}</span>
                        )}
                        {canRemoveMember(member) ? (
                          <button
                            className="feed-link is-danger"
                            disabled={pendingAction === `remove-${member.id}`}
                            onClick={() => onRemoveMember(member)}
                            type="button"
                          >
                            {pendingAction === `remove-${member.id}` ? 'Removing…' : 'Remove'}
                          </button>
                        ) : (
                          <span className="member-spacer" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>

        <aside className="group-rail">
          {tab === 'members' ? (
            <GroupInvitePanel group={group} membership={membership} />
          ) : (
            <>
              <section className="rail-section">
                <span className="rail-heading">About this group</span>
                <dl className="note-facts">
                  <div>
                    <dt>Visibility</dt>
                    <dd>{getGroupVisibilityLabel(group)}</dd>
                  </div>
                  <div>
                    <dt>Members</dt>
                    <dd>{members.length}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatGroupDate(group.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Invite code</dt>
                    <dd>{canManageRequests ? group.invite_code : 'Ask an admin'}</dd>
                  </div>
                </dl>
              </section>
              <section className="rail-section">
                <span className="rail-heading">Members</span>
                <ul className="member-mini">
                  {members.slice(0, 6).map((member) => (
                    <li key={member.id}>
                      <Avatar member={member} />
                      <span>{getGroupMemberLabel(member)}</span>
                      <small>{member.is_owner ? 'Owner' : member.role === 'admin' ? 'Admin' : ''}</small>
                    </li>
                  ))}
                </ul>
                {members.length > 6 ? (
                  <button className="feed-link" onClick={() => setActiveTab('members')} type="button">
                    Show all {members.length} members →
                  </button>
                ) : null}
              </section>
            </>
          )}

          {canLeaveGroup ? (
            <button className="feed-link is-danger" disabled={pendingAction === 'leave'} onClick={onLeaveGroup} type="button">
              {pendingAction === 'leave' ? 'Leaving…' : 'Leave group'}
            </button>
          ) : null}

          {isOwner ? (
            <section className="danger-zone">
              {!deleteOpen ? (
                <button className="feed-link is-danger" onClick={() => setDeleteOpen(true)} type="button">
                  Delete group…
                </button>
              ) : (
                <>
                  <span className="rail-heading is-vermilion">Delete this group</span>
                  <p>
                    This removes the group for everyone: its members, announcements, group notes and join requests. Notes
                    people shared into it stay in their own notebooks. It can’t be undone.
                  </p>
                  <label>
                    <span>
                      Type <strong>{group.name}</strong> to confirm
                    </span>
                    <input
                      autoComplete="off"
                      onChange={(event) => setDeleteConfirm(event.target.value)}
                      value={deleteConfirm}
                    />
                  </label>
                  <div className="danger-zone-actions">
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        setDeleteOpen(false);
                        setDeleteConfirm('');
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="button button-vermilion"
                      disabled={deleteConfirm.trim() !== group.name.trim() || pendingAction === 'delete-group'}
                      onClick={onDeleteGroup}
                      type="button"
                    >
                      {pendingAction === 'delete-group' ? 'Deleting…' : 'Delete group'}
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Avatar({
  member,
}: {
  member: Pick<GroupMemberSummary, 'display_name' | 'name' | 'username' | 'user_id' | 'avatar_url'>;
}) {
  const label = getGroupMemberLabel(member);
  const hash = [...member.user_id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  return member.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="member-avatar" src={member.avatar_url} />
  ) : (
    <span className="member-avatar" style={{ background: tone }}>
      {label.trim().charAt(0).toUpperCase()}
    </span>
  );
}

const AVATAR_TONES = ['#8fa3c9', '#d0907c', '#9c9478', '#a9bfa3', '#c4a2b8', '#8fb4b8', '#c9ab7c'];

/** "Today", a weekday within the last week, otherwise "8 Jul". */
function shortGroupDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' }).format(date);
}
