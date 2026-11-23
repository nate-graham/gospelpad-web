'use client';

import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import {
  fetchScriptureByReference,
  findScriptureByQuery,
  formatScriptureForInsertion,
  formatScriptureTextForInsertion,
  type ScriptureResult,
} from '@/lib/scripture';
import { formatVerseReference } from '@/components/notes/scripture-reference-text';

const TRANSLATIONS = ['KJV', 'WEB', 'OEB-US', 'NIV', 'ESV', 'NLT'];

/**
 * The Scripture column beside the note composer: look up a reference (or, on paid plans, a phrase),
 * read it as a verse callout, then insert it into the note or copy it. A reference tapped in the
 * note body (or newly typed there) loads here on its own.
 */
export function ScriptureRail({
  reference,
  onInsert,
  phraseSearchEnabled,
}: {
  reference: string | null;
  onInsert: (payload: string) => void;
  phraseSearchEnabled: boolean | null;
}) {
  const [query, setQuery] = useState(reference ?? '');
  const [translation, setTranslation] = useState('KJV');
  const [results, setResults] = useState<ScriptureResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (value: string, nextTranslation = translation) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      try {
        setResults([await fetchScriptureByReference(trimmed, nextTranslation)]);
      } catch {
        const searched = await findScriptureByQuery(trimmed);
        if (!searched.results.length) throw new Error('Nothing matched that search.');
        setResults(searched.results.slice(0, 4));
      }
    } catch (lookupError) {
      setResults([]);
      setError(lookupError instanceof Error ? lookupError.message : 'Unable to fetch Scripture.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!reference) return;
    setQuery(reference);
    void run(reference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void run(query);
  };

  const copy = async (result: ScriptureResult) => {
    try {
      await window.navigator.clipboard.writeText(formatScriptureForInsertion(result));
      setNotice(`Copied ${result.reference}.`);
    } catch {
      setNotice('Copying is not available in this browser.');
    }
  };

  return (
    <section className="scripture-rail" aria-label="Scripture search">
      <span className="rail-heading">Scripture search</span>

      <div className="scripture-rail-search">
        <input
          aria-label="Reference, phrase, or keyword"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Isaiah 26:3 or “perfect peace”"
          type="search"
          value={query}
        />
        <select
          aria-label="Translation"
          onChange={(event) => {
            setTranslation(event.target.value);
            if (query.trim()) void run(query, event.target.value);
          }}
          value={translation}
        >
          {TRANSLATIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="scripture-rail-status" role="status">Looking it up…</p> : null}
      {error ? <p className="scripture-rail-status" role="alert">{error}</p> : null}

      {results.map((result) => (
        <article className="scripture-rail-card" key={`${result.reference}-${result.translation}`}>
          <p className="scripture-rail-text">{result.text.trim()}</p>
          <span className="verse-callout-ref">
            {formatVerseReference(result.reference)} · {result.translation}
          </span>
          {result.reason ? <span className="scripture-rail-reason">{result.reason}</span> : null}
          <div className="scripture-rail-actions">
            <button
              className="button button-primary"
              onClick={() => {
                onInsert(formatScriptureTextForInsertion(result));
                setNotice(`Inserted ${result.reference}.`);
              }}
              type="button"
            >
              Insert into note
            </button>
            <button className="button button-secondary" onClick={() => void copy(result)} type="button">
              Copy
            </button>
          </div>
        </article>
      ))}

      {notice ? <p className="scripture-rail-status" role="status">{notice}</p> : null}

      {phraseSearchEnabled === false ? (
        <aside className="scripture-rail-upsell">
          <strong>Search by phrase or keyword</strong>
          <span>
            Find “love is patient” without knowing the reference. Available on Premium, Team and Ministry.{' '}
            <Link href="/pricing">See plans</Link>
          </span>
        </aside>
      ) : null}
    </section>
  );
}
