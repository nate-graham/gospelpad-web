export function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{description}</span>
    </section>
  );
}

