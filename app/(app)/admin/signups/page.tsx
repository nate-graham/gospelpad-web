import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminEmailAllowlist, getSupabaseAdminClient, isAllowedAdminEmail } from '@/lib/admin';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type SignupRecord = {
  id: string;
  email: string | null;
  createdAt: string;
  confirmedAt: string | null;
  lastSignInAt: string | null;
};

type PlanChangeRecord = {
  id: string;
  userId: string;
  userEmail: string | null;
  eventType: string;
  previousPlanCode: string | null;
  newPlanCode: string;
  previousStatus: string | null;
  newStatus: string;
  becamePaid: boolean;
  createdAt: string;
};

type ActiveSubscriptionRecord = {
  userId: string;
  planCode: string;
  status: string;
};

function formatDateTime(value: string | null) {
  if (!value) return 'Not available';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function buildDailySeries(records: SignupRecord[], days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const map = new Map<string, number>();
  records.forEach((record) => {
    const dayKey = new Date(record.createdAt).toISOString().slice(0, 10);
    map.set(dayKey, (map.get(dayKey) ?? 0) + 1);
  });

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (days - index - 1));
    const key = day.toISOString().slice(0, 10);

    return {
      key,
      label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(day),
      count: map.get(key) ?? 0,
    };
  });
}

function buildEventSeries(records: PlanChangeRecord[], days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const map = new Map<string, number>();
  records.forEach((record) => {
    const dayKey = new Date(record.createdAt).toISOString().slice(0, 10);
    map.set(dayKey, (map.get(dayKey) ?? 0) + 1);
  });

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (days - index - 1));
    const key = day.toISOString().slice(0, 10);

    return {
      key,
      label: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(day),
      count: map.get(key) ?? 0,
    };
  });
}

