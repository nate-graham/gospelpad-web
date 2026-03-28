'use client';

type InfoHintProps = {
  text: string;
  label?: string;
};

export function InfoHint({ text, label = 'More information' }: InfoHintProps) {
  return (
    <details style={detailsStyle}>
      <summary aria-label={label} style={summaryStyle}>
        i
      </summary>
      <div className="panel" style={popoverStyle}>
        {text}
      </div>
    </details>
  );
}

const detailsStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const summaryStyle: React.CSSProperties = {
  listStyle: 'none',
  width: '1.4rem',
  height: '1.4rem',
  borderRadius: '999px',
  border: '1px solid var(--line)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  color: 'var(--muted)',
  fontSize: '0.82rem',
  fontWeight: 700,
  userSelect: 'none',
  background: 'var(--field-bg)',
};

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 0.5rem)',
  right: 0,
  width: 'min(18rem, calc(100vw - 2rem))',
  padding: '0.85rem 0.95rem',
  color: 'var(--muted)',
  lineHeight: 1.6,
  zIndex: 20,
};
