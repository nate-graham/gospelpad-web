'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createCheckoutSession } from '@/lib/billing';
import { getMyEntitlements } from '@/lib/entitlements';

type PaidPlanCode = 'premium' | 'team' | 'ministry';
type BillingInterval = 'month' | 'year';

type Plan = {
  name: string;
  code: 'free' | PaidPlanCode;
  tagline: string;
  monthly: string;
  yearly: string;
  yearlyNote: string;
  features: string[];
  accent: 'ink' | 'gold' | 'lapis' | 'vermilion';
  featured?: boolean;
};

const plans: Plan[] = [
  {
    name: 'Free',
    code: 'free',
    tagline: 'For your own notes',
    monthly: '£0',
    yearly: '£0',
    yearlyNote: '',
    features: ['Personal notes and sharing', 'Scripture lookup by reference', 'Berea inductive study', 'Groups up to 5 members', 'Web and mobile access'],
    accent: 'ink',
  },
  {
    name: 'Premium',
    code: 'premium',
    tagline: 'For a deeper practice',
    monthly: '£12.99',
    yearly: '£129',
    yearlyNote: 'about £10.75 a month',
    features: ['Dictation and transcription', 'Scripture search by phrase or keyword', 'Paid Bible translations (coming soon)', 'Groups up to 25 members'],
    accent: 'gold',
    featured: true,
  },
  {
    name: 'Team',
    code: 'team',
    tagline: 'For small ministry teams',
    monthly: '£29',
    yearly: '£290',
    yearlyNote: 'about £24.17 a month',
    features: ['Everything in Premium', 'Groups up to 100 members', 'Built for small ministry teams'],
    accent: 'lapis',
  },
  {
    name: 'Ministry',
    code: 'ministry',
    tagline: 'For churches and communities',
    monthly: '£79',
    yearly: '£790',
    yearlyNote: 'about £65.83 a month',
    features: ['Everything in Team', 'Groups up to 300 members', 'For churches and wider communities'],
    accent: 'vermilion',
  },
];

export default function PricingPage() {
  const searchParams = useSearchParams();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setBillingInterval] = useState<BillingInterval>('month');
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getMyEntitlements()
      .then((entitlements) => {
        if (!active) return;
        setSignedIn(true);
        setCurrentPlan(entitlements.planCode);
      })
      .catch(() => active && setSignedIn(false));
    return () => {
      active = false;
    };
  }, []);

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
    <main className="plans-page">
      <div className="plans-topbar">
        <span className="plans-brand">
          GospelPad <span aria-hidden="true" /> Plans
        </span>
        <Link aria-label="Close plans" className="plans-close" href={signedIn === false ? '/' : '/notes'}>
          ×
        </Link>
      </div>

      <header className="plans-header">
        <div>
          <h1>
            Room for every <em>sermon.</em>
          </h1>
          <p>Free keeps your notes open. Paid plans add dictation, transcription, phrase search and larger groups.</p>
        </div>
        <div className="segmented plans-interval" role="group" aria-label="Billing">
          <button aria-pressed={interval === 'month'} onClick={() => setBillingInterval('month')} type="button">
            Monthly
          </button>
          <button aria-pressed={interval === 'year'} onClick={() => setBillingInterval('year')} type="button">
            Yearly <em>2 months free</em>
          </button>
        </div>
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

      <section className="plans-grid">
        {plans.map((plan) => {
          const isCurrent = signedIn && (currentPlan ?? 'free') === plan.code;
          const paid = plan.code !== 'free';
          return (
            <article className={`plan-option is-${plan.accent}${plan.featured ? ' is-featured' : ''}`} key={plan.name}>
              <div className="plan-option-head">
                <span className="plan-option-name">{plan.name}</span>
                {plan.featured ? <span className="plan-option-flag">Most chosen</span> : null}
                {isCurrent ? <span className="plan-option-flag is-current">Your plan</span> : null}
              </div>
              <div className="plan-option-price">
                <strong>{interval === 'month' ? plan.monthly : plan.yearly}</strong>
                {paid ? <span>/{interval === 'month' ? 'month' : 'year'}</span> : null}
              </div>
              <span className="plan-option-sub">
                {paid ? (interval === 'month' ? `or ${plan.yearly} a year` : plan.yearlyNote) : plan.tagline}
              </span>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {paid ? (
                <button
                  className="button plan-option-button"
                  disabled={Boolean(loadingKey) || Boolean(isCurrent)}
                  onClick={() => (signedIn === false ? window.location.assign('/auth/sign-in?next=/pricing') : void startCheckout(plan.code as PaidPlanCode, interval))}
                  type="button"
                >
                  {loadingKey === `${plan.code}-${interval}` ? 'Starting…' : isCurrent ? 'Your current plan' : `Choose ${plan.name}`}
                </button>
              ) : isCurrent ? (
                <span className="button plan-option-button is-quiet">Your current plan</span>
              ) : (
                <Link className="button plan-option-button is-quiet" href={signedIn ? '/notes' : '/auth/sign-up'}>
                  {signedIn ? 'Open GospelPad' : 'Start free'}
                </Link>
              )}
            </article>
          );
        })}
      </section>

      <p className="plans-footnote">
        Payments are handled securely by Stripe. Your plan updates as soon as Stripe confirms it, and you can cancel any time.
      </p>
    </main>
  );
}
