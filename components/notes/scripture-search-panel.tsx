'use client';

import type { CSSProperties, KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';
import { fetchScriptureByReference, formatScriptureForInsertion, type ScriptureResult } from '@/lib/scripture';

export function ScriptureSearchPanel({
  onInsert,
}: {
  onInsert: (payload: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ScriptureResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSearch = useMemo(() => query.trim().length > 0, [query]);

  const runSearch = async () => {
    if (!canSearch) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const next = await fetchScriptureByReference(query.trim());
      setResult(next);
    } catch (lookupError) {
      setResult(null);
      setError(lookupError instanceof Error ? lookupError.message : 'Unable to fetch scripture.');
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void runSearch();
  };

  const insertResult = () => {
    if (!result) return;
    onInsert(formatScriptureForInsertion(result));
    setNotice(`Inserted ${result.reference} into the current note.`);
  };

  return (
    <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <span className="eyebrow">Scripture Search V1</span>
        <strong style={{ fontSize: '1.05rem' }}>Insert a verse by reference</strong>
        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Use a direct reference like <code>John 3:16</code> or <code>Psalm 23:1-4</code>. Rough text search is deferred from this V1.
        </span>
      </div>

      <div
        className="search-row"
        style={{
          display: 'grid',
          gap: '0.85rem',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'end',
        }}
      >
        <label style={fieldStyle}>
          <span className="eyebrow" style={labelTextStyle}>Verse reference</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="John 3:16"
            style={inputStyle}
          />
        </label>
        <button className="button button-secondary" disabled={loading || !canSearch} onClick={() => void runSearch()} type="button">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error ? (
        <div className="error-state status-message" role="alert">
          <strong>Scripture search failed</strong>
          <span style={{ color: 'var(--muted)' }}>{error}</span>
        </div>
      ) : null}

      {notice ? <div className="empty-state status-message" role="status">{notice}</div> : null}

      {result ? (
        <section
          style={{
            display: 'grid',
            gap: '0.9rem',
            border: '1px solid var(--line)',
            borderRadius: '16px',
            padding: '1rem',
            background: 'rgba(255,255,255,0.52)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            <span className="badge">{result.translation}</span>
            <strong>{result.reference}</strong>
          </div>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.8,
              color: 'var(--text)',
            }}
          >
            {result.text}
          </div>
          <div className="cta-row">
            <button className="button button-primary" onClick={insertResult} type="button">
              Insert into note
            </button>
          </div>
        </section>
      ) : null}

      <style jsx>{`
        @media (max-width: 720px) {
          .search-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
};

const labelTextStyle: CSSProperties = {
  fontSize: '0.72rem',
};

const inputStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid var(--line)',
  padding: '0.85rem 1rem',
  background: 'rgba(255,255,255,0.72)',
  color: 'var(--text)',
};
