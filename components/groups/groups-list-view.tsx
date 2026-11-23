'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createGroup, joinGroupByCode, listUserGroups, type UserGroup } from '@/lib/groups';

type CreateGroupState = {
  name: string;
  description: string;
  isPublic: boolean;
};

const defaultCreateState: CreateGroupState = {
  name: '',
  description: '',
  isPublic: false,
};

export function GroupsListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createState, setCreateState] = useState<CreateGroupState>(defaultCreateState);
  const [inviteCode, setInviteCode] = useState('');
  const [createPending, setCreatePending] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listUserGroups();
        if (!active) return;
        setGroups(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load groups.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const successMessage = useMemo(() => {
    if (searchParams.get('created') === '1') return 'Group created successfully.';
    if (searchParams.get('left') === '1') return 'You left the group.';
    if (searchParams.get('deleted') === '1') return 'Group deleted.';
    return null;
  }, [searchParams]);

  const onCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setCreatePending(true);
    setCreateError(null);

    try {
      const created = await createGroup({
        name: createState.name,
        description: createState.description,
        isPublic: createState.isPublic,
      });
      setCreateState(defaultCreateState);
      router.replace(`/groups/${created.id}?created=1`);
    } catch (submitError) {
      setCreateError(submitError instanceof Error ? submitError.message : 'Failed to create group.');
      setCreatePending(false);
    }
  };

  const onJoinSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setJoinPending(true);
    setJoinError(null);
    setJoinNotice(null);

    try {
      const response = await joinGroupByCode(inviteCode);
      setInviteCode('');

      if (response.status === 'joined') {
        router.replace(`/groups/${response.group.id}`);
        return;
      }

      setJoinNotice(`Join request sent to ${response.group.name}.`);
      setJoinPending(false);
    } catch (submitError) {
      setJoinError(submitError instanceof Error ? submitError.message : 'Failed to join group.');
      setJoinPending(false);
    }
  };

  return (
    <div className="page-container page-section groups-page">
      <header className="notebook-header">
        <div>
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>Groups</span>
          <h1>
            Study <em>together.</em>
          </h1>
          <p className="groups-intro">Shared spaces for announcements, group notes and the notes you share with each other.</p>
        </div>
      </header>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}

      <div className="group-columns">
        <div className="group-main">
          <span className="rail-heading">Your groups</span>

          {loading ? (
            <p className="composer-hint" role="status">Loading your groups…</p>
          ) : null}

          {!loading && error ? (
            <section className="error-state status-message" role="alert">
              <strong>Unable to load groups</strong>
              <span style={{ color: 'var(--muted)' }}>{error}</span>
              <Link className="button button-secondary" href="/groups">
                Refresh
              </Link>
            </section>
          ) : null}

          {!loading && !error && groups.length === 0 ? (
            <section className="notebook-empty" role="status">
              <strong>No groups yet</strong>
              <span>Start one for your study group or church, or join one with an invite code.</span>
            </section>
          ) : null}

          {!loading && !error && groups.length > 0 ? (
            <ul className="group-list">
              {groups.map(({ group, role }) => (
                <li key={group.id}>
                  <Link className="group-row" href={`/groups/${group.id}`}>
                    <span className="group-row-initial" aria-hidden="true">
                      {group.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="notebook-row-main">
                      <span className="notebook-row-title">{group.name}</span>
                      <span className="notebook-row-excerpt">{group.description?.trim() || 'No description yet.'}</span>
                    </span>
                    <span className="notebook-row-meta">
                      <span className="notebook-pill">{group.is_public ? 'Public' : 'Private'}</span>
                      <span className="notebook-date">{role === 'admin' ? 'Admin' : 'Member'}</span>
                      <span aria-hidden="true" className="group-row-arrow">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside className="group-rail">
          <form className="group-composer" onSubmit={onCreateSubmit}>
            <span className="rail-heading">Start a group</span>
            <input
              aria-label="Group name"
              onChange={(event) => setCreateState((current) => ({ ...current, name: event.target.value }))}
              placeholder="Name, e.g. Wednesday Night Study"
              required
              value={createState.name}
            />
            <textarea
              aria-label="Description"
              onChange={(event) => setCreateState((current) => ({ ...current, description: event.target.value }))}
              placeholder="Who it’s for (optional)"
              rows={3}
              value={createState.description}
            />
            <label className="group-check">
              <input
                checked={createState.isPublic}
                onChange={(event) => setCreateState((current) => ({ ...current, isPublic: event.target.checked }))}
                type="checkbox"
              />
              <span>Public: anyone with the code joins straight away. Leave unticked to approve each request.</span>
            </label>
            {createError ? <div className="error-state status-message" role="alert">{createError}</div> : null}
            <div className="group-composer-actions">
              <button className="button button-primary" disabled={createPending} type="submit">
                {createPending ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </form>

          <form className="group-composer" onSubmit={onJoinSubmit}>
            <span className="rail-heading">Join with a code</span>
            <div className="invite-card-row">
              <input
                aria-label="Invite code"
                className="invite-code-input"
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="ABCDEFGH2"
                value={inviteCode}
              />
              <button className="button button-secondary" disabled={joinPending || !inviteCode.trim()} type="submit">
                {joinPending ? 'Joining…' : 'Join'}
              </button>
            </div>
            {joinError ? <div className="error-state status-message" role="alert">{joinError}</div> : null}
            {joinNotice ? <div className="empty-state status-message" role="status">{joinNotice}</div> : null}
          </form>
        </aside>
      </div>
    </div>
  );
}
