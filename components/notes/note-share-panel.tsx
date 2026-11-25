'use client';

import { useEffect, useState } from 'react';
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

const PERMISSION_LABELS: Record<NoteSharePermission, string> = {
  edit: 'Can edit',
  comment: 'Can comment',
  view: 'Read-only',
};
const PERMISSION_ORDER: NoteSharePermission[] = ['edit', 'comment', 'view'];

type PersonShare = { profile: ShareableProfile; permission: NoteSharePermission };
type GroupShare = { id: string; name: string; permission: NoteSharePermission };

function profileLabel(profile: ShareableProfile) {
  return profile.display_name || profile.name || profile.username || 'GospelPad user';
}

const AVATAR_TINTS = ['var(--vermilion-soft)', 'var(--accent-soft)', 'var(--surface-2)'];

export function NoteSharePanel({
  note,
  onSharesUpdated,
  onUserSharesUpdated,
  onDone,
}: {
  note: NoteRecord;
  onSharesUpdated?: (shares: NoteGroupShare[]) => void;
  onUserSharesUpdated?: (shares: NoteUserShare[]) => void;
  onDone?: () => void;
}) {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [people, setPeople] = useState<PersonShare[]>([]);
  const [groupShares, setGroupShares] = useState<GroupShare[]>([]);
  const [publicShare, setPublicShare] = useState<PublicNoteShare | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [results, setResults] = useState<ShareableProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const applyLoaded = (nextGroupShares: NoteGroupShare[], nextUserShares: NoteUserShare[]) => {
    setGroupShares(
      nextGroupShares.map((share) => ({ id: share.group_id, name: share.group_name, permission: share.permissions[0] ?? 'view' }))
    );
    setPeople((current) =>
      nextUserShares.map((share) => {
        const known = current.find((person) => person.profile.id === share.user_id)?.profile;
        return {
          profile: known ?? { id: share.user_id, username: null, display_name: share.user_label, name: share.user_label },
          permission: share.permissions[0] ?? 'view',
        };
      })
    );
    onSharesUpdated?.(nextGroupShares);
    onUserSharesUpdated?.(nextUserShares);
  };

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
        setPublicShare(nextPublicShare);
        applyLoaded(nextShares, nextUserShares);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Couldn’t load sharing for this note.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  useEffect(() => {
    const query = userQuery.trim();
    if (!query) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      searchShareableProfiles(query)
        .then((found) => {
          if (active) setResults(found);
        })
        .catch(() => {
          if (active) setResults([]);
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [userQuery]);

  /** Save the full sharing state; every change applies straight away. */
  const persist = async (nextPeople: PersonShare[], nextGroups: GroupShare[], done: string) => {
    const previousPeople = people;
    const previousGroups = groupShares;
    setPeople(nextPeople);
    setGroupShares(nextGroups);
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const permissionFor: Record<string, NoteSharePermission> = {};
      nextPeople.forEach((person) => {
        permissionFor[person.profile.id] = person.permission;
      });
      nextGroups.forEach((group) => {
        permissionFor[group.id] = group.permission;
      });
      await replaceOwnedShares({
        noteId: note.id,
        groups: nextGroups.map((group) => ({ id: group.id, name: group.name })),
        users: nextPeople.map((person) => person.profile),
        permission: 'view',
        permissionFor,
      });
      const [refreshedGroups, refreshedUsers] = await Promise.all([listOwnedGroupShares(note.id), listOwnedUserShares(note.id)]);
      applyLoaded(refreshedGroups, refreshedUsers);
      setNotice(done);
    } catch (saveError) {
      setPeople(previousPeople);
      setGroupShares(previousGroups);
      setError(saveError instanceof Error ? saveError.message : 'Couldn’t update sharing.');
    } finally {
      setSaving(false);
    }
  };

  const addPerson = (profile: ShareableProfile) => {
    if (people.some((person) => person.profile.id === profile.id)) return;
    setUserQuery('');
    setResults([]);
    void persist([...people, { profile, permission: 'view' }], groupShares, `Shared with ${profileLabel(profile)}.`);
  };

  const changePerson = (id: string, value: NoteSharePermission | 'remove') => {
    const person = people.find((candidate) => candidate.profile.id === id);
    if (!person) return;
    if (value === 'remove') {
      void persist(people.filter((candidate) => candidate.profile.id !== id), groupShares, `${profileLabel(person.profile)} no longer has access.`);
      return;
    }
    void persist(
      people.map((candidate) => (candidate.profile.id === id ? { ...candidate, permission: value } : candidate)),
      groupShares,
      `${profileLabel(person.profile)}: ${PERMISSION_LABELS[value].toLowerCase()}.`
    );
  };

  const toggleGroup = (id: string, name: string) => {
    const shared = groupShares.some((group) => group.id === id);
    void persist(
      people,
      shared ? groupShares.filter((group) => group.id !== id) : [...groupShares, { id, name, permission: 'comment' }],
      shared ? `Removed from ${name}.` : `Posted to ${name}.`
    );
  };

  const changeGroup = (id: string, permission: NoteSharePermission) => {
    const group = groupShares.find((candidate) => candidate.id === id);
    if (!group) return;
    void persist(
      people,
      groupShares.map((candidate) => (candidate.id === id ? { ...candidate, permission } : candidate)),
      `${group.name}: ${PERMISSION_LABELS[permission].toLowerCase()}.`
    );
  };

  const publicShareUrl = publicShare ? `${getPublicAppUrl()}/s/${publicShare.share_token}` : null;

  const runPublic = async (action: () => Promise<void>) => {
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      await action();
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Couldn’t update the public link.');
    } finally {
      setSaving(false);
    }
  };

  const onEnablePublicShare = () =>
    runPublic(async () => {
      setPublicShare(await ensureOwnedPublicShare(note.id));
      setNotice('Link created. Anyone with it can read this note.');
    });

  const onDisablePublicShare = () =>
    runPublic(async () => {
      await removeOwnedPublicShare(note.id);
      setPublicShare(null);
      setNotice('Public link removed.');
    });

  const onCopyPublicLink = async () => {
    if (!publicShareUrl) return;
    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setNotice('Link copied.');
    } catch {
      setError('Couldn’t copy the link from this browser.');
    }
  };

  const onSharePublicLink = async () => {
    if (!publicShareUrl) return;
    try {
      await navigator.share({
        title: note.title?.trim() || 'Shared GospelPad note',
        text: 'Open this shared GospelPad note.',
        url: publicShareUrl,
      });
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
      setError('Couldn’t open the share sheet from this browser.');
    }
  };

  const stopAllSharing = () =>
    runPublic(async () => {
      if (people.length || groupShares.length) {
        await replaceOwnedShares({ noteId: note.id, groups: [], users: [], permission: 'view' });
        applyLoaded([], []);
      }
      if (publicShare) {
        await removeOwnedPublicShare(note.id);
        setPublicShare(null);
      }
      setNotice('This note is private again.');
    });

  const sharedIds = new Set(people.map((person) => person.profile.id));
  const suggestions = results.filter((profile) => !sharedIds.has(profile.id));
  const anySharing = people.length > 0 || groupShares.length > 0 || Boolean(publicShare);

  return (
    <div className="share-panel">
      {loading ? (
        <p className="composer-hint" role="status">Loading sharing…</p>
      ) : (
        <>
          <section className="share-section">
            <span className="share-label">People</span>
            <input
              aria-label="Search users"
              className="share-input"
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Search users by name or username"
              type="search"
              value={userQuery}
            />
            {suggestions.length ? (
              <ul className="share-results" aria-label="Matching users">
                {suggestions.slice(0, 6).map((profile, index) => (
                  <li key={profile.id}>
                    <button disabled={saving} onClick={() => addPerson(profile)} type="button">
                      <span className="share-avatar" style={{ background: AVATAR_TINTS[index % AVATAR_TINTS.length] }}>
                        {profileLabel(profile).charAt(0).toUpperCase()}
                      </span>
                      <span className="share-person">
                        <strong>{profileLabel(profile)}</strong>
                        {profile.username ? <small>@{profile.username}</small> : null}
                      </span>
                      <span className="share-add">Add</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : userQuery.trim() && results.length === 0 ? (
              <p className="composer-hint">No one found by that name.</p>
            ) : null}
            {people.map((person, index) => (
              <div className="share-row" key={person.profile.id}>
                <span className="share-avatar" style={{ background: AVATAR_TINTS[index % AVATAR_TINTS.length] }}>
                  {profileLabel(person.profile).charAt(0).toUpperCase()}
                </span>
                <span className="share-person">
                  <strong>{profileLabel(person.profile)}</strong>
                  {person.profile.username ? <small>@{person.profile.username}</small> : null}
                </span>
                <select
                  aria-label={`${profileLabel(person.profile)}’s permission`}
                  className="share-select"
                  disabled={saving}
                  onChange={(event) => changePerson(person.profile.id, event.target.value as NoteSharePermission | 'remove')}
                  value={person.permission}
                >
                  {PERMISSION_ORDER.map((permission) => (
                    <option key={permission} value={permission}>
                      {PERMISSION_LABELS[permission]}
                    </option>
                  ))}
                  <option value="remove">Remove</option>
                </select>
              </div>
            ))}
            {people.length === 0 && !userQuery.trim() ? <p className="composer-hint">Not shared with anyone yet.</p> : null}
          </section>

          <section className="share-section share-groups">
            <span className="share-label">Groups</span>
            {groups.length === 0 ? (
              <p className="composer-hint">You’re not in any groups yet.</p>
            ) : (
              groups.map(({ group, role }) => {
                const shared = groupShares.find((candidate) => candidate.id === group.id);
                return (
                  <div className="share-group" key={group.id}>
                    <label>
                      <input checked={Boolean(shared)} disabled={saving} onChange={() => toggleGroup(group.id, group.name)} type="checkbox" />
                      <span>{group.name}</span>
                    </label>
                    {shared ? (
                      <select
                        aria-label={`${group.name} permission`}
                        className="share-select is-quiet"
                        disabled={saving}
                        onChange={(event) => changeGroup(group.id, event.target.value as NoteSharePermission)}
                        value={shared.permission}
                      >
                        {PERMISSION_ORDER.map((permission) => (
                          <option key={permission} value={permission}>
                            {permission === 'comment' ? 'Comments on' : PERMISSION_LABELS[permission]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <small>{role === 'admin' ? 'Admin' : 'Member'}</small>
                    )}
                  </div>
                );
              })
            )}
          </section>

          <section className="share-public">
            <span className="share-public-head">
              <span className="share-label">Public read-only link</span>
              {publicShareUrl ? (
                <button className="share-text-button is-danger" disabled={saving} onClick={onDisablePublicShare} type="button">
                  Remove link
                </button>
              ) : null}
            </span>
            <span className="share-public-copy">Anyone with the link can read this note, then sign up to keep their own copy.</span>
            {publicShareUrl ? (
              <span className="share-public-row">
                <input aria-label="Public link" className="share-input" readOnly value={publicShareUrl.replace(/^https?:\/\//, '')} />
                <button className="share-pill" onClick={() => void onCopyPublicLink()} type="button">
                  Copy link
                </button>
                {canUseNativeShare ? (
                  <button className="share-pill is-outline" onClick={() => void onSharePublicLink()} type="button">
                    Share
                  </button>
                ) : null}
              </span>
            ) : (
              <span className="share-public-row">
                <button className="share-pill" disabled={saving} onClick={() => void onEnablePublicShare()} type="button">
                  Create link
                </button>
              </span>
            )}
          </section>
        </>
      )}

      {error ? <p className="error-state status-message" role="alert">{error}</p> : null}
      {notice && !error ? <p className="share-notice" role="status">{notice}</p> : null}

      <div className="share-footer">
        {anySharing ? (
          <button className="share-text-button" disabled={saving} onClick={() => void stopAllSharing()} type="button">
            Stop all sharing
          </button>
        ) : null}
        <button className="button button-primary share-done" onClick={onDone} type="button">
          {saving ? 'Saving…' : 'Done'}
        </button>
      </div>
    </div>
  );
}
