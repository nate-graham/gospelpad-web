import { ReactNode } from 'react';

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1.25rem',
      }}
    >
      <section
        className="panel"
        style={{
          width: 'min(100%, 540px)',
          padding: '2rem',
          display: 'grid',
          gap: '1.2rem',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <a href="/" style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          GospelPad
        </a>
        <span className="eyebrow">{eyebrow}</span>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.2rem, 5vw, 3.2rem)', lineHeight: 1.06 }}>{title}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.8 }}>{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
