'use client';

import type { CSSProperties, KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getMyEntitlements, type EntitlementSummary } from '@/lib/entitlements';
import { fetchScriptureByReference, findScriptureByQuery, formatScriptureForInsertion, type ScriptureResult } from '@/lib/scripture';

export function ScriptureSearchPanel({
  onInsert,
  onCreateNote,
  compact = false,
}: {
  onInsert?: (payload: string) => void;
  onCreateNote?: (payload: string, result: ScriptureResult) => void | Promise<void>;
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScriptureResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [translation, setTranslation] = useState('KJV');
  const [entitlements, setEntitlements] = useState<EntitlementSummary | null>(null);

  const canSearch = useMemo(() => query.trim().length > 0, [query]);
  const translationOptions = useMemo(
    () => [
      'KJV',
      'WEB',
      'OEB-US',
      ...(entitlements?.paidBibleTranslationsEnabled ? ['NIV', 'ESV', 'NLT'] : []),
    ],
    [entitlements?.paidBibleTranslationsEnabled]
  );

  useEffect(() => {
    let active = true;

    const loadEntitlements = async () => {
      try {
        const next = await getMyEntitlements();
        if (!active) return;
        setEntitlements(next);
      } catch {
        if (!active) return;
        setEntitlements(null);
      }
    };

    void loadEntitlements();

    return () => {
      active = false;
    };
  }, []);

  const runSearch = async () => {
    if (!canSearch) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const trimmed = query.trim();

      try {
        const next = await fetchScriptureByReference(trimmed, translation);
        setResults([next]);
      } catch {
        const searched = await findScriptureByQuery(trimmed);
        if (searched.results.length === 0) {
          throw new Error('No scripture results matched that search.');
        }
        if (translation === 'KJV') {
          setResults(searched.results);
          return;
        }

        const translatedResults = await Promise.all(
          searched.results.map(async (result) => ({
            ...(await fetchScriptureByReference(result.reference, translation)),
            reason: result.reason,
          }))
        );
        setResults(translatedResults);
      }
    } catch (lookupError) {
      setResults([]);
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

  const insertResult = (result: ScriptureResult) => {
    if (!onInsert) return;
    onInsert(formatScriptureForInsertion(result));
    setNotice(`Inserted ${result.reference} into the current note.`);
  };

  const copyResult = async (result: ScriptureResult) => {
    if (typeof window === 'undefined' || !window.navigator?.clipboard) {
      setNotice('Clipboard copy is not available in this browser.');
      return;
    }

    await window.navigator.clipboard.writeText(formatScriptureForInsertion(result));
    setNotice(`Copied ${result.reference}.`);
  };

  const createNoteFromResult = async (result: ScriptureResult) => {
    if (!onCreateNote) return;
    await onCreateNote(formatScriptureForInsertion(result), result);
    setNotice(`Opened a new note with ${result.reference}.`);
  };

  return (
    <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <span className="eyebrow">Scripture search</span>
        <strong style={{ fontSize: compact ? '1rem' : '1.05rem' }}>Search by reference, phrase, or keyword</strong>
      </div>

      <div
        className="search-row"
        style={{
          display: 'grid',
          gap: '0.85rem',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(140px, 200px) auto',
          alignItems: 'end',
        }}
      >
        <label style={fieldStyle}>
          <span className="eyebrow" style={labelTextStyle}>Reference or phrase</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="John 3:16 or love is patient"
            style={inputStyle}
          />
        </label>
        <label style={fieldStyle}>
          <span className="eyebrow" style={labelTextStyle}>Translation</span>
          <select value={translation} onChange={(event) => setTranslation(event.target.value)} style={inputStyle}>
            {translationOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-secondary" disabled={loading || !canSearch} onClick={() => void runSearch()} type="button">
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {translationOptions.length === 1 ? (
        <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          KJV is available now. Premium adds phrase search and licensed translations.
        </span>
      ) : null}

      {error ? (
        <div className="error-state status-message" role="alert">
          <strong>Scripture search failed</strong>
          <span style={{ color: 'var(--muted)' }}>{error}</span>
        </div>
      ) : null}

      {notice ? <div className="empty-state status-message" role="status">{notice}</div> : null}

      {results.length > 0 ? (
        <section style={{ display: 'grid', gap: '0.85rem' }}>
          {results.map((result) => (
            <section
              key={`${result.reference}-${result.translation}`}
              style={{
                display: 'grid',
                gap: '0.9rem',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                padding: '1rem',
                background: 'var(--field-bg-soft)',
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
              {result.reason ? (
                <span style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  {result.reason}
                </span>
              ) : null}
              <div className="cta-row">
                {onInsert ? (
                  <button className="button button-primary" onClick={() => insertResult(result)} type="button">
                    Insert into note
                  </button>
                ) : null}
                {onCreateNote ? (
                  <button className="button button-secondary" onClick={() => void createNoteFromResult(result)} type="button">
                    New note
                  </button>
                ) : null}
                <button
                  className={onInsert || onCreateNote ? 'button button-secondary' : 'button button-primary'}
                  onClick={() => void copyResult(result)}
                  type="button"
                >
                  Copy scripture
                </button>
              </div>
            </section>
          ))}
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
  background: 'var(--field-bg)',
  color: 'var(--text)',
};
