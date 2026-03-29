import Link from 'next/link';

const plans = [
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
    ctaLabel: 'Open app',
    ctaHref: '/notes',
    tone: 'secondary' as const,
  },
  {
    name: 'Premium',
    price: '£12.99',
    cadence: '/month or £129/year',
    features: [
      'Dictation and transcription',
      'Scripture search by phrase or keyword',
      'Paid Bible translations',
      'Groups up to 25 members',
    ],
    ctaLabel: 'Coming soon',
    ctaHref: '/notes',
    tone: 'primary' as const,
  },
  {
    name: 'Team',
    price: '£29',
    cadence: '/month or £290/year',
    features: [
      'Everything in Premium',
      'Groups up to 100 members',
      'More room for shared team work',
      'Built for small ministry teams',
    ],
    ctaLabel: 'Coming soon',
    ctaHref: '/notes',
    tone: 'secondary' as const,
  },
  {
    name: 'Ministry',
    price: '£79',
    cadence: '/month or £790/year',
    features: [
      'Everything in Team',
      'Groups up to 300 members',
      'Larger church and ministry support',
      'Best fit for wider communities',
    ],
    ctaLabel: 'Coming soon',
    ctaHref: '/notes',
    tone: 'secondary' as const,
  },
];

export default function PricingPage() {
  return (
    <main className="landing-page" style={{ padding: '1.25rem', minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <section className="panel shell-page" style={{ padding: 'clamp(1.25rem, 4vw, 3rem)', display: 'grid', gap: '1.5rem' }}>
        <header className="page-header" style={{ gap: '0.75rem' }}>
          <span className="badge">Plans</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.3rem, 6vw, 4.5rem)', lineHeight: 0.95 }}>
            Choose the GospelPad plan that fits your work.
          </h1>
          <p className="page-description">
            Free keeps core notes open. Paid plans unlock scripture phrase search, dictation, transcription, and larger groups.
          </p>
        </header>

        <section className="responsive-grid">
          {plans.map((plan) => (
            <article className="panel" key={plan.name} style={{ padding: '1.25rem', display: 'grid', gap: '1rem' }}>
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
                <Link className={`button ${plan.tone === 'primary' ? 'button-primary' : 'button-secondary'}`} href={plan.ctaHref}>
                  {plan.ctaLabel}
                </Link>
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
