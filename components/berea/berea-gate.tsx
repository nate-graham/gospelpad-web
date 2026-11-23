'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { getMyEntitlements } from '@/lib/entitlements';

const STAGES = [
  { numeral: 'I', name: 'Observe', copy: 'What does it say? Who, what, where, and which words repeat.' },
  { numeral: 'II', name: 'Interpret', copy: 'What does it mean? Weigh it against the rest of Scripture.' },
  { numeral: 'III', name: 'Apply', copy: 'What must change in me? End with a prayer you can keep.' },
];

/** Berea is part of the paid plans: free accounts see what it is and how to get it. */
export function BereaGate({ children, noteId }: { children: ReactNode; noteId?: string }) {
  const [state, setState] = useState<'loading' | 'paid' | 'free'>('loading');

  useEffect(() => {
    let active = true;
    getMyEntitlements()
      .then((entitlements) => active && setState(entitlements.planCode && entitlements.planCode !== 'free' ? 'paid' : 'free'))
      // If the plan can't be checked, don't lock a paying member out.
      .catch(() => active && setState('paid'));
    return () => {
      active = false;
    };
  }, []);

  if (state === 'loading') {
    return (
      <section className="loading-state status-message" role="status" aria-live="polite">
        <strong>Opening Berea…</strong>
      </section>
    );
  }

  if (state === 'paid') return <>{children}</>;

  return (
    <div className="page-container page-section berea-gate">
      <header className="berea-gate-header">
        <span className="eyebrow" style={{ color: 'var(--accent)' }}>
          Berea <span className="berea-gate-rule" aria-hidden="true" /> Inductive study
        </span>
        <h1>
          Examine the <em>Scriptures.</em>
        </h1>
        <p className="berea-gate-quote">
          “…they received the word with all readiness of mind, and searched the scriptures daily, whether those things were so.”
          <span>Acts 17 : 11 · KJV</span>
        </p>
      </header>

      <section className="berea-gate-card">
        <span className="plan-option-flag">Premium, Team and Ministry</span>
        <h2>Berea is part of the paid plans.</h2>
        <p>
          Take any verse from your notes and study it in three stages, with the passage beside you and related Scripture to weigh
          it against. Each study is saved in your notebook.
        </p>
        <ol className="berea-gate-stages">
          {STAGES.map((stage) => (
            <li key={stage.name}>
              <span className="berea-gate-numeral">{stage.numeral}</span>
              <span>
                <strong>{stage.name}</strong>
                <small>{stage.copy}</small>
              </span>
            </li>
          ))}
        </ol>
        <div className="berea-gate-actions">
          <Link className="button button-primary" href="/pricing">
            See plans
          </Link>
          {noteId ? (
            <Link className="button button-secondary" href={`/notes/${noteId}`}>
              Open this study as a note
            </Link>
          ) : (
            <Link className="button button-secondary" href="/notes">
              Back to notebook
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
