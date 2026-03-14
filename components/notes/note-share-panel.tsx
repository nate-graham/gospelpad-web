'use client';

import { useEffect, useMemo, useState } from 'react';
import { listUserGroups, type UserGroup } from '@/lib/groups';
import {
  listOwnedGroupShares,
  replaceOwnedGroupShares,
  type NoteGroupShare,
  type NoteRecord,
  type NoteSharePermission,
} from '@/lib/notes';

const PERMISSIONS: NoteSharePermission[] = ['view', 'comment', 'edit'];

export function NoteSharePanel({
  note,
  onSharesUpdated,
}: {
  note: NoteRecord;
  onSharesUpdated?: (shares: NoteGroupShare[]) => void;
}) {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [existingShares, setExistingShares] = useState<NoteGroupShare[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
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
        const [nextGroups, nextShares] = await Promise.all([
          listUserGroups(),
          listOwnedGroupShares(note.id),
        ]);

        if (!active) return;
        setGroups(nextGroups);
        setExistingShares(nextShares);
        setSelectedGroupIds(nextShares.map((share) => share.group_id));
        setPermission(nextShares[0]?.permissions[0] ?? 'view');
        onSharesUpdated?.(nextShares);
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

  const onSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      await replaceOwnedGroupShares({
        noteId: note.id,
        groups: selectedGroups.map(({ group }) => ({ id: group.id, name: group.name })),
        permission,
      });

      const refreshed = await listOwnedGroupShares(note.id);
      setExistingShares(refreshed);
      onSharesUpdated?.(refreshed);
      setNotice(
        refreshed.length > 0
          ? `Note shared to ${refreshed.length} group${refreshed.length === 1 ? '' : 's'}.`
          : 'Group sharing removed. This note is private again.'
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
        <span className="eyebrow">Share to group</span>
        <strong style={{ fontSize: '1.05rem' }}>Share this note with one or more of your groups</strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          This V1 uses the existing `note_shares` model. It shares the current note into groups you already belong to, without creating a separate collaborative copy.
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
          <span className="eyebrow">Currently shared to</span>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {existingShares.map((share) => (
              <div key={share.group_id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <strong>{share.group_name}</strong>
                <span className="badge">{share.permissions.join(', ')}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="empty-state status-message" role="status">
          <strong>This note is private</strong>
          <span style={{ color: 'var(--muted)' }}>
            It is not currently shared into any group.
          </span>
        </section>
      )}

      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}
      {notice ? <section className="empty-state status-message" role="status">{notice}</section> : null}

      <div className="cta-row">
        <button
          className="button button-primary"
          type="button"
          disabled={loading || saving || groups.length === 0}
          onClick={onSave}
        >
          {saving ? 'Saving…' : 'Update group sharing'}
        </button>
      </div>
    </section>
  );
}
