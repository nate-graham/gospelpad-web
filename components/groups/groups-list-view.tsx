'use client';

import Link from 'next/link';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createGroup, joinGroupByCode, listUserGroups, type Group, type UserGroup } from '@/lib/groups';
import { formatGroupDate, getGroupVisibilityLabel } from '@/components/groups/group-utils';

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
    <div className="page-section">
      <header
        className="page-header"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div className="page-header">
          <span className="eyebrow">Groups V1</span>
          <h1>Your groups</h1>
          <p className="page-description">
            This V1 covers membership-focused groups: list, create, join by invite code, and group detail. Group notes and comments stay deferred because the current policies are too broad.
          </p>
        </div>
      </header>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}

      <section className="responsive-grid">
        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Create group</span>
            <strong style={{ fontSize: '1.1rem' }}>Start a private or public group</strong>
          </div>
          <form onSubmit={onCreateSubmit} style={{ display: 'grid', gap: '0.85rem' }}>
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Name</span>
              <input
                required
                value={createState.name}
                onChange={(event) => setCreateState((current) => ({ ...current, name: event.target.value }))}
                placeholder="Bible study group"
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Description</span>
              <textarea
                rows={4}
                value={createState.description}
                onChange={(event) => setCreateState((current) => ({ ...current, description: event.target.value }))}
                placeholder="Who this group is for"
                style={textareaStyle}
              />
            </label>
            <label style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
              <input
                checked={createState.isPublic}
                onChange={(event) => setCreateState((current) => ({ ...current, isPublic: event.target.checked }))}
                type="checkbox"
              />
              <span style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Make this a public group that members can join instantly.</span>
            </label>
            {createError ? <div className="error-state status-message" role="alert">{createError}</div> : null}
            <button className="button button-primary" disabled={createPending} type="submit">
              {createPending ? 'Creating…' : 'Create group'}
            </button>
          </form>
        </section>

        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="eyebrow">Join by invite</span>
            <strong style={{ fontSize: '1.1rem' }}>Use a group code</strong>
          </div>
          <form onSubmit={onJoinSubmit} style={{ display: 'grid', gap: '0.85rem' }}>
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Invite code</span>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="ABCDEFGH2"
                style={inputStyle}
              />
            </label>
            {joinError ? <div className="error-state status-message" role="alert">{joinError}</div> : null}
            {joinNotice ? <div className="empty-state status-message" role="status">{joinNotice}</div> : null}
            <button className="button button-secondary" disabled={joinPending || !inviteCode.trim()} type="submit">
              {joinPending ? 'Joining…' : 'Join group'}
            </button>
          </form>
        </section>
      </section>

      {loading ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading groups…</strong>
          <span style={{ color: 'var(--muted)' }}>Fetching groups linked to your authenticated account.</span>
        </section>
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
        <section className="empty-state status-message" role="status">
          <strong>No groups yet</strong>
          <span style={{ color: 'var(--muted)' }}>
            Create your first group or join one with an invite code.
          </span>
        </section>
      ) : null}

      {!loading && !error && groups.length > 0 ? (
        <section className="responsive-grid">
          {groups.map(({ group, role }) => (
            <GroupCard group={group} key={group.id} role={role} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function GroupCard({ group, role }: { group: Group; role: 'admin' | 'member' }) {
  return (
    <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="badge">{getGroupVisibilityLabel(group)}</span>
          <strong style={{ fontSize: '1.1rem', lineHeight: 1.3 }}>{group.name}</strong>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{role}</span>
      </div>
      <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        {group.description?.trim() || 'No description yet.'}
      </span>
      <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
        Created {formatGroupDate(group.created_at)}
      </span>
      <div className="cta-row">
        <Link className="button button-primary" href={`/groups/${group.id}`}>
          Open group
        </Link>
      </div>
    </article>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
};

const labelTextStyle: CSSProperties = {
  fontSize: '0.72rem',
};

const inputStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid var(--line)',
  padding: '0.85rem 1rem',
  background: 'rgba(255,255,255,0.72)',
  color: 'var(--text)',
};

const textareaStyle: CSSProperties = {
  minHeight: 120,
  borderRadius: 16,
  border: '1px solid var(--line)',
  padding: '1rem',
  background: 'rgba(255,255,255,0.72)',
  color: 'var(--text)',
  resize: 'vertical',
  lineHeight: 1.6,
};
