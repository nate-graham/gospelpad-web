export function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header style={{ display: 'grid', gap: '0.55rem' }}>
      <span className="eyebrow">{eyebrow}</span>
      <h1 style={{ margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.5rem)' }}>{title}</h1>
      <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '65ch', lineHeight: 1.6 }}>{description}</p>
    </header>
  );
}

