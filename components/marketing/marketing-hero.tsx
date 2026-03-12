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
        <span className="badge">GospelPad Web Foundation</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(2.5rem, 7vw, 5rem)', lineHeight: 0.95 }}>
          A browser-ready GospelPad for phone, tablet, and desktop.
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '60ch', lineHeight: 1.75 }}>
          This standalone web frontend is intentionally separate from the mobile app so web shipping can move now
          without disturbing the native launch path.
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
          <strong>V1-ready sections</strong>
          <span style={{ color: 'var(--muted)' }}>Notes, groups, profile, settings, and an authenticated shell are already routed.</span>
        </div>
        <div className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
          <strong>Backend-safe baseline</strong>
          <span style={{ color: 'var(--muted)' }}>The web app uses browser-safe Supabase env vars and keeps all mobile code isolated.</span>
        </div>
      </div>
    </section>
  );
}
