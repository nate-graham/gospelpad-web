'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getCurrentMembership,
  getGroupById,
  listGroupMembers,
  listGroupNativeNotes,
  listGroupSharedNotes,
  type Group,
  type GroupMemberSummary,
  type GroupMembership,
  type GroupNativeNoteSummary,
  type GroupSharedNoteSummary,
} from '@/lib/groups';
import { formatGroupDate, getGroupMemberLabel, getGroupVisibilityLabel } from '@/components/groups/group-utils';
import { getNoteExcerpt, getScriptureReferenceCount } from '@/components/notes/note-utils';

export function GroupDetailView({ groupId }: { groupId: string }) {
  const searchParams = useSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMembership | null>(null);
  const [members, setMembers] = useState<GroupMemberSummary[]>([]);
  const [nativeNotes, setNativeNotes] = useState<GroupNativeNoteSummary[]>([]);
  const [sharedNotes, setSharedNotes] = useState<GroupSharedNoteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [nextGroup, nextMembership, nextMembers, nextNativeNotes, nextSharedNotes] = await Promise.all([
          getGroupById(groupId),
          getCurrentMembership(groupId),
          listGroupMembers(groupId),
          listGroupNativeNotes(groupId),
          listGroupSharedNotes(groupId),
        ]);

        if (!active) return;

        setGroup(nextGroup);
        setMembership(nextMembership);
        setMembers(nextMembers);
        setNativeNotes(nextNativeNotes);
        setSharedNotes(nextSharedNotes);
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
    return null;
  }, [searchParams]);

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
        <span style={{ color: 'var(--muted)' }}>This group could not be loaded from the current backend state.</span>
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
          This V1 detail page is intended for groups you belong to. Group notes and comments remain deferred until the broader collaboration policies are tightened.
        </span>
        <Link className="button button-secondary" href="/groups">
          Back to groups
        </Link>
      </section>
    );
  }

  return (
    <div className="page-section">
      <header className="page-header">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', alignItems: 'center' }}>
          <span className="badge">{getGroupVisibilityLabel(group)}</span>
          {membership ? <span style={{ color: 'var(--muted)' }}>Your role: {membership.role}</span> : null}
        </div>
        <h1>{group.name}</h1>
        <p className="page-description">
          {group.description?.trim() || 'No description yet.'}
        </p>
      </header>

      {successMessage ? <section className="empty-state status-message" role="status">{successMessage}</section> : null}

      <section className="responsive-grid compact">
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.4rem' }}>
          <span className="eyebrow">Invite code</span>
          <strong style={{ fontSize: '1.3rem', letterSpacing: '0.08em' }}>{group.invite_code}</strong>
          <span style={{ color: 'var(--muted)' }}>Share this code with people you want to invite.</span>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.4rem' }}>
          <span className="eyebrow">Created</span>
          <strong style={{ fontSize: '1.3rem' }}>{formatGroupDate(group.created_at)}</strong>
          <span style={{ color: 'var(--muted)' }}>{group.is_public ? 'Members can join instantly.' : 'Private groups require a join request.'}</span>
        </article>
      </section>

      <section className="two-column-layout">
        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div className="page-header" style={{ gap: '0.35rem' }}>
            <span className="eyebrow">Members</span>
            <strong style={{ fontSize: '1.1rem' }}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </strong>
            <span style={{ color: 'var(--muted)' }}>
              This surface uses a narrow backend helper to show member names and roles without reopening broad profile access.
            </span>
          </div>

          {members.length === 0 ? (
            <section className="empty-state status-message" role="status">
              <strong>No members found</strong>
              <span style={{ color: 'var(--muted)' }}>
                The current account can access this group, but no visible memberships were returned.
              </span>
            </section>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {members.map((member) => (
                <article
                  className="status-card"
                  key={member.id}
                  style={{ padding: '1rem', display: 'grid', gap: '0.45rem' }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{getGroupMemberLabel(member)}</strong>
                    {member.is_owner ? <span className="badge">Owner</span> : null}
                    {!member.is_owner && member.role === 'admin' ? <span className="badge">Admin</span> : null}
                  </div>
                  <span style={{ color: 'var(--muted)' }}>
                    {member.username ? `@${member.username}` : 'No public username'} • Joined {formatGroupDate(member.joined_at)}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <div className="page-header" style={{ gap: '0.35rem' }}>
            <span className="eyebrow">Group notes</span>
            <strong style={{ fontSize: '1.1rem' }}>
              {nativeNotes.length} {nativeNotes.length === 1 ? 'group note' : 'group notes'}
            </strong>
            <span style={{ color: 'var(--muted)' }}>
              These are the dedicated note sessions already stored in the repo’s `group_notes` table.
            </span>
          </div>

          {nativeNotes.length === 0 ? (
            <section className="empty-state status-message" role="status">
              <strong>No group notes yet</strong>
              <span style={{ color: 'var(--muted)' }}>
                This group does not currently have any dedicated note sessions stored in `group_notes`.
              </span>
            </section>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {nativeNotes.map((note) => (
                <article className="status-card" key={note.id} style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <strong>{note.title?.trim() || 'Untitled'}</strong>
                    <span className="badge">group note</span>
                  </div>
                  <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{getNoteExcerpt(note)}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', color: 'var(--muted)' }}>
                    <span>Updated {formatGroupDate(note.updated_at)}</span>
                    <span>{getScriptureReferenceCount(note)} scripture refs</span>
                  </div>
                  <Link className="button button-secondary" href={`/groups/${group.id}/notes/${note.id}`}>
                    Open group note
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div className="page-header" style={{ gap: '0.35rem' }}>
          <span className="eyebrow">Shared personal notes</span>
          <strong style={{ fontSize: '1.1rem' }}>
            {sharedNotes.length} {sharedNotes.length === 1 ? 'shared note' : 'shared notes'}
          </strong>
          <span style={{ color: 'var(--muted)' }}>
            These are personal notes explicitly shared into the group through the existing `note_shares` path.
          </span>
        </div>

        {sharedNotes.length === 0 ? (
          <section className="empty-state status-message" role="status">
            <strong>No shared personal notes yet</strong>
            <span style={{ color: 'var(--muted)' }}>
              This section only shows notes explicitly shared to the group from someone’s personal note library.
            </span>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {sharedNotes.map((note) => (
              <article className="status-card" key={`shared-${note.id}`} style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
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

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
        <span className="eyebrow">V1 boundary</span>
        <strong>Comments, live collaboration, and advanced permissions stay deferred.</strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          This pass now exposes member-visible `group_notes` and shared personal notes. `group_note_comments`, richer admin tools, and deeper collaboration flows still need a separate safe pass.
        </span>
      </section>

      <div className="cta-row">
        <Link className="button button-secondary" href="/groups">
          Back to groups
        </Link>
      </div>
    </div>
  );
}
