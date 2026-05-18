import { ReactNode } from 'react';

export function MarketingHero({ actions }: { actions: ReactNode }) {
  return (
    <section
      className="shell-page sanctuary-hero"
      style={{
        width: 'min(100%, 1380px)',
        margin: '0 auto',
        display: 'grid',
        gap: 'clamp(1.6rem, 3vw, 3rem)',
        padding: 'clamp(1.35rem, 4vw, 3.4rem)',
        minHeight: 'min(90vh, 860px)',
        alignItems: 'center',
        background:
          'radial-gradient(circle at top right, rgba(209, 172, 112, 0.16), transparent 26%), radial-gradient(circle at bottom left, rgba(209, 172, 112, 0.08), transparent 28%)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
      }}
    >
      <div className="sanctuary-hero-copy" style={{ display: 'grid', gap: '1rem', minWidth: 0, alignContent: 'center' }}>
        <span className="badge">The Digital Sanctuary</span>
        <p style={{ margin: 0, color: 'var(--muted-strong)', lineHeight: 1.7, maxWidth: '42rem' }}>
          For writing that stays prayerful, scripture-aware, and unhurried.
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(2.8rem, 7vw, 6.2rem)', lineHeight: 0.93, letterSpacing: '-0.055em', maxWidth: '12ch' }}>
          A quieter place to keep what God is saying.
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.85, maxWidth: '60ch', fontSize: '1.03rem' }}>
          GospelPad gathers notes, scripture, prayer requests, voice capture, and shared reflection into one calm space across phone, tablet, and desktop.
        </p>
        <div className="cta-row sanctuary-hero-actions">{actions}</div>
      </div>

      <div className="sanctuary-hero-flow" style={{ display: 'grid', gap: '1.25rem', minWidth: 0, alignContent: 'center' }}>
        <div style={{ display: 'grid', gap: '0.55rem' }}>
          <span className="eyebrow">One continuous practice</span>
          <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.8, maxWidth: '34rem' }}>
            Begin with a note. Let scripture emerge while you write. Return later with voice, prayer, or shared reflection without leaving the thread.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '0.9rem' }}>
          <article style={{ display: 'grid', gap: '0.45rem', padding: '0.85rem 0', borderTop: '1px solid rgba(255, 248, 235, 0.08)' }}>
            <span className="eyebrow">Write</span>
            <strong style={{ fontSize: '1.02rem', lineHeight: 1.6, fontWeight: 600 }}>
              Capture sermons, study, dreams, journals, and prayer requests in one place.
            </strong>
          </article>
          <article style={{ display: 'grid', gap: '0.45rem', padding: '0.85rem 0', borderTop: '1px solid rgba(255, 248, 235, 0.08)' }}>
            <span className="eyebrow">Read</span>
            <strong style={{ fontSize: '1.02rem', lineHeight: 1.6, fontWeight: 600 }}>
              Preview scripture in context and let it remain close to the writing itself.
            </strong>
          </article>
          <article style={{ display: 'grid', gap: '0.45rem', padding: '0.85rem 0', borderTop: '1px solid rgba(255, 248, 235, 0.08)' }}>
            <span className="eyebrow">Share</span>
            <strong style={{ fontSize: '1.02rem', lineHeight: 1.6, fontWeight: 600 }}>
              Carry reflection into groups and conversations without turning it into a workspace.
            </strong>
          </article>
        </div>

        <blockquote style={{ margin: 0, paddingTop: '0.35rem', color: 'var(--muted-strong)', fontSize: '1.02rem', lineHeight: 1.8, fontStyle: 'italic' }}>
          “Keep what matters in a place that feels deliberate, reverent, and calm.”
        </blockquote>
      </div>
    </section>
  );
}
