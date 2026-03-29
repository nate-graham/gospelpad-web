'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createCheckoutSession } from '@/lib/billing';

type PaidPlanCode = 'premium' | 'team' | 'ministry';
type BillingInterval = 'month' | 'year';

const plans: Array<{
  name: string;
  planCode?: PaidPlanCode;
  price: string;
  cadence: string;
  features: string[];
  featured?: boolean;
}> = [
  {
    name: 'Free',
    price: '£0',
    cadence: '',
    features: [
      'Personal notes and sharing',
      'Scripture lookup by reference',
      'Groups up to 5 members',
      'Web and mobile access',
    ],
  },
  {
    name: 'Premium',
    planCode: 'premium',
    price: '£12.99',
    cadence: '/month or £129/year',
    features: [
      'Dictation and transcription',
      'Scripture search by phrase or keyword',
      'Paid Bible translations (coming soon)',
      'Groups up to 25 members',
    ],
    featured: true,
  },
  {
    name: 'Team',
    planCode: 'team',
    price: '£29',
    cadence: '/month or £290/year',
    features: [
      'Everything in Premium',
      'Groups up to 100 members',
      'More room for shared team work',
      'Built for small ministry teams',
    ],
  },
  {
    name: 'Ministry',
    planCode: 'ministry',
    price: '£79',
    cadence: '/month or £790/year',
    features: [
      'Everything in Team',
      'Groups up to 300 members',
      'Larger church and ministry support',
      'Best fit for wider communities',
    ],
  },
];

export default function PricingPage() {
  const searchParams = useSearchParams();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkoutMessage = useMemo(() => {
    const status = searchParams.get('checkout');
    if (status === 'success') {
      return 'Checkout completed. Your plan will update as soon as Stripe confirms the subscription.';
    }
    if (status === 'cancelled') {
      return 'Checkout was cancelled. You can choose a plan again whenever you are ready.';
    }
    return null;
  }, [searchParams]);

  const startCheckout = async (planCode: PaidPlanCode, billingInterval: BillingInterval) => {
    try {
      const key = `${planCode}-${billingInterval}`;
      setLoadingKey(key);
      setError(null);
      const url = await createCheckoutSession(planCode, billingInterval);
      window.location.assign(url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start checkout right now.');
      setLoadingKey(null);
    }
  };

  return (
    <main className="landing-page" style={{ padding: '1.25rem', minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <section className="panel shell-page" style={{ padding: 'clamp(1.25rem, 4vw, 3rem)', display: 'grid', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Link
            aria-label="Close plans"
            className="button button-secondary"
            href="/notes"
            style={{ minWidth: '44px', minHeight: '44px', padding: '0.65rem 0.95rem', fontSize: '1.1rem' }}
          >
            ×
          </Link>
        </div>

        <header className="page-header" style={{ gap: '0.75rem' }}>
          <span className="badge">Plans</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.3rem, 6vw, 4.5rem)', lineHeight: 0.95 }}>Upgrade your plan!</h1>
          <p className="page-description">
            Free keeps core notes open. Paid plans unlock scripture phrase search, dictation, transcription, and larger groups.
          </p>
        </header>

        {checkoutMessage ? (
          <section className="empty-state status-message" role="status">
            <strong>Checkout update</strong>
            <span style={{ color: 'var(--muted)' }}>{checkoutMessage}</span>
          </section>
        ) : null}

        {error ? (
          <section className="error-state status-message" role="alert">
            <strong>Checkout could not start</strong>
            <span style={{ color: 'var(--muted)' }}>{error}</span>
          </section>
        ) : null}

        <section className="responsive-grid">
          {plans.map((plan) => (
            <article
              className="panel"
              key={plan.name}
              style={{
                padding: '1.25rem',
                display: 'grid',
                gap: '1rem',
                borderColor: plan.featured ? 'var(--accent)' : undefined,
              }}
            >
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="eyebrow">{plan.name}</span>
                <strong style={{ fontSize: '2rem' }}>{plan.price}</strong>
                {plan.cadence ? <span style={{ color: 'var(--muted)' }}>{plan.cadence}</span> : null}
              </div>

              <div style={{ display: 'grid', gap: '0.7rem' }}>
                {plan.features.map((feature) => (
                  <span key={feature} style={{ color: 'var(--text)', lineHeight: 1.6 }}>
                    {feature}
                  </span>
                ))}
              </div>

              <div className="cta-row">
                {plan.planCode ? (
                  <>
                    <button
                      className={plan.featured ? 'button button-primary' : 'button button-secondary'}
                      disabled={Boolean(loadingKey)}
                      onClick={() => void startCheckout(plan.planCode!, 'month')}
                      type="button"
                    >
                      {loadingKey === `${plan.planCode}-month` ? 'Starting…' : 'Choose monthly'}
                    </button>
                    <button
                      className="button button-secondary"
                      disabled={Boolean(loadingKey)}
                      onClick={() => void startCheckout(plan.planCode!, 'year')}
                      type="button"
                    >
                      {loadingKey === `${plan.planCode}-year` ? 'Starting…' : 'Choose yearly'}
                    </button>
                  </>
                ) : (
                  <Link className="button button-secondary" href="/notes">
                    Open app
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>

        <div className="cta-row">
          <Link className="button button-secondary" href="/notes">
            Back to notes
          </Link>
          <Link className="button button-primary" href="/auth/sign-in">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
