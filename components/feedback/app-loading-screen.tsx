export function AppLoadingScreen({ label }: { label: string }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.25rem' }}>
      <section className="panel loading-state" style={{ width: 'min(100%, 420px)', textAlign: 'center' }}>
        <strong>{label}</strong>
        <span style={{ color: 'var(--muted)' }}>Getting your account and workspace ready.</span>
      </section>
    </main>
  );
}
