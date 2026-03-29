'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMyEntitlements, type EntitlementSummary } from '@/lib/entitlements';
import { fetchScriptureByReference, formatScriptureForInsertion, type ScriptureResult } from '@/lib/scripture';

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
  const [entitlements, setEntitlements] = useState<EntitlementSummary | null>(null);

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

    onInsert(formatScriptureForInsertion(result));
  };

  return (
    <section
      className="panel"
      style={{
        padding: '1rem',
        display: 'grid',
        gap: '0.85rem',
        borderColor: 'rgba(154, 106, 27, 0.2)',
        background: 'var(--panel-strong)',
      }}
      aria-live="polite"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <span className="eyebrow">Scripture preview</span>
          <strong style={{ fontSize: '1.05rem' }}>{reference}</strong>
        </div>
        <button className="button button-ghost" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span className="eyebrow">Translation</span>
        <select
          value={translation}
          onChange={(event) => setTranslation(event.target.value)}
          style={{
            width: 'min(280px, 100%)',
            minHeight: '44px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'var(--field-bg)',
            color: 'var(--text)',
            padding: '0.75rem 1rem',
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
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            <span className="badge">{TRANSLATION_LABELS[result.translation] ?? result.translation}</span>
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
          {onInsert ? (
            <div className="cta-row">
              <button className="button button-primary" onClick={insertResult} type="button">
                Insert into note
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
