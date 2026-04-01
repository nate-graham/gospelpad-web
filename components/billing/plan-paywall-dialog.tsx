'use client';

import Link from 'next/link';

export function PlanPaywallDialog({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      role="dialog"
      style={overlayStyle}
    >
      <section style={dialogStyle}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Upgrade required</span>
          <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{title}</h2>
        </div>

        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>
          {message}
        </p>

        <div className="cta-row">
          <Link className="button button-primary" href="/pricing" onClick={onClose}>
            View plans
          </Link>
          <button className="button button-secondary" onClick={onClose} type="button">
            Not now
          </button>
        </div>
      </section>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(26, 29, 35, 0.56)',
  display: 'grid',
  placeItems: 'center',
  padding: '0.2rem',
  zIndex: 60,
};

const dialogStyle: React.CSSProperties = {
  width: 'min(100%, 960px)',
  padding: '1.5rem',
  display: 'grid',
  gap: '1rem',
  background: 'var(--bg-strong)',
  border: '1px solid #D1AC70',
  borderRadius: '24px',
  boxShadow: '0 24px 56px rgba(26, 29, 35, 0.22)',
  backdropFilter: 'none',
};
