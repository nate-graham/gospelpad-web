'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCurrentMembership, getGroupById, type Group, type GroupMembership } from '@/lib/groups';
import { formatGroupDate, getGroupVisibilityLabel } from '@/components/groups/group-utils';

export function GroupDetailView({ groupId }: { groupId: string }) {
  const searchParams = useSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [nextGroup, nextMembership] = await Promise.all([
          getGroupById(groupId),
          getCurrentMembership(groupId),
        ]);

        if (!active) return;

        setGroup(nextGroup);
        setMembership(nextMembership);
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

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
        <span className="eyebrow">V1 boundary</span>
        <strong>Group notes, comments, and advanced permissions are intentionally deferred.</strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          The repo has schema support for deeper collaboration, but the current policies for group notes and group comments are too broad for a safe web V1. This page focuses on safe membership-level group access only.
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
