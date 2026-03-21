'use client';

import { useEffect, useMemo, useState } from 'react';
import { listUserGroups, type UserGroup } from '@/lib/groups';
import {
  ensureOwnedPublicShare,
  getOwnedPublicShare,
  listOwnedGroupShares,
  listOwnedUserShares,
  removeOwnedPublicShare,
  replaceOwnedShares,
  type NoteGroupShare,
  type NoteRecord,
  type NoteSharePermission,
  type PublicNoteShare,
  type NoteUserShare,
  type ShareableProfile,
  searchShareableProfiles,
} from '@/lib/notes';
import { getPublicAppUrl } from '@/lib/env';

const PERMISSIONS: NoteSharePermission[] = ['view', 'comment', 'edit'];

export function NoteSharePanel({
  note,
  onSharesUpdated,
  onUserSharesUpdated,
}: {
  note: NoteRecord;
  onSharesUpdated?: (shares: NoteGroupShare[]) => void;
  onUserSharesUpdated?: (shares: NoteUserShare[]) => void;
}) {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [existingShares, setExistingShares] = useState<NoteGroupShare[]>([]);
  const [existingUserShares, setExistingUserShares] = useState<NoteUserShare[]>([]);
  const [publicShare, setPublicShare] = useState<PublicNoteShare | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<ShareableProfile[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<ShareableProfile[]>([]);
  const [permission, setPermission] = useState<NoteSharePermission>('view');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [nextGroups, nextShares, nextUserShares, nextPublicShare] = await Promise.all([
          listUserGroups(),
          listOwnedGroupShares(note.id),
          listOwnedUserShares(note.id),
          getOwnedPublicShare(note.id),
        ]);

        if (!active) return;
        setGroups(nextGroups);
        setExistingShares(nextShares);
        setExistingUserShares(nextUserShares);
        setPublicShare(nextPublicShare);
        setSelectedGroupIds(nextShares.map((share) => share.group_id));
        setSelectedUsers(
          nextUserShares.map((share) => ({
            id: share.user_id,
            username: null,
            display_name: share.user_label,
            name: share.user_label,
          }))
        );
        setPermission(nextShares[0]?.permissions[0] ?? nextUserShares[0]?.permissions[0] ?? 'view');
        onSharesUpdated?.(nextShares);
        onUserSharesUpdated?.(nextUserShares);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load note sharing state.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [note.id, onSharesUpdated]);

  const selectedGroups = useMemo(
    () => groups.filter((group) => selectedGroupIds.includes(group.group.id)),
    [groups, selectedGroupIds]
  );

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      try {
        const results = await searchShareableProfiles(userQuery);
        if (!active) return;
        setAvailableUsers(results);
      } catch {
        if (!active) return;
        setAvailableUsers([]);
      }
    };

    void loadUsers();

    return () => {
      active = false;
    };
  }, [userQuery]);

  const refreshShares = async () => {
    const [refreshedGroups, refreshedUsers] = await Promise.all([
      listOwnedGroupShares(note.id),
      listOwnedUserShares(note.id),
    ]);

    setExistingShares(refreshedGroups);
    setExistingUserShares(refreshedUsers);
    setSelectedGroupIds(refreshedGroups.map((share) => share.group_id));
    setSelectedUsers(
      refreshedUsers.map((share) => ({
        id: share.user_id,
        username: null,
        display_name: share.user_label,
        name: share.user_label,
      }))
    );
    onSharesUpdated?.(refreshedGroups);
    onUserSharesUpdated?.(refreshedUsers);

    return { refreshedGroups, refreshedUsers };
  };

  const onSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      await replaceOwnedShares({
        noteId: note.id,
        groups: selectedGroups.map(({ group }) => ({ id: group.id, name: group.name })),
        users: selectedUsers,
        permission,
      });

      const { refreshedGroups: refreshed, refreshedUsers } = await refreshShares();
      setNotice(
        refreshed.length + refreshedUsers.length > 0
          ? `Updated sharing for ${refreshed.length} group${refreshed.length === 1 ? '' : 's'} and ${refreshedUsers.length} user${refreshedUsers.length === 1 ? '' : 's'}.`
          : 'All note sharing removed. This note is private again.'
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update note sharing.');
    } finally {
      setSaving(false);
    }
  };

  const onRemoveUserShare = async (userId: string, userLabel: string) => {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const remainingUsers = selectedUsers.filter((user) => user.id !== userId);

      await replaceOwnedShares({
        noteId: note.id,
        groups: selectedGroups.map(({ group }) => ({ id: group.id, name: group.name })),
        users: remainingUsers,
        permission,
      });

      await refreshShares();
      setNotice(`${userLabel} no longer has access to this note.`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove this user from the shared note.');
    } finally {
      setSaving(false);
    }
  };

  const publicShareUrl = publicShare ? `${getPublicAppUrl()}/s/${publicShare.share_token}` : null;

  const onEnablePublicShare = async () => {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const share = await ensureOwnedPublicShare(note.id);
      setPublicShare(share);
      setNotice('Public read-only link ready. Anyone with the link can read this note and then sign up to keep their own copy.');
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Failed to create a public share link.');
    } finally {
      setSaving(false);
    }
  };

  const onDisablePublicShare = async () => {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      await removeOwnedPublicShare(note.id);
      setPublicShare(null);
      setNotice('Public link removed. People will need a signed-in share again to reach this note.');
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Failed to remove the public share link.');
    } finally {
      setSaving(false);
    }
  };

  const onCopyPublicLink = async () => {
    if (!publicShareUrl) return;

    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setNotice('Public share link copied.');
    } catch {
      setError('Could not copy the public link from this browser.');
    }
  };

  const onSharePublicLink = async () => {
    if (!publicShareUrl) return;

    if (!canUseNativeShare) {
      await onCopyPublicLink();
      return;
    }

    try {
      await navigator.share({
        title: note.title?.trim() || 'Shared GospelPad note',
        text: 'Open this shared GospelPad note.',
        url: publicShareUrl,
      });
      setNotice('Share sheet opened.');
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') {
        return;
      }
      setError('Could not open the phone share sheet from this browser.');
    }
  };

  return (
    <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div className="page-header" style={{ gap: '0.35rem' }}>
        <span className="eyebrow">Share note</span>
        <strong style={{ fontSize: '1.05rem' }}>Share this note with your groups or directly with another user</strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Use direct user or group sharing when you want signed-in collaboration. Use the public link below when you want to share a read-only version with someone who does not have an account yet.
        </span>
      </div>

      {loading ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading sharing options…</strong>
          <span style={{ color: 'var(--muted)' }}>Checking your groups and existing group visibility for this note.</span>
        </section>
      ) : null}

      {!loading && groups.length === 0 ? (
        <section className="empty-state status-message" role="status">
          <strong>No groups available</strong>
          <span style={{ color: 'var(--muted)' }}>
            Join or create a group first, then you can share this note into it.
          </span>
        </section>
      ) : null}

      {!loading && groups.length > 0 ? (
        <>
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <span className="eyebrow">Target groups</span>
            <div className="cta-row">
              {groups.map(({ group, role }) => {
                const active = selectedGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={`button ${active ? 'button-primary' : 'button-secondary'}`}
                    onClick={() =>
                      setSelectedGroupIds((current) =>
                        current.includes(group.id)
                          ? current.filter((id) => id !== group.id)
                          : [...current, group.id]
                      )
                    }
                  >
                    {group.name} ({role})
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <span className="eyebrow">Share with user</span>
            <input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Search by username or name"
              style={{
                borderRadius: 18,
                border: '1px solid var(--line)',
                padding: '0.85rem 1rem',
                background: 'var(--field-bg)',
                color: 'var(--text)',
              }}
            />
            <div className="cta-row">
              {availableUsers.map((user) => {
                const active = selectedUsers.some((candidate) => candidate.id === user.id);
                const label = user.display_name || user.username || user.name || 'User';
                return (
                  <button
                    key={user.id}
                    type="button"
                    className={`button ${active ? 'button-primary' : 'button-secondary'}`}
                    onClick={() =>
                      setSelectedUsers((current) =>
                        current.some((candidate) => candidate.id === user.id)
                          ? current.filter((candidate) => candidate.id !== user.id)
                          : [...current, user]
                      )
                    }
                  >
                    {label}
                  </button>
                );
              })}
              {availableUsers.length === 0 ? (
                <span style={{ color: 'var(--muted)' }}>No matching users yet.</span>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <span className="eyebrow">Permission</span>
            <div className="cta-row">
              {PERMISSIONS.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={`button ${permission === candidate ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => setPermission(candidate)}
                >
                  {candidate}
                </button>
              ))}
            </div>
            <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              `edit` means collaborators can change the original shared note together. Use the public link below when you want to share a read-only version instead.
            </span>
          </div>
        </>
      ) : null}

      {existingShares.length > 0 ? (
        <section className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Currently shared to groups</span>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {existingShares.map((share) => (
              <div key={share.group_id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <strong>{share.group_name}</strong>
                <span className="badge">{share.permissions.join(', ')}</span>
              </div>
            ))}
          </div>
        </section>
      ) : existingUserShares.length === 0 ? (
        <section className="empty-state status-message" role="status">
          <strong>This note is private</strong>
          <span style={{ color: 'var(--muted)' }}>
            It is not currently shared into any group or directly with another user.
          </span>
        </section>
      ) : null}

      {existingUserShares.length > 0 ? (
        <section className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Currently shared with users</span>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {existingUserShares.map((share) => (
              <div key={share.user_id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <strong>{share.user_label}</strong>
                  <span className="badge">{share.permissions.join(', ')}</span>
                </div>
                <button
                  className="button button-ghost"
                  disabled={saving}
                  onClick={() => onRemoveUserShare(share.user_id, share.user_label)}
                  type="button"
                >
                  Remove access
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
        <span className="eyebrow">Public share link</span>
        <strong style={{ fontSize: '1.05rem' }}>Read-only sharing for anyone with the link</strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          This is the safe path for non-users. They can read the full note, then sign up to copy it into their own library or start collaborating.
        </span>

        {publicShareUrl ? (
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <strong style={{ fontSize: '0.95rem', overflowWrap: 'anywhere' }}>{publicShareUrl}</strong>
            <div className="cta-row">
              <button className="button button-primary" onClick={onSharePublicLink} type="button">
                {canUseNativeShare ? 'Share link' : 'Copy public link'}
              </button>
              <button className="button button-primary" onClick={onCopyPublicLink} type="button">
                Copy public link
              </button>
              <button className="button button-ghost" onClick={onDisablePublicShare} type="button" disabled={saving}>
                Remove public link
              </button>
            </div>
          </div>
        ) : (
          <div className="cta-row">
            <button className="button button-primary" onClick={onEnablePublicShare} type="button" disabled={saving}>
              Create public link
            </button>
          </div>
        )}
      </section>

      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}
      {notice ? <section className="empty-state status-message" role="status">{notice}</section> : null}

      <div className="cta-row">
        <button
          className="button button-primary"
          type="button"
          disabled={loading || saving}
          onClick={onSave}
        >
          {saving ? 'Saving…' : 'Update sharing'}
        </button>
      </div>
    </section>
  );
}
