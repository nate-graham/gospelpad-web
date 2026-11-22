'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createNote, getNoteById } from '@/lib/notes';
import { fetchScriptureByReference } from '@/lib/scripture';
import { upsertPrayerRequest } from '@/lib/prayer-requests';
import { findScriptureReferences } from '@/lib/scripture-references';
import {
  BEREA_STAGES,
  bereaHrefForReference,
  createBereaStudy,
  emptyBereaStudy,
  getBereaProgress,
  parseBereaStudy,
  saveBereaStudy,
  type BereaStage,
  type BereaStudy,
} from '@/lib/berea';

const TRANSLATIONS = ['KJV', 'WEB', 'OEB-US'];

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function BereaStudyView({
  noteId: initialNoteId,
  initialReference,
  fromNoteId,
}: {
  noteId?: string;
  initialReference?: string;
  fromNoteId?: string;
}) {
  const router = useRouter();
  const [noteId, setNoteId] = useState<string | null>(initialNoteId ?? null);
  const [study, setStudy] = useState<BereaStudy>(() => emptyBereaStudy(initialReference ?? ''));
  const [loading, setLoading] = useState(Boolean(initialNoteId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<BereaStage>('observe');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [passageState, setPassageState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [relatedInput, setRelatedInput] = useState('');
  const [relatedText, setRelatedText] = useState<Record<string, { loading: boolean; text?: string; error?: string }>>({});
  const [prayerState, setPrayerState] = useState<{ saving: boolean; message: string | null }>({ saving: false, message: null });
  const creatingRef = useRef(false);
  const autoLoadedRef = useRef(false);

  const update = useCallback((patch: Partial<BereaStudy>) => {
    setStudy((current) => ({ ...current, ...patch }));
    setSaveState('dirty');
  }, []);

  const loadPassage = useCallback(
    async (reference: string, translation: string) => {
      const trimmed = reference.trim();
      if (!trimmed) {
        setPassageState({ loading: false, error: 'Enter a passage reference first, for example John 3:16-17.' });
        return;
      }
      setPassageState({ loading: true, error: null });
      try {
        const result = await fetchScriptureByReference(trimmed, translation);
        setStudy((current) => ({
          ...current,
          reference: current.reference.trim() ? current.reference : result.reference,
          passage: result.text.trim(),
          translation: result.translation || translation,
        }));
        setSaveState('dirty');
        setPassageState({ loading: false, error: null });
      } catch (error) {
        setPassageState({
          loading: false,
          error: error instanceof Error ? error.message : 'That passage could not be loaded. Paste it from your Bible instead.',
        });
      }
    },
    []
  );

  // Load an existing study, or set up a new one from a reference and source note.
  useEffect(() => {
    let active = true;

    if (initialNoteId) {
      getNoteById(initialNoteId)
        .then((note) => {
          if (!active) return;
          if (!note) {
            setLoadError('This study could not be found. It may have been deleted.');
          } else {
            setStudy(parseBereaStudy(note));
          }
          setLoading(false);
        })
        .catch((error) => {
          if (!active) return;
          setLoadError(error instanceof Error ? error.message : 'This study could not be loaded.');
          setLoading(false);
        });
      return () => {
        active = false;
      };
    }

    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;

    if (initialReference) {
      void loadPassage(initialReference, 'KJV');
    }

    if (fromNoteId) {
      getNoteById(fromNoteId)
        .then((note) => {
          if (!active || !note) return;
          const related = findScriptureReferences(note.body ?? '')
            .filter((reference) => reference.toLowerCase() !== (initialReference ?? '').toLowerCase())
            .slice(0, 6);
          setStudy((current) => ({
            ...current,
            sourceNoteId: note.id,
            sourceTitle: note.title || 'Untitled note',
            related: current.related.length ? current.related : related,
          }));
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
    };
  }, [fromNoteId, initialNoteId, initialReference, loadPassage]);

  const save = useCallback(async () => {
    setSaveError(null);
    setSaveState('saving');
    try {
      if (noteId) {
        await saveBereaStudy(noteId, study);
      } else {
        if (creatingRef.current) return;
        creatingRef.current = true;
        const id = await createBereaStudy(study);
        setNoteId(id);
        router.replace(`/berea/${id}`);
      }
      setSaveState('saved');
    } catch (error) {
      creatingRef.current = false;
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : 'The study could not be saved. Try again.');
    }
  }, [noteId, router, study]);

  // Autosave once the study exists.
  useEffect(() => {
    if (!noteId || saveState !== 'dirty') return;
    const timer = setTimeout(() => {
      void save();
    }, 1400);
    return () => clearTimeout(timer);
  }, [noteId, save, saveState, study]);

  const addRelated = (event: FormEvent) => {
    event.preventDefault();
    const value = relatedInput.trim();
    if (!value) return;
    if (!study.related.some((item) => item.toLowerCase() === value.toLowerCase())) {
      update({ related: [...study.related, value] });
    }
    setRelatedInput('');
  };

  const toggleRelated = async (reference: string) => {
    if (relatedText[reference]?.text || relatedText[reference]?.error) {
      setRelatedText((current) => {
        const next = { ...current };
        delete next[reference];
        return next;
      });
      return;
    }
    setRelatedText((current) => ({ ...current, [reference]: { loading: true } }));
    try {
      const result = await fetchScriptureByReference(reference, study.translation || 'KJV');
      setRelatedText((current) => ({ ...current, [reference]: { loading: false, text: result.text } }));
    } catch (error) {
      setRelatedText((current) => ({
        ...current,
        [reference]: { loading: false, error: error instanceof Error ? error.message : 'Could not load this passage.' },
      }));
    }
  };

  const addPrayerRequest = async () => {
    if (!study.prayer.trim()) return;
    setPrayerState({ saving: true, message: null });
    try {
      const title = `Prayer · ${study.reference || 'Berea study'}`;
      const body = study.prayer.trim();
      const prayerRequestId = await upsertPrayerRequest({
        title,
        body,
        status: 'Ongoing',
        groupId: null,
        shared: false,
        accepted: false,
      });
      await createNote({
        title,
        body,
        speaker: '',
        type: 'Prayer Requests',
        prayerStatus: 'Ongoing',
        prayerRequestId,
      });
      setPrayerState({ saving: false, message: 'Added to your prayer requests as ongoing.' });
    } catch (error) {
      setPrayerState({ saving: false, message: error instanceof Error ? error.message : 'Could not add the prayer request.' });
    }
  };

  if (loading) {
    return <div className="loading-state">Opening your study…</div>;
  }

  if (loadError) {
    return (
      <div className="error-state status-message" role="alert">
        <strong>Study unavailable</strong>
        <span style={{ color: 'var(--muted)' }}>{loadError}</span>
        <div className="cta-row">
          <Link className="button button-secondary" href="/berea">
            Back to Berea
          </Link>
        </div>
      </div>
    );
  }

  const progress = getBereaProgress(study);
  const stageIndex = BEREA_STAGES.findIndex((item) => item.key === stage);
  const activeStage = BEREA_STAGES[stageIndex];
  const nextStage = BEREA_STAGES[stageIndex + 1];

  const statusLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : saveState === 'dirty'
          ? noteId
            ? 'Unsaved changes'
            : 'Not saved yet'
          : saveState === 'error'
            ? 'Not saved'
            : noteId
              ? 'Saved'
              : 'Not saved yet';

  return (
    <div className="berea-study">
      <div className="berea-toolbar">
        <Link className="berea-back" href="/berea">
          <svg width="7" height="12" viewBox="0 0 11 18" fill="none" aria-hidden="true">
            <path d="M9 1L1 9l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Berea studies
        </Link>
        {study.sourceNoteId ? (
          <Link className="verse-chip" href={`/notes/${study.sourceNoteId}`}>
            <span className="pilcrow" aria-hidden="true">
              ¶
            </span>
            From “{study.sourceTitle ?? 'a note'}”
          </Link>
        ) : null}
        <span className="berea-status" role="status">
          {statusLabel}
        </span>
        <button className="button button-primary" disabled={saveState === 'saving'} onClick={() => void save()} type="button">
          {noteId ? 'Save' : 'Save study'}
        </button>
      </div>

      {saveError ? (
        <div className="error-state status-message" role="alert">
          <strong>Study not saved</strong>
          <span style={{ color: 'var(--muted)' }}>{saveError}</span>
        </div>
      ) : null}

      <ol className="berea-stepper" aria-label="Stages">
        {BEREA_STAGES.map((item) => {
          const done = progress[item.key];
          const current = item.key === stage;
          return (
            <li key={item.key}>
              <button
                aria-current={current ? 'step' : undefined}
                className={`berea-step${current ? ' is-current' : ''}${done ? ' is-done' : ''}`}
                onClick={() => setStage(item.key)}
                type="button"
              >
                <span className="berea-step-bar" aria-hidden="true" />
                <span>
                  {item.numeral} · {item.title}
                  {done ? ' · done' : current ? ' · now' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="berea-columns">
        {/* Passage */}
        <article aria-label="The passage" className="berea-passage">
          <div className="berea-ref-row">
            <label className="sr-only" htmlFor="berea-ref">
              Passage reference
            </label>
            <input
              className="berea-ref-input"
              id="berea-ref"
              onChange={(event) => update({ reference: event.target.value })}
              placeholder="Passage — e.g. Philippians 4:4-7"
              value={study.reference}
            />
            <label className="sr-only" htmlFor="berea-translation">
              Translation
            </label>
            <select
              id="berea-translation"
              onChange={(event) => update({ translation: event.target.value })}
              value={study.translation}
            >
              {TRANSLATIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="berea-rule" aria-hidden="true" />

          {study.passage ? (
            <div className="berea-passage-text">{study.passage}</div>
          ) : (
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>
              Load the passage from Scripture, or paste it from your own Bible below.
            </p>
          )}

          <div className="cta-row" style={{ alignItems: 'center' }}>
            <button
              className="button button-secondary"
              disabled={passageState.loading}
              onClick={() => void loadPassage(study.reference, study.translation)}
              type="button"
            >
              {passageState.loading ? 'Loading passage…' : study.passage ? 'Reload passage' : 'Load passage'}
            </button>
          </div>
          {passageState.error ? (
            <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: '0.9rem' }}>
              {passageState.error}
            </p>
          ) : null}

          <details className="berea-edit-passage">
            <summary>Edit the passage text</summary>
            <label className="sr-only" htmlFor="berea-passage">
              Passage text
            </label>
            <textarea
              id="berea-passage"
              onChange={(event) => update({ passage: event.target.value })}
              rows={6}
              value={study.passage}
            />
          </details>

          {/* Related Scripture */}
          <section aria-label="Related Scripture" className="berea-related">
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>
              Related Scripture
            </span>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.55, fontStyle: 'italic' }} className="serif">
              Passages to read alongside this one. Weigh each against the text.
            </p>
            {study.related.length ? (
              <ul className="berea-related-list">
                {study.related.map((reference) => {
                  const state = relatedText[reference];
                  return (
                    <li key={reference}>
                      <div className="berea-related-row">
                        <button className="berea-related-ref" onClick={() => void toggleRelated(reference)} type="button">
                          {reference}
                        </button>
                        <Link className="berea-related-action" href={bereaHrefForReference(reference)}>
                          Study
                        </Link>
                        <button
                          aria-label={`Remove ${reference}`}
                          className="berea-related-action"
                          onClick={() => update({ related: study.related.filter((item) => item !== reference) })}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      {state?.loading ? <span className="berea-related-text">Loading…</span> : null}
                      {state?.text ? <span className="berea-related-text">{state.text}</span> : null}
                      {state?.error ? (
                        <span className="berea-related-text" style={{ color: 'var(--danger)' }}>
                          {state.error}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <form className="berea-related-add" onSubmit={addRelated}>
              <label className="sr-only" htmlFor="berea-related-input">
                Add a related reference
              </label>
              <input
                id="berea-related-input"
                onChange={(event) => setRelatedInput(event.target.value)}
                placeholder="Add a reference, e.g. Isaiah 26:3"
                value={relatedInput}
              />
              <button className="button button-secondary" type="submit">
                Add
              </button>
            </form>
          </section>
        </article>

        {/* Workbook */}
        <section aria-labelledby="berea-stage-title" className="berea-workbook">
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <span className="eyebrow" style={{ color: 'var(--vermilion)' }}>
              {activeStage.numeral} · {activeStage.title}
            </span>
            <h2 id="berea-stage-title" className="berea-question">
              {activeStage.question.replace(/\?$/, '')}
              <em>?</em>
            </h2>
            <span className="rule-vermilion" aria-hidden="true" />
          </div>

          <ul className="berea-prompts">
            {activeStage.prompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>

          <label className="eyebrow" htmlFor={`berea-${activeStage.key}`}>
            Your {activeStage.title.toLowerCase()}
          </label>
          <textarea
            className="berea-answer"
            id={`berea-${activeStage.key}`}
            onChange={(event) => update({ [activeStage.key]: event.target.value } as Partial<BereaStudy>)}
            placeholder={activeStage.placeholder}
            rows={8}
            value={study[activeStage.key]}
          />

          {activeStage.key === 'apply' ? (
            <div className="berea-prayer">
              <label className="eyebrow" htmlFor="berea-prayer" style={{ color: 'var(--vermilion)' }}>
                Pray it
              </label>
              <textarea
                id="berea-prayer"
                onChange={(event) => update({ prayer: event.target.value })}
                placeholder="Turn your response into a prayer…"
                rows={4}
                value={study.prayer}
              />
              <div className="cta-row" style={{ alignItems: 'center' }}>
                <button
                  className="button button-vermilion"
                  disabled={!study.prayer.trim() || prayerState.saving}
                  onClick={() => void addPrayerRequest()}
                  type="button"
                >
                  {prayerState.saving ? 'Adding…' : 'Add to prayer requests'}
                </button>
                {prayerState.message ? (
                  <span role="status" style={{ fontSize: '0.88rem', color: 'var(--muted-strong)' }}>
                    {prayerState.message}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="berea-workbook-foot">
            {nextStage ? (
              <>
                <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Next: {nextStage.question.toLowerCase()}</span>
                <button className="button button-primary" onClick={() => setStage(nextStage.key)} type="button">
                  Continue to {nextStage.title} →
                </button>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                  {progress.observe && progress.interpret && progress.apply
                    ? 'All three stages are written. Well done.'
                    : 'Fill in each stage when you’re ready. Your study saves as you write.'}
                </span>
                <button className="button button-primary" disabled={saveState === 'saving'} onClick={() => void save()} type="button">
                  Finish study
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      <style>{`
        .berea-study { display: grid; gap: 1.6rem; }
        .berea-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.8rem 1rem; }
        .berea-back { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
        .berea-back:hover { color: var(--accent); }
        .berea-status { margin-left: auto; font-size: 0.82rem; color: var(--muted); }
        .berea-stepper { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
        .berea-step {
          width: 100%; display: grid; gap: 0.55rem; padding: 0; border: 0; background: none; text-align: left;
          font-size: 0.74rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
        }
        .berea-step-bar { height: 3px; border-radius: 2px; background: var(--line); }
        .berea-step.is-done { color: var(--accent); }
        .berea-step.is-done .berea-step-bar { background: var(--accent); }
        .berea-step.is-current { color: var(--vermilion); }
        .berea-step.is-current .berea-step-bar { background: var(--vermilion); }
        .berea-columns { display: flex; flex-wrap: wrap; gap: 2.4rem; align-items: flex-start; }
        .berea-passage { flex: 1 1 400px; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; }
        .berea-ref-row { display: flex; gap: 0.6rem; align-items: center; }
        .berea-ref-input {
          flex: 1; min-width: 0; border: 0; border-radius: 0; background: transparent; padding: 0;
          font-family: var(--font-serif); font-size: clamp(1.7rem, 3vw, 2.4rem); font-weight: 500; color: var(--accent-strong);
        }
        .berea-ref-input:focus { outline: none; box-shadow: 0 2px 0 var(--accent); }
        .berea-ref-row select { padding: 0.45rem 0.7rem; border-radius: 999px; font-size: 0.82rem; }
        .berea-rule { height: 1px; background: var(--ink); }
        .berea-passage-text { font-family: var(--font-serif); font-size: 1.14rem; line-height: 1.75; color: var(--ink-soft); white-space: pre-wrap; }
        .berea-edit-passage summary { cursor: pointer; font-size: 0.84rem; font-weight: 600; color: var(--muted); }
        .berea-edit-passage textarea { margin-top: 0.6rem; width: 100%; box-sizing: border-box; padding: 0.9rem 1rem; font-family: var(--font-serif); font-size: 1rem; line-height: 1.6; resize: vertical; }
        .berea-related { display: grid; gap: 0.55rem; padding-top: 1rem; border-top: 1px solid var(--line); }
        .berea-related-list { list-style: none; margin: 0; padding: 0; display: grid; }
        .berea-related-list li { display: grid; gap: 0.35rem; padding: 0.6rem 0; border-bottom: 1px solid var(--line); }
        .berea-related-row { display: flex; align-items: center; gap: 0.8rem; }
        .berea-related-ref { flex: 1; text-align: left; border: 0; background: none; padding: 0; font-family: var(--font-serif); font-size: 1.05rem; color: var(--accent); }
        .berea-related-ref:hover { text-decoration: underline; }
        .berea-related-action { border: 0; background: none; padding: 0.2rem 0; font-size: 0.8rem; font-weight: 600; color: var(--muted); }
        .berea-related-action:hover { color: var(--accent); }
        .berea-related-text { font-family: var(--font-serif); font-style: italic; font-size: 0.98rem; line-height: 1.6; color: var(--ink-soft); white-space: pre-wrap; }
        .berea-related-add { display: flex; gap: 0.5rem; }
        .berea-related-add input { flex: 1; min-width: 0; padding: 0.6rem 0.95rem; border-radius: 999px; font-size: 0.9rem; }
        .berea-related-add .button { min-height: 40px; padding: 0.5rem 1rem; }
        .berea-workbook {
          flex: 999 1 440px; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.1rem; padding: clamp(1.2rem, 2.5vw, 2rem);
          border-radius: var(--radius-xl); background: var(--panel-raised); border: 1px solid var(--line); box-shadow: var(--shadow-card);
        }
        .berea-question { margin: 0; font-size: clamp(1.9rem, 3vw, 2.5rem); line-height: 1.1; }
        .berea-prompts { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 0.4rem 1.4rem; }
        .berea-prompts li { position: relative; padding-left: 1rem; font-size: 0.92rem; line-height: 1.45; color: var(--muted-strong); }
        .berea-prompts li::before { content: ''; position: absolute; left: 0; top: 0.55rem; width: 5px; height: 5px; border-radius: 50%; background: var(--line-strong); }
        .berea-answer, .berea-prayer textarea {
          width: 100%; box-sizing: border-box; resize: vertical; padding: 1rem 1.1rem; border-radius: var(--radius-md);
          font-family: var(--font-serif); font-size: 1.1rem; line-height: 1.65; background: var(--bg);
        }
        .berea-prayer { display: grid; gap: 0.6rem; padding: 1.1rem; border-radius: var(--radius-lg); background: var(--vermilion-soft); border: 1px solid color-mix(in srgb, var(--vermilion) 25%, transparent); }
        .berea-workbook-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.8rem; padding-top: 0.4rem; }
        @media (max-width: 640px) {
          .berea-stepper .berea-step { font-size: 0.64rem; letter-spacing: 0.06em; }
          .berea-status { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
