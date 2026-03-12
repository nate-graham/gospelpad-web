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
          width: 'min(100%, 480px)',
          padding: '1.5rem',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <span className="eyebrow">{eyebrow}</span>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1 }}>{title}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

