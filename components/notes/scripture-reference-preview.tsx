'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  fetchScriptureByReference,
  formatScriptureTextForInsertion,
  type ScriptureResult,
} from '@/lib/scripture';

const TRANSLATION_LABELS: Record<string, string> = {
  KJV: 'King James Version',
  WEB: 'World English Bible',
  'OEB-US': 'Open English Bible (US)',
  NIV: 'New International Version',
  ESV: 'English Standard Version',
  NLT: 'New Living Translation',
};

export function ScriptureReferencePreview({
  reference,
  onClose,
  onInsert,
}: {
  reference: string | null;
  onClose: () => void;
  onInsert?: (payload: string) => void;
}) {
  const [result, setResult] = useState<ScriptureResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translation, setTranslation] = useState('KJV');

  const translationOptions = useMemo(
    () => ['KJV', 'WEB', 'OEB-US', 'NIV', 'ESV', 'NLT'],
    []
  );

  useEffect(() => {
    if (translationOptions.includes(translation)) {
      return;
    }

    setTranslation('KJV');
  }, [translation, translationOptions]);

  useEffect(() => {
    if (!reference) {
      return;
    }

    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setResult(null);
        const next = await fetchScriptureByReference(reference, translation);
        if (!active) return;
        setResult(next);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load scripture preview.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [reference, translation]);

  if (!reference) {
    return null;
  }

  const insertResult = () => {
    if (!result || !onInsert) {
      return;
    }

    onInsert(formatScriptureTextForInsertion(result));
  };

  return (
    <section
      className="scripture-preview-panel"
      aria-live="polite"
      style={{
        padding: '2.4rem 2.2rem 2.6rem',
        borderRadius: '32px',
        background: 'rgba(25, 28, 35, 0.2)',
        gap: '1.35rem',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
        <div className="support-block" style={{ gap: '0.3rem' }}>
          <span className="eyebrow" style={{ color: 'var(--accent)', opacity: 0.72 }}>Scripture reference</span>
          <strong className="support-block-title" style={{ fontSize: '2rem', lineHeight: 1.02, fontWeight: 600 }}>{reference}</strong>
        </div>
        <button className="button button-ghost" onClick={onClose} type="button" style={{ paddingInline: '0.2rem', minHeight: 'auto' }}>
          Close
        </button>
        {/* "Insert into note" button moved here and made subtle, as it's not explicitly in PNG */}
        {onInsert ? (
          <button className="button button-ghost" onClick={insertResult} type="button" style={{ paddingInline: '0.2rem', minHeight: 'auto', opacity: 0.6 }}>
            Insert
          </button>
        ) : null}
      </div>

      <label style={{ display: 'grid', gap: '0.35rem', maxWidth: '260px' }}>
          <span className="eyebrow" style={{ fontStyle: 'italic', color: 'var(--muted)' }}>Translation</span>
          <select
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
            style={{
              width: '100%',
              minHeight: '44px',
              borderRadius: 999,
              background: 'rgba(255, 248, 235, 0.04)',
              color: 'var(--text)',
              padding: '0.7rem 0.95rem',
              border: '1px solid rgba(78, 70, 58, 0.16)',
            }}
          >
            {translationOptions.map((option) => (
              <option key={option} value={option}>
                {TRANSLATION_LABELS[option] ?? option}
              </option>
            ))}
          </select>
        </label>

      {loading ? (
        <div className="loading-state status-message" role="status">
          <strong>Loading scripture…</strong>
          <span style={{ color: 'var(--muted)' }}>Fetching the reference preview.</span>
        </div>
      ) : null}

      {error ? (
        <div className="error-state status-message" role="alert">
          <strong>Unable to load scripture</strong>
          <span style={{ color: 'var(--muted)' }}>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div style={{ display: 'grid', gap: '1.15rem' }}>
          <div className="meta-row" style={{ fontSize: '0.74rem', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            <span>{TRANSLATION_LABELS[translation] ?? translation}</span>
          </div>
          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.7,
              fontSize: '1.05rem',
              fontStyle: 'italic', // Matches PNG
              color: 'rgba(220, 223, 229, 0.84)',
            }}
          >
            {result.text}
          </div>
          {/* "View Full Chapter" button added to match PNG */}
          <div className="cta-row" style={{ justifyContent: 'flex-start' }}>
            <Link href={`/scriptures/${reference}`} className="button button-primary" style={{ padding: '0.7rem 1.2rem' }}>
              View Full Chapter →
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
