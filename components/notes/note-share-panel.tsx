'use client';

import type { CSSProperties } from 'react';
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
        <strong style={{ fontSize: '1rem' }}>Collaborate or send a read-only link</strong>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'end',
        }}
      >
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Permission</span>
          <select
            value={permission}
            onChange={(event) => setPermission(event.target.value as NoteSharePermission)}
            style={{
              minHeight: 42,
              borderRadius: 14,
              border: '1px solid var(--line)',
              padding: '0.75rem 0.9rem',
              background: 'var(--field-bg)',
              color: 'var(--text)',
            }}
          >
            {PERMISSIONS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>

        <button
          className="button button-primary"
          type="button"
          disabled={loading || saving}
          onClick={onSave}
          style={{ minHeight: 42, paddingInline: '0.9rem' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {loading ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading sharing options…</strong>
          <span style={{ color: 'var(--muted)' }}>Checking your groups and existing group visibility for this note.</span>
        </section>
      ) : null}

      {!loading ? (
        <>
          <details className="panel" style={{ padding: '0.8rem 1rem' }}>
            <summary style={summaryStyle}>Groups {selectedGroupIds.length > 0 ? `(${selectedGroupIds.length})` : ''}</summary>
            {groups.length === 0 ? (
              <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>No groups yet.</span>
            ) : (
              <div className="cta-row" style={{ marginTop: '0.85rem' }}>
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
                      style={compactButtonStyle}
                    >
                      {group.name} ({role})
                    </button>
                  );
                })}
              </div>
            )}
          </details>

          <details className="panel" style={{ padding: '0.8rem 1rem' }}>
            <summary style={summaryStyle}>Users {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}</summary>
            <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.85rem' }}>
              <input
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Search users"
                style={{
                  minHeight: 42,
                  borderRadius: 14,
                  border: '1px solid var(--line)',
                  padding: '0.75rem 0.9rem',
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
                      style={compactButtonStyle}
                    >
                      {label}
                    </button>
                  );
                })}
                {availableUsers.length === 0 ? (
                  <span style={{ color: 'var(--muted)' }}>No matches.</span>
                ) : null}
              </div>
            </div>
          </details>
        </>
      ) : null}

      {existingShares.length > 0 ? (
        <section className="status-card" style={{ padding: '0.9rem' }}>
          <span className="eyebrow">Groups</span>
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
        <section className="status-card" style={{ padding: '0.9rem' }}>
          <span className="eyebrow">Users</span>
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
                  style={iconButtonStyle}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <details className="status-card" style={{ padding: '0.9rem', display: 'grid', gap: '0.75rem' }} open={Boolean(publicShareUrl)}>
        <summary style={summaryStyle}>Public link {publicShareUrl ? '(active)' : ''}</summary>
        <span className="eyebrow">Public share link</span>
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>Read-only</span>

        {publicShareUrl ? (
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <strong style={{ fontSize: '0.95rem', overflowWrap: 'anywhere' }}>{publicShareUrl}</strong>
            <div className="cta-row">
              <button className="button button-primary" onClick={onSharePublicLink} style={compactButtonStyle} type="button">
                {canUseNativeShare ? 'Share link' : 'Copy public link'}
              </button>
              <button className="button button-secondary" onClick={onCopyPublicLink} style={compactButtonStyle} type="button">
                Copy
              </button>
              <button className="button button-ghost" onClick={onDisablePublicShare} style={compactButtonStyle} type="button" disabled={saving}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="cta-row">
            <button className="button button-primary" onClick={onEnablePublicShare} style={compactButtonStyle} type="button" disabled={saving}>
              Create link
            </button>
          </div>
        )}
      </details>

      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}
      {notice ? <section className="empty-state status-message" role="status">{notice}</section> : null}
    </section>
  );
}

const summaryStyle = {
  cursor: 'pointer',
  fontWeight: 700,
  color: 'var(--text)',
  listStyle: 'none',
} satisfies CSSProperties;

const compactButtonStyle = {
  minHeight: 36,
  padding: '0.55rem 0.8rem',
} satisfies CSSProperties;

const iconButtonStyle = {
  minHeight: 34,
  minWidth: 34,
  padding: '0.35rem',
  borderRadius: 999,
  fontSize: '1.1rem',
  lineHeight: 1,
} satisfies CSSProperties;
