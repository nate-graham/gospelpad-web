'use client';

export function AppErrorState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.25rem' }}>
      <section className="panel error-state" style={{ width: 'min(100%, 460px)' }}>
        <strong>{title}</strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{description}</span>
        {actionLabel && onAction ? (
          <button className="button button-primary" onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
      </section>
    </main>
  );
}