export default async function AdminSignupsPage() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    redirect('/notes');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isAllowedAdminEmail(user.email)) {
    redirect('/notes');
  }

  const admin = getSupabaseAdminClient();
  const [{ data, error }, { data: subscriptions, error: subscriptionsError }, { data: planChanges, error: planChangesError }] =
    await Promise.all([
      admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      }),
      admin
        .schema('billing')
        .from('subscriptions')
        .select('user_id, plan_code, status')
        .in('status', ['active', 'trialing']),
      admin
        .schema('billing')
        .from('plan_change_events')
        .select(
          'id, user_id, user_email, event_type, previous_plan_code, new_plan_code, previous_status, new_status, became_paid, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

  if (error) {
    throw new Error(error.message);
  }

  if (subscriptionsError) {
    throw new Error(subscriptionsError.message);
  }

  if (planChangesError) {
    throw new Error(planChangesError.message);
  }

  const signups: SignupRecord[] = (data?.users ?? [])
    .map((entry) => ({
      id: entry.id,
      email: entry.email ?? null,
      createdAt: entry.created_at,
      confirmedAt: entry.email_confirmed_at ?? entry.confirmed_at ?? null,
      lastSignInAt: entry.last_sign_in_at ?? null,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = signups.length;
  const confirmed = signups.filter((entry) => entry.confirmedAt).length;
  const last7DaysBoundary = new Date();
  last7DaysBoundary.setDate(last7DaysBoundary.getDate() - 7);
  const last30DaysBoundary = new Date();
  last30DaysBoundary.setDate(last30DaysBoundary.getDate() - 30);

  const last7Days = signups.filter((entry) => new Date(entry.createdAt) >= last7DaysBoundary).length;
  const last30Days = signups.filter((entry) => new Date(entry.createdAt) >= last30DaysBoundary).length;
  const dailySeries = buildDailySeries(signups);
  const maxDailyCount = Math.max(...dailySeries.map((entry) => entry.count), 1);
  const allowlist = getAdminEmailAllowlist();
  const activeSubscriptions: ActiveSubscriptionRecord[] = (subscriptions ?? []).map((entry) => ({
    userId: entry.user_id,
    planCode: entry.plan_code,
    status: entry.status,
  }));
  const paidPlanCounts = activeSubscriptions.reduce<Record<string, number>>((acc, record) => {
    acc[record.planCode] = (acc[record.planCode] ?? 0) + 1;
    return acc;
  }, {});
  const totalPaid = activeSubscriptions.length;
  const paidPlanEvents: PlanChangeRecord[] = (planChanges ?? []).map((entry) => ({
    id: entry.id,
    userId: entry.user_id,
    userEmail: entry.user_email ?? null,
    eventType: entry.event_type,
    previousPlanCode: entry.previous_plan_code ?? null,
    newPlanCode: entry.new_plan_code,
    previousStatus: entry.previous_status ?? null,
    newStatus: entry.new_status,
    becamePaid: Boolean(entry.became_paid),
    createdAt: entry.created_at,
  })).filter((entry) => entry.becamePaid);
  const paidLast30Days = paidPlanEvents.filter((entry) => new Date(entry.createdAt) >= last30DaysBoundary).length;
  const paidTrendSeries = buildEventSeries(paidPlanEvents);
  const maxPaidTrendCount = Math.max(...paidTrendSeries.map((entry) => entry.count), 1);

  return (
    <div className="page-section">
      <header className="page-header">
        <span className="eyebrow">Admin</span>
        <h1>Sign-ups</h1>
        <p className="page-description">
          Track recent account creation across GospelPad. This page is restricted to your admin email allowlist.
        </p>
      </header>

      <section className="responsive-grid compact">
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Total users</span>
          <strong style={{ fontSize: '1.7rem' }}>{total}</strong>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Confirmed</span>
          <strong style={{ fontSize: '1.7rem' }}>{confirmed}</strong>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Last 7 days</span>
          <strong style={{ fontSize: '1.7rem' }}>{last7Days}</strong>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Last 30 days</span>
          <strong style={{ fontSize: '1.7rem' }}>{last30Days}</strong>
        </article>
      </section>

      <section className="responsive-grid compact">
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Paid users</span>
          <strong style={{ fontSize: '1.7rem' }}>{totalPaid}</strong>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Paid in last 30 days</span>
          <strong style={{ fontSize: '1.7rem' }}>{paidLast30Days}</strong>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Premium</span>
          <strong style={{ fontSize: '1.7rem' }}>{paidPlanCounts.premium ?? 0}</strong>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Team</span>
          <strong style={{ fontSize: '1.7rem' }}>{paidPlanCounts.team ?? 0}</strong>
        </article>
        <article className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Ministry</span>
          <strong style={{ fontSize: '1.7rem' }}>{paidPlanCounts.ministry ?? 0}</strong>
        </article>
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Recent trend</span>
          <strong style={{ fontSize: '1.1rem' }}>Daily sign-ups</strong>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${dailySeries.length}, minmax(0, 1fr))`,
            gap: '0.55rem',
            alignItems: 'end',
            minHeight: '180px',
          }}
        >
          {dailySeries.map((entry) => (
            <div key={entry.key} style={{ display: 'grid', gap: '0.45rem', justifyItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>{entry.count}</span>
              <div
                style={{
                  width: '100%',
                  minHeight: '10px',
                  height: `${Math.max((entry.count / maxDailyCount) * 120, entry.count > 0 ? 16 : 10)}px`,
                  borderRadius: '999px 999px 10px 10px',
                  background: 'var(--accent)',
                }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>{entry.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Paid trend</span>
          <strong style={{ fontSize: '1.1rem' }}>Recent upgrades</strong>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${paidTrendSeries.length}, minmax(0, 1fr))`,
            gap: '0.55rem',
            alignItems: 'end',
            minHeight: '180px',
          }}
        >
          {paidTrendSeries.map((entry) => (
            <div key={entry.key} style={{ display: 'grid', gap: '0.45rem', justifyItems: 'center' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>{entry.count}</span>
              <div
                style={{
                  width: '100%',
                  minHeight: '10px',
                  height: `${Math.max((entry.count / maxPaidTrendCount) * 120, entry.count > 0 ? 16 : 10)}px`,
                  borderRadius: '999px 999px 10px 10px',
                  background: 'var(--accent)',
                }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>{entry.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Paid plans</span>
          <strong style={{ fontSize: '1.1rem' }}>Latest plan upgrades</strong>
          <span style={{ color: 'var(--muted)' }}>Shows recent Stripe-driven paid plan changes.</span>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {paidPlanEvents.length === 0 ? (
            <span style={{ color: 'var(--muted)' }}>No paid upgrades recorded yet.</span>
          ) : (
            paidPlanEvents.map((entry) => (
              <article
                key={entry.id}
                style={{
                  display: 'grid',
                  gap: '0.35rem',
                  padding: '0.9rem 1rem',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  background: 'var(--field-bg-soft)',
                }}
              >
                <strong>{entry.userEmail ?? entry.userId}</strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                  Plan: {(entry.previousPlanCode ?? 'free')} to {entry.newPlanCode}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                  Status: {(entry.previousStatus ?? 'inactive')} to {entry.newStatus}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                  Changed: {formatDateTime(entry.createdAt)}
                </span>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Latest accounts</span>
          <strong style={{ fontSize: '1.1rem' }}>Most recent sign-ups</strong>
          <span style={{ color: 'var(--muted)' }}>Showing up to the latest 200 auth users.</span>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {signups.map((entry) => (
            <article
              key={entry.id}
              style={{
                display: 'grid',
                gap: '0.35rem',
                padding: '0.9rem 1rem',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                background: 'var(--field-bg-soft)',
              }}
            >
              <strong>{entry.email ?? 'No email'}</strong>
              <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                Signed up: {formatDateTime(entry.createdAt)}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                Confirmed: {formatDateTime(entry.confirmedAt)}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                Last sign-in: {formatDateTime(entry.lastSignInAt)}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
        <span className="eyebrow">Access</span>
        <strong style={{ fontSize: '1.05rem' }}>Current admin allowlist</strong>
        <span style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>
          {allowlist.length > 0 ? allowlist.join(', ') : 'No admin emails configured.'}
        </span>
        <Link className="button button-secondary" href="/settings">
          Back to settings
        </Link>
      </section>
    </div>
  );
}
