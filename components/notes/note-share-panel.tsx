'use client';

import { useEffect, useMemo, useState } from 'react';
import { listUserGroups, type UserGroup } from '@/lib/groups';
import {
  listOwnedGroupShares,
  listOwnedUserShares,
  replaceOwnedShares,
  type NoteGroupShare,
  type NoteRecord,
  type NoteSharePermission,
  type NoteUserShare,
  type ShareableProfile,
  searchShareableProfiles,
} from '@/lib/notes';

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
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<ShareableProfile[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<ShareableProfile[]>([]);
  const [permission, setPermission] = useState<NoteSharePermission>('view');
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
        const [nextGroups, nextShares, nextUserShares] = await Promise.all([
          listUserGroups(),
          listOwnedGroupShares(note.id),
          listOwnedUserShares(note.id),
        ]);

        if (!active) return;
        setGroups(nextGroups);
        setExistingShares(nextShares);
        setExistingUserShares(nextUserShares);
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

      const [refreshed, refreshedUsers] = await Promise.all([
        listOwnedGroupShares(note.id),
        listOwnedUserShares(note.id),
      ]);
      setExistingShares(refreshed);
      setExistingUserShares(refreshedUsers);
      onSharesUpdated?.(refreshed);
      onUserSharesUpdated?.(refreshedUsers);
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

  return (
    <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div className="page-header" style={{ gap: '0.35rem' }}>
        <span className="eyebrow">Share note</span>
        <strong style={{ fontSize: '1.05rem' }}>Share this note with your groups or directly with another user</strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          This pass extends the existing `note_shares` model. Group shares still work the same way, and direct user shares now follow the same safe backend path the mobile app already uses.
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
                background: 'rgba(255,255,255,0.72)',
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
              <div key={share.user_id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <strong>{share.user_label}</strong>
                <span className="badge">{share.permissions.join(', ')}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
