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
    <main className="landing-page" style={{ padding: '1.25rem', minHeight: '100vh', display: 'grid' }}>
      <section className="shell-page sanctuary-pricing">
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

        <div className="sanctuary-pricing-layout">
          <header className="sanctuary-pricing-copy">
            <span className="badge">Plans</span>
            <p className="sanctuary-pricing-kicker">Choose how deeply you want GospelPad to carry your practice.</p>
            <h1 className="sanctuary-pricing-title">Keep the core free. Unlock deeper tools when you are ready.</h1>
            <p className="sanctuary-pricing-description">
              Every plan begins with the same note-centered foundation. Paid plans open the fuller scripture, dictation, transcription, and group experience without changing the calm of the product itself.
            </p>

            <div className="sanctuary-pricing-story">
              <div className="sanctuary-pricing-story-line">
                <span className="eyebrow">Free</span>
                <strong>Write, read, and return to your notes with scripture by reference.</strong>
              </div>
              <div className="sanctuary-pricing-story-line">
                <span className="eyebrow">Premium</span>
                <strong>Add phrase search, voice capture, and a wider writing rhythm.</strong>
              </div>
              <div className="sanctuary-pricing-story-line">
                <span className="eyebrow">Team & Ministry</span>
                <strong>Extend the same sanctuary into larger shared spaces.</strong>
              </div>
            </div>
          </header>

          <section className="sanctuary-plan-stack">
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

            <section className="sanctuary-plan-stack-list">
              {plans.map((plan) => (
                <article className={`sanctuary-plan${plan.featured ? ' is-featured' : ''}`} key={plan.name}>
                  <div className="sanctuary-plan-header">
                    <div className="note-hero-block" style={{ gap: '0.35rem' }}>
                      <span className="eyebrow">{plan.name}</span>
                      <strong style={{ fontSize: '2rem' }}>{plan.price}</strong>
                      {plan.cadence ? <span style={{ color: 'var(--muted)' }}>{plan.cadence}</span> : null}
                    </div>
                  </div>

                  <div className="feature-list">
                    {plan.features.map((feature) => (
                      <span key={feature} className="feature-list-item">
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
          </section>
        </div>

        <div className="cta-row">
          <Link className="button button-secondary" href="/notes">
            Back to notes
          </Link>
          <Link className="button button-primary" href="/auth/sign-in">
            Sign in
          </Link>
        </div>
      </section>

      <style jsx>{`
        .sanctuary-pricing {
          width: min(100%, 1460px);
          margin: 0 auto;
          display: grid;
          gap: 1.75rem;
          padding: clamp(1.35rem, 4vw, 3rem);
        }

        .sanctuary-pricing-layout {
          display: grid;
          gap: clamp(1.6rem, 3vw, 3rem);
          align-items: start;
        }

        .sanctuary-pricing-copy {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }

        .sanctuary-pricing-kicker {
          margin: 0;
          color: var(--muted-strong);
          line-height: 1.7;
        }

        .sanctuary-pricing-title {
          margin: 0;
          font-size: clamp(2.6rem, 6vw, 5.2rem);
          line-height: 0.94;
          letter-spacing: -0.05em;
          max-width: 11ch;
        }

        .sanctuary-pricing-description {
          margin: 0;
          color: var(--muted);
          line-height: 1.85;
          max-width: 58ch;
        }

        .sanctuary-pricing-story {
          display: grid;
          gap: 0.95rem;
        }

        .sanctuary-pricing-story-line {
          display: grid;
          gap: 0.35rem;
          padding: 0.8rem 0;
          border-top: 1px solid rgba(255, 248, 235, 0.08);
        }

        .sanctuary-pricing-story-line strong {
          line-height: 1.6;
          font-weight: 600;
        }

        .sanctuary-plan-stack {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }

        .sanctuary-plan-stack-list {
          display: grid;
          gap: 0.4rem;
        }

        .sanctuary-plan {
          display: grid;
          gap: 1rem;
          padding: 1.2rem 0;
          border-top: 1px solid rgba(255, 248, 235, 0.08);
        }

        .sanctuary-plan.is-featured {
          padding-left: 0.9rem;
          border-left: 2px solid var(--accent);
        }

        @media (min-width: 1040px) {
          .sanctuary-pricing-layout {
            grid-template-columns: minmax(0, 0.95fr) minmax(340px, 0.95fr);
          }
        }
      `}</style>
    </main>
  );
}
