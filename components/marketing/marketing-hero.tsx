import { ReactNode } from 'react';

export function MarketingHero({ actions }: { actions: ReactNode }) {
  return (
    <section
      className="panel shell-page marketing-hero"
      style={{
        overflow: 'hidden',
        display: 'grid',
        gap: '1.25rem',
        padding: 'clamp(1.25rem, 4vw, 3rem)',
        gridTemplateColumns: '1.2fr 0.8fr',
      }}
    >
      <div style={{ display: 'grid', gap: '1rem', alignContent: 'center' }}>
        <span className="badge">GospelPad</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(2.5rem, 7vw, 5rem)', lineHeight: 0.95 }}>
          A browser-ready GospelPad for phone, tablet, and desktop.
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '60ch', lineHeight: 1.75 }}>
          Keep your notes, groups, prayer requests, and shared conversations with you wherever you open GospelPad.
        </p>
        <div className="cta-row">{actions}</div>
      </div>

      <div
        style={{
          minHeight: '320px',
          borderRadius: '24px',
          border: '1px solid var(--line)',
          background:
            'linear-gradient(180deg, rgba(154,106,27,0.16), rgba(255,255,255,0.6)), repeating-linear-gradient(135deg, rgba(125,83,16,0.06), rgba(125,83,16,0.06) 10px, transparent 10px, transparent 20px)',
          padding: '1rem',
          display: 'grid',
          gap: '0.85rem',
          alignContent: 'start',
        }}
      >
        <div className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
          <strong>Keep your thoughts together</strong>
          <span style={{ color: 'var(--muted)' }}>Write notes, capture scripture, and return to what matters most.</span>
        </div>
        <div className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
          <strong>Stay connected in groups</strong>
          <span style={{ color: 'var(--muted)' }}>Share notes, post announcements, and follow conversations with your people.</span>
        </div>
      </div>
    </section>
  );
}
