'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNote, NOTE_TYPES, updateNote, type NoteInput, type NoteRecord } from '@/lib/notes';
import { DEFAULT_NOTE_TYPE } from '@/components/notes/note-utils';
import { ScriptureSearchPanel } from '@/components/notes/scripture-search-panel';

type NoteFormProps = {
  mode: 'create' | 'edit';
  note?: NoteRecord | null;
};

type DraftState = NoteInput;

function getDraftStorageKey(mode: 'create' | 'edit', noteId?: string) {
  return mode === 'create' ? 'gospelpad-web-note-draft:new' : `gospelpad-web-note-draft:${noteId ?? 'unknown'}`;
}

export function NoteForm({ mode, note }: NoteFormProps) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const initialState = useMemo<DraftState>(
    () => ({
      title: note?.title ?? '',
      body: note?.body ?? '',
      speaker: note?.speaker ?? '',
      type: NOTE_TYPES.includes((note?.type ?? '') as (typeof NOTE_TYPES)[number])
        ? (note?.type as (typeof NOTE_TYPES)[number])
        : DEFAULT_NOTE_TYPE,
    }),
    [note]
  );

  const [form, setForm] = useState<DraftState>(initialState);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  const draftKey = getDraftStorageKey(mode, note?.id);

  useEffect(() => {
    setForm(initialState);
  }, [initialState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DraftState>;
        setForm({
          title: typeof parsed.title === 'string' ? parsed.title : initialState.title,
          body: typeof parsed.body === 'string' ? parsed.body : initialState.body,
          speaker: typeof parsed.speaker === 'string' ? parsed.speaker : initialState.speaker,
          type: NOTE_TYPES.includes((parsed.type ?? '') as (typeof NOTE_TYPES)[number])
            ? (parsed.type as (typeof NOTE_TYPES)[number])
            : initialState.type,
        });
        setDraftNotice('Recovered a saved local draft for this form.');
      }
    } catch {
      setDraftNotice(null);
    } finally {
      setLoadingDraft(false);
    }
  }, [draftKey, initialState]);

  useEffect(() => {
    if (typeof window === 'undefined' || loadingDraft) return;

    window.localStorage.setItem(draftKey, JSON.stringify(form));
  }, [draftKey, form, loadingDraft]);

  const onChange = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftKey);
    }
    setDraftNotice('Local draft cleared.');
    setForm(initialState);
  };

  const insertScripture = (payload: string) => {
    const textarea = bodyRef.current;

    if (!textarea) {
      setForm((current) => ({
        ...current,
        body: current.body ? `${current.body.trimEnd()}\n\n${payload}` : payload,
      }));
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = form.body.slice(0, start);
    const after = form.body.slice(end);
    const separatorBefore = before && !before.endsWith('\n') ? '\n\n' : '';
    const separatorAfter = after && !after.startsWith('\n') ? '\n\n' : '';
    const nextBody = `${before}${separatorBefore}${payload}${separatorAfter}${after}`.trim();

    setForm((current) => ({
      ...current,
      body: nextBody,
    }));

    requestAnimationFrame(() => {
      const cursorTarget = before.length + separatorBefore.length + payload.length;
      textarea.focus();
      textarea.setSelectionRange(cursorTarget, cursorTarget);
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      if (mode === 'create') {
        const noteId = await createNote(form);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(draftKey);
        }
        router.replace(`/notes/${noteId}?created=1`);
        return;
      }

      if (!note?.id) {
        throw new Error('This note could not be loaded for editing.');
      }

      await updateNote(note.id, form);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey);
      }
      router.replace(`/notes/${note.id}?updated=1`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save note.');
      setPending(false);
      return;
    }
  };

  return (
    <div className="page-section">
      <header className="page-header">
        <span className="eyebrow">{mode === 'create' ? 'Create note' : 'Edit note'}</span>
        <h1>
          {mode === 'create' ? 'Capture a new note' : 'Update your note'}
        </h1>
        <p className="page-description">
          V1 uses a clean plain-text note editor with local draft recovery. Rich formatting and media workflows stay deferred.
        </p>
      </header>

      {loadingDraft ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading draft…</strong>
          <span style={{ color: 'var(--muted)' }}>Checking for a locally saved draft in this browser.</span>
        </section>
      ) : null}

      {draftNotice ? <section className="empty-state status-message" role="status">{draftNotice}</section> : null}
      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}

      {!loadingDraft ? (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <section
            className="panel"
            style={{
              padding: '1rem',
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Title</span>
              <input
                value={form.title}
                onChange={(event) => onChange('title', event.target.value)}
                placeholder="Sunday service notes"
                required
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Speaker</span>
              <input
                value={form.speaker}
                onChange={(event) => onChange('speaker', event.target.value)}
                placeholder="Pastor, teacher, or source"
                style={inputStyle}
              />
            </label>
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Type</span>
              <select
                value={form.type}
                onChange={(event) => onChange('type', event.target.value as NoteInput['type'])}
                style={inputStyle}
              >
                {NOTE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            <ScriptureSearchPanel onInsert={insertScripture} />
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Body</span>
              <textarea
                ref={bodyRef}
                value={form.body}
                onChange={(event) => onChange('body', event.target.value)}
                placeholder="Write your note here..."
                rows={18}
                style={textareaStyle}
              />
            </label>
          </section>

          <div className="cta-row">
            <button className="button button-primary" disabled={pending} type="submit">
              {pending ? (mode === 'create' ? 'Saving…' : 'Updating…') : mode === 'create' ? 'Save note' : 'Update note'}
            </button>
            <button className="button button-ghost" onClick={clearDraft} type="button">
              Clear local draft
            </button>
            <Link className="button button-secondary" href={mode === 'create' ? '/notes' : `/notes/${note?.id}`}>
              Cancel
            </Link>
          </div>
        </form>
      ) : null}
    </div>
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

const textareaStyle: CSSProperties = {
  minHeight: 320,
  borderRadius: 16,
  border: '1px solid var(--line)',
  padding: '1rem',
  background: 'rgba(255,255,255,0.72)',
  color: 'var(--text)',
  resize: 'vertical',
  lineHeight: 1.7,
};
