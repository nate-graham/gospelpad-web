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
          background: 'var(--bg-soft)',
        }}
      >
        <span className="eyebrow">{eyebrow}</span>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.4rem, 5vw, 4rem)', lineHeight: 0.95, letterSpacing: '-0.04em', fontWeight: 600 }}>{title}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.8 }}>{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
