'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNote, NOTE_TYPES, updateNote, type NoteInput, type NoteRecord } from '@/lib/notes';
import { upsertPrayerRequest, type PrayerRequestStatus } from '@/lib/prayer-requests';
import {
  DEFAULT_NOTE_TYPE,
  getScriptureReferenceCount,
  getNoteTypePlaceholders,
  getNoteWordCount,
  supportsSpeakerField,
} from '@/components/notes/note-utils';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';
import { insertTextIntoEditable, ScriptureEditableField } from '@/components/notes/scripture-editable-field';
import { findScriptureReferences } from '@/lib/scripture-references';

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
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const initialState = useMemo<DraftState>(
    () => ({
      title: note?.title ?? '',
      body: note?.body ?? '',
      speaker: note?.speaker ?? '',
      type: NOTE_TYPES.includes((note?.type ?? '') as (typeof NOTE_TYPES)[number])
        ? (note?.type as (typeof NOTE_TYPES)[number])
        : DEFAULT_NOTE_TYPE,
      isLucidDream: Boolean(note?.is_lucid_dream),
      dreamRole: note?.dream_role === 'involved' ? 'involved' : 'observing',
      prayerStatus: note?.type === 'Prayer Requests' && note?.status === 'Answered' ? 'Answered' : 'Ongoing',
      prayerRequestId: note?.prayer_request_id ?? null,
    }),
    [note]
  );

  const [form, setForm] = useState<DraftState>(initialState);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

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
          isLucidDream:
            typeof parsed.isLucidDream === 'boolean' ? parsed.isLucidDream : initialState.isLucidDream,
          dreamRole:
            parsed.dreamRole === 'involved' || parsed.dreamRole === 'observing'
              ? parsed.dreamRole
              : initialState.dreamRole,
          prayerStatus:
            parsed.prayerStatus === 'Answered' || parsed.prayerStatus === 'Ongoing'
              ? parsed.prayerStatus
              : initialState.prayerStatus,
          prayerRequestId:
            typeof parsed.prayerRequestId === 'string' || parsed.prayerRequestId === null
              ? parsed.prayerRequestId
              : initialState.prayerRequestId,
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
    setLastSavedAt(new Date().toISOString());
  }, [draftKey, form, loadingDraft]);

  const detectedReferences = useMemo(() => findScriptureReferences(form.body), [form.body]);
  const wordCount = useMemo(() => getNoteWordCount({ body: form.body } as NoteRecord), [form.body]);
  const scriptureCount = useMemo(() => getScriptureReferenceCount({ body: form.body } as NoteRecord), [form.body]);
  const placeholders = useMemo(() => getNoteTypePlaceholders(form.type), [form.type]);
  const isDreamNote = form.type === 'Dream';
  const isPrayerRequest = form.type === 'Prayer Requests';
  const showSpeakerField = supportsSpeakerField(form.type);

  const onChange = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftKey);
    }
    setDraftNotice('Local draft cleared.');
    setForm(initialState);
    setLastSavedAt(null);
  };

  const insertScripture = (payload: string) => {
    const editor = bodyRef.current;

    if (!editor) {
      setForm((current) => ({
        ...current,
        body: current.body ? `${current.body.trimEnd()}\n\n${payload}` : payload,
      }));
      return;
    }

    insertTextIntoEditable(editor, form.body.trim() ? `\n\n${payload}` : payload);

    setForm((current) => ({
      ...current,
      body: editor.innerText.replace(/\u00a0/g, ' ').trimEnd(),
    }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      let nextPrayerRequestId = form.prayerRequestId ?? null;

      if (form.type === 'Prayer Requests') {
        nextPrayerRequestId = await upsertPrayerRequest({
          id: form.prayerRequestId ?? undefined,
          title: form.title,
          body: form.body,
          status: form.prayerStatus ?? 'Ongoing',
          groupId: null,
          shared: false,
          accepted: false,
        });
      }

      const payload = {
        ...form,
        prayerRequestId: nextPrayerRequestId,
      };

      if (mode === 'create') {
        const noteId = await createNote(payload);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(draftKey);
        }
        router.replace(`/notes/${noteId}?created=1`);
        return;
      }

      if (!note?.id) {
        throw new Error('This note could not be loaded for editing.');
      }

      await updateNote(note.id, payload);
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
          This composer keeps the current scripture-aware editor and local draft recovery while now surfacing the most important structured fields already used by the mobile product.
        </p>
      </header>

      <section
        className="responsive-grid compact"
        aria-label="Note editor insights"
      >
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Local draft</span>
          <strong style={{ fontSize: '1.15rem' }}>{lastSavedAt ? 'Autosaving active' : 'Waiting for changes'}</strong>
          <span style={{ color: 'var(--muted)' }}>
            {lastSavedAt ? `Last local save ${formatEditorTime(lastSavedAt)}` : 'This note will save locally as you type.'}
          </span>
        </article>
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Content length</span>
          <strong style={{ fontSize: '1.15rem' }}>{wordCount} words</strong>
          <span style={{ color: 'var(--muted)' }}>
            {scriptureCount === 0 ? 'No scripture references detected yet.' : `${scriptureCount} scripture reference${scriptureCount === 1 ? '' : 's'} detected.`}
          </span>
        </article>
      </section>

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
                placeholder={placeholders.title}
                required
                style={inputStyle}
              />
            </label>
            {showSpeakerField ? (
              <label style={fieldStyle}>
                <span className="eyebrow" style={labelTextStyle}>Speaker</span>
                <input
                  value={form.speaker}
                  onChange={(event) => onChange('speaker', event.target.value)}
                  placeholder={placeholders.speaker}
                  style={inputStyle}
                />
              </label>
            ) : null}
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

          {isDreamNote ? (
            <section
              className="panel"
              style={{
                padding: '1rem',
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <div className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
                <span className="eyebrow">Dream note</span>
                <strong style={{ fontSize: '1.05rem' }}>
                  {form.isLucidDream ? 'Lucid dream' : 'Standard dream'}
                </strong>
                <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                  Mobile already tracks whether a dream was lucid and whether you were observing or involved.
                </span>
              </div>

              <label style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
                <input
                  checked={Boolean(form.isLucidDream)}
                  onChange={(event) => onChange('isLucidDream', event.target.checked)}
                  type="checkbox"
                />
                <span style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Mark this as a lucid dream</span>
              </label>

              <label style={fieldStyle}>
                <span className="eyebrow" style={labelTextStyle}>In the dream</span>
                <select
                  value={form.dreamRole ?? 'observing'}
                  onChange={(event) => onChange('dreamRole', event.target.value as 'observing' | 'involved')}
                  style={inputStyle}
                >
                  <option value="observing">Observing</option>
                  <option value="involved">Involved</option>
                </select>
              </label>
            </section>
          ) : null}

          {isPrayerRequest ? (
            <section
              className="panel"
              style={{
                padding: '1rem',
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <div className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
                <span className="eyebrow">Prayer request</span>
                <strong style={{ fontSize: '1.05rem' }}>
                  {form.prayerStatus === 'Answered' ? 'Answered request' : 'Ongoing request'}
                </strong>
                <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                  The current mobile product tracks prayer requests as a linked note plus prayer-request record. This web pass keeps that same structure.
                </span>
              </div>

              <label style={fieldStyle}>
                <span className="eyebrow" style={labelTextStyle}>Prayer status</span>
                <select
                  value={form.prayerStatus ?? 'Ongoing'}
                  onChange={(event) => onChange('prayerStatus', event.target.value as PrayerRequestStatus)}
                  style={inputStyle}
                >
                  <option value="Ongoing">Ongoing</option>
                  <option value="Answered">Answered</option>
                </select>
              </label>

              <div className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
                <span className="eyebrow">Reminders</span>
                <strong style={{ fontSize: '1.05rem' }}>Deferred on web</strong>
                <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                  The repo already has prayer reminder tables and notification functions, but the web app does not yet have the browser notification and device-token flow needed to expose reminders honestly.
                </span>
              </div>
            </section>
          ) : null}

          <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            {!showSpeakerField ? (
              <div className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.45rem' }}>
                <span className="eyebrow">Type-specific composer</span>
                <strong style={{ fontSize: '1.05rem' }}>{form.type}</strong>
                <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                  This note type follows the mobile composer pattern and does not use the separate speaker field.
                </span>
              </div>
            ) : null}
            {detectedReferences.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.55rem' }}>
                <span className="eyebrow">Detected references in this note</span>
                <div className="cta-row">
                  {detectedReferences.map((reference) => (
                    <button
                      className="button button-secondary"
                      key={reference}
                      onClick={() => setActiveReference(reference)}
                      type="button"
                    >
                      {reference}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {activeReference ? (
              <ScriptureReferencePreview
                onInsert={insertScripture}
                onClose={() => setActiveReference(null)}
                reference={activeReference}
              />
            ) : null}
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Body</span>
              <ScriptureEditableField
                ref={bodyRef}
                value={form.body}
                onChange={(nextBody) => onChange('body', nextBody)}
                onReferenceClick={setActiveReference}
                placeholder={placeholders.body}
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

function formatEditorTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeStyle: 'short',
  }).format(new Date(value));
}
