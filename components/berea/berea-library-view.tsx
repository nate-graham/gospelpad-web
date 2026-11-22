'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { listNotes, type NoteRecord } from '@/lib/notes';
import { BEREA_STAGES, bereaHrefForReference, getBereaProgress, isBereaNote, parseBereaStudy } from '@/lib/berea';
import { findScriptureReferences } from '@/lib/scripture-references';
import { formatNoteDate } from '@/components/notes/note-utils';

type Suggestion = { reference: string; noteId: string; noteTitle: string };

export function BereaLibraryView() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');

  useEffect(() => {
    let active = true;
    listNotes({ sort: 'updated-desc' })
      .then((result) => {
        if (active) setNotes(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your studies.');
      });
    return () => {
      active = false;
    };
  }, []);

  const studies = useMemo(() => (notes ?? []).filter((note) => isBereaNote(note)), [notes]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!notes) return [];
    const studied = new Set(studies.map((note) => parseBereaStudy(note).reference.toLowerCase()));
    const seen = new Set<string>();
    const result: Suggestion[] = [];
    for (const note of notes) {
      if (isBereaNote(note)) continue;
      for (const found of findScriptureReferences(note.body ?? '')) {
        const key = found.toLowerCase();
        if (studied.has(key) || seen.has(key)) continue;
        seen.add(key);
        result.push({ reference: found, noteId: note.id, noteTitle: note.title || 'Untitled note' });
        if (result.length >= 6) return result;
      }
    }
    return result;
  }, [notes, studies]);

  const begin = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = reference.trim();
    router.push(trimmed ? bereaHrefForReference(trimmed) : '/berea/new');
  };

  return (
    <div className="berea-lib">
      <div aria-hidden="true" className="berea-watermark">
        B
      </div>

      <header className="berea-lib-head">
        <div className="berea-lib-title">
          <span className="berea-kicker">
            <span style={{ color: 'var(--accent)' }}>Berea</span>
            <span aria-hidden="true" className="berea-dash" />
            <span>Inductive study</span>
          </span>
          <h1>
            Examine the <em>Scriptures.</em>
          </h1>
          <blockquote className="verse-callout" style={{ maxWidth: '34rem' }}>
            <span className="verse-callout-text">
              …they received the word with all readiness of mind, and searched the scriptures daily, whether those things
              were so.
            </span>
            <span className="verse-callout-ref">Acts 17 : 11 · KJV</span>
          </blockquote>
        </div>

        <form className="berea-begin" onSubmit={begin}>
          <label className="eyebrow" htmlFor="berea-reference">
            Begin a study
          </label>
          <input
            id="berea-reference"
            onChange={(event) => setReference(event.target.value)}
            placeholder="Passage — e.g. Acts 17:10-12"
            value={reference}
          />
          <button className="button button-primary" type="submit">
            Begin a study
          </button>
        </form>
      </header>

      <div className="berea-lib-body">
        <section aria-label="Your studies" className="berea-lib-main">
          {error ? (
            <div className="error-state status-message" role="alert">
              <strong>Studies could not load</strong>
              <span style={{ color: 'var(--muted)' }}>{error}</span>
            </div>
          ) : notes === null ? (
            <div className="loading-state">Gathering your studies…</div>
          ) : studies.length === 0 ? (
            <div className="empty-state">
              <strong className="serif" style={{ fontSize: '1.3rem' }}>
                No studies yet
              </strong>
              <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                The Bereans examined the Scriptures daily. Begin with a single passage, or pick a verse you heard in a
                sermon below.
              </span>
            </div>
          ) : (
            <div className="berea-table" role="list">
              <div className="berea-row berea-row-head" aria-hidden="true">
                <span>Passage</span>
                <span>Started from</span>
                <span>Progress</span>
                <span style={{ textAlign: 'right' }}>Updated</span>
              </div>
              {studies.map((note) => {
                const study = parseBereaStudy(note);
                const progress = getBereaProgress(study);
                return (
                  <Link className="berea-row" href={`/berea/${note.id}`} key={note.id} role="listitem">
                    <span className="berea-row-ref">{study.reference || note.title || 'Untitled passage'}</span>
                    <span className="berea-row-from">{study.sourceTitle ? `“${study.sourceTitle}”` : 'Started fresh'}</span>
                    <span className="berea-progress" aria-label="Progress">
                      {BEREA_STAGES.map((stage) => (
                        <span className={progress[stage.key] ? 'is-done' : ''} key={stage.key} title={stage.title}>
                          {stage.title.charAt(0)}
                        </span>
                      ))}
                    </span>
                    <span className="berea-row-date">{formatNoteDate(note.updated_at)}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {suggestions.length > 0 ? (
            <div className="berea-suggest">
              <span className="eyebrow" style={{ color: 'var(--accent)' }}>
                Found in your notes, not yet studied
              </span>
              <div className="berea-suggest-grid">
                {suggestions.map((suggestion) => (
                  <Link
                    className="berea-suggest-card"
                    href={bereaHrefForReference(suggestion.reference, { id: suggestion.noteId, title: suggestion.noteTitle })}
                    key={suggestion.reference}
                  >
                    <span className="pilcrow" aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                      ¶
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.15rem' }}>
                      <strong>{suggestion.reference}</strong>
                      <span>{suggestion.noteTitle}</span>
                    </span>
                    <span className="berea-suggest-go">Study</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside aria-label="How Berea works" className="berea-lib-rail">
          <span className="eyebrow">Three stages, in order</span>
          {BEREA_STAGES.map((stage) => (
            <div className="berea-stage-line" key={stage.key}>
              <span className="berea-numeral">{stage.numeral}</span>
              <span style={{ display: 'grid', gap: '0.25rem' }}>
                <strong className="serif" style={{ fontSize: '1.15rem' }}>
                  {stage.title}
                </strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>{stage.question}</span>
              </span>
            </div>
          ))}
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.86rem', lineHeight: 1.6 }}>
            Each study is saved in your notebook as a Study note, so it’s on your phone too.
          </p>
        </aside>
      </div>

      <style>{`
        .berea-lib { position: relative; display: grid; gap: 2.4rem; }
        .berea-watermark {
          position: absolute; right: -2%; top: -6rem; z-index: 0;
          font-family: var(--font-serif); font-weight: 500; font-size: clamp(240px, 34vw, 480px); line-height: 1;
          color: var(--accent); opacity: 0.06; pointer-events: none; user-select: none;
        }
        .berea-lib-head, .berea-lib-body { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 2.5rem; }
        .berea-lib-head { align-items: flex-end; }
        .berea-lib-title { flex: 999 1 380px; min-width: 0; display: grid; gap: 1.1rem; }
        .berea-lib-title h1 { margin: 0; font-size: clamp(2.6rem, 5vw, 4rem); line-height: 1.04; }
        .berea-kicker { display: inline-flex; align-items: center; gap: 0.75rem; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); }
        .berea-dash { width: 30px; height: 1px; background: var(--muted); }
        .berea-begin { flex: 1 1 280px; min-width: 0; max-width: 360px; display: grid; gap: 0.6rem; }
        .berea-begin input { padding: 0.8rem 1.1rem; border-radius: 999px; font-size: 0.95rem; }
        .berea-lib-main { flex: 999 1 500px; min-width: 0; display: grid; gap: 2rem; align-content: start; }
        .berea-lib-rail { flex: 1 1 260px; min-width: 0; display: grid; gap: 0; align-content: start; }
        .berea-lib-rail > .eyebrow { padding-bottom: 0.7rem; border-bottom: 1px solid var(--line); }
        .berea-stage-line { display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--line); }
        .berea-numeral { min-width: 2rem; font-family: var(--font-serif); font-size: 1.5rem; color: var(--vermilion); }
        .berea-table { display: grid; overflow-x: auto; }
        .berea-row {
          display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 2fr) auto minmax(90px, 1fr);
          gap: 1rem; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--line); color: inherit; min-width: 560px;
        }
        a.berea-row:hover .berea-row-ref { color: var(--accent); }
        .berea-row-head { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); padding-top: 0; }
        .berea-row-ref { font-family: var(--font-serif); font-size: 1.22rem; }
        .berea-row-from { font-family: var(--font-serif); font-style: italic; color: var(--muted-strong); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .berea-row-date { text-align: right; font-size: 0.82rem; color: var(--muted); }
        .berea-progress { display: inline-flex; gap: 0.3rem; }
        .berea-progress span {
          min-width: 1.6rem; text-align: center; padding: 0.15rem 0.45rem; border-radius: 999px; font-size: 0.68rem; font-weight: 700;
          border: 1px solid var(--line-strong); color: var(--muted);
        }
        .berea-progress span.is-done { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
        .berea-suggest { display: grid; gap: 0.8rem; }
        .berea-suggest-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: 0.7rem; }
        .berea-suggest-card {
          display: flex; align-items: center; gap: 0.8rem; padding: 0.85rem 1rem; border-radius: var(--radius-md);
          background: var(--accent-soft); border: 1px solid var(--accent-line); color: var(--accent-strong);
        }
        .berea-suggest-card strong { font-size: 0.92rem; }
        .berea-suggest-card span span { font-size: 0.8rem; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .berea-suggest-go { font-size: 0.82rem; font-weight: 700; }
      `}</style>
    </div>
  );
}
