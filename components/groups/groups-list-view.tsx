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
    if (searchParams.get('left') === '1') return 'You left the group.';
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
    <div className="page-container page-section">
      <header className="page-header" style={{ gap: '0.8rem' }}>
        <div className="note-list-title">
          <span className="eyebrow">Groups</span>
          <h1>Your groups</h1>
          <p className="page-description">
            Shared spaces for reflection, study, and notes that continue together.
          </p>
        </div>
      </header>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}

      <section className="responsive-grid">
        <section className="support-tray">
          <div className="support-block">
            <span className="eyebrow">Create group</span>
            <strong className="support-block-title">Start a new shared space</strong>
            <p className="support-block-copy">Make it private for invitation-only conversation or public for open participation.</p>
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

        <section className="support-tray">
          <div className="support-block">
            <span className="eyebrow">Join by invite</span>
            <strong className="support-block-title">Enter a shared space</strong>
            <p className="support-block-copy">Use an invite code to step into an existing group and keep the thread going.</p>
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
          <span style={{ color: 'var(--muted)' }}>Fetching the groups connected to your account.</span>
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
        <section className="group-card-grid">
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
    <article className="note-card">
      <div className="note-card-meta">
        <div className="note-hero-block" style={{ gap: '0.35rem' }}>
          <span className="badge">{getGroupVisibilityLabel(group)}</span>
          <strong className="note-card-title">{group.name}</strong>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>{role}</span>
      </div>
      <span className="note-card-excerpt">
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
  gap: '0.5rem',
};

const labelTextStyle: CSSProperties = {
  fontSize: '0.72rem',
};

const inputStyle: CSSProperties = {
  minHeight: 54,
  borderRadius: 18,
  padding: '0.95rem 1.05rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
};

const textareaStyle: CSSProperties = {
  minHeight: 120,
  borderRadius: 18,
  padding: '1rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
  resize: 'vertical',
  lineHeight: 1.6,
};
