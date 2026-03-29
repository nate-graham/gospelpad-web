'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNote, NOTE_TYPES, updateNote, type NoteInput, type NoteRecord } from '@/lib/notes';
import { upsertPrayerRequest, type PrayerRequestStatus } from '@/lib/prayer-requests';
import { createRecordingSignedUrl, formatTranscriptText, transcribeRecording } from '@/lib/transcription';
import {
  DEFAULT_NOTE_TYPE,
  getScriptureReferenceCount,
  getNoteTypePlaceholders,
  getNoteWordCount,
  supportsSpeakerField,
} from '@/components/notes/note-utils';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';
import { insertTextIntoEditable, ScriptureEditableField } from '@/components/notes/scripture-editable-field';
import { NoteClipsList } from '@/components/notes/note-clips-list';
import { findScriptureReferences } from '@/lib/scripture-references';
import { ScriptureSearchPanel } from '@/components/notes/scripture-search-panel';
import { getMyEntitlements } from '@/lib/entitlements';

type NoteFormProps = {
  mode: 'create' | 'edit';
  note?: NoteRecord | null;
  onSaveOverride?: (payload: NoteInput) => Promise<string | void>;
  cancelHref?: string;
  editEyebrow?: string;
  editTitle?: string;
  editDescription?: string;
};

type DraftState = NoteInput;
type NoteClip = NonNullable<NoteRecord['clips']>[number];

function getDraftStorageKey(mode: 'create' | 'edit', noteId?: string) {
  return mode === 'create' ? 'gospelpad-web-note-draft:new' : `gospelpad-web-note-draft:${noteId ?? 'unknown'}`;
}

export function NoteForm({
  mode,
  note,
  onSaveOverride,
  cancelHref,
  editEyebrow,
  editTitle,
  editDescription,
}: NoteFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const initialState = useMemo<DraftState>(
    () => ({
      title: note?.title ?? '',
      body: note?.body ?? '',
      speaker: note?.speaker ?? '',
      clips: note?.clips ?? undefined,
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
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);

  const draftKey = getDraftStorageKey(mode, note?.id);
  const handoffMessage = useMemo(() => {
    if (mode !== 'edit') return null;
    if (searchParams.get('dictated') === '1') {
      return 'Transcription imported. Review the note, make any edits you want, then save to finalize it.';
    }
    if (searchParams.get('copied') === '1') {
      const source = searchParams.get('from');
      if (source === 'group-share') {
        return 'This note was copied from a group note or shared group surface. Edit it here to make it your own.';
      }
      if (source === 'direct-share') {
        return 'This note was copied from a note shared directly with you. Edit it here to keep your own version.';
      }
      if (source === 'personal-note') {
        return 'This note was duplicated from one of your existing notes. Edit it here before saving your new version.';
      }
      return 'This note was copied into your personal library. Edit it here before saving.';
    }
    return null;
  }, [mode, searchParams]);

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
          clips:
            Array.isArray(parsed.clips)
              ? parsed.clips
              : initialState.clips,
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
    let active = true;

    const loadEntitlements = async () => {
      try {
        const next = await getMyEntitlements();
        if (!active) return;
        setTranscriptionEnabled(Boolean(next.transcriptionEnabled));
      } catch {
        if (!active) return;
        setTranscriptionEnabled(false);
      }
    };

    void loadEntitlements();

    return () => {
      active = false;
    };
  }, []);

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

  const transcribeSavedClip = async (clip: NoteClip) => {
    if (!transcriptionEnabled) {
      throw new Error('Dictation and transcription are available on Premium, Team, and Ministry.');
    }

    const clipUrl = /^https?:\/\//i.test(clip.uri) ? clip.uri : await createRecordingSignedUrl(clip.uri);
    const result = await transcribeRecording(clipUrl, clip.uri);
    const transcript = formatTranscriptText(result.text?.trim() || '');

    if (!transcript) {
      throw new Error('No transcription text was returned for this clip.');
    }

    setForm((current) => ({
      ...current,
      body: current.body.trim() ? `${current.body.trimEnd()}\n\n${transcript}` : transcript,
    }));
    setDraftNotice(`Transcription added from ${clip.name || 'audio clip'}. Review the text, then save the note.`);
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

      if (onSaveOverride) {
        const redirectTo = await onSaveOverride(payload);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(draftKey);
        }
        router.replace(redirectTo ?? `/notes/${note.id}?updated=1`);
        return;
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
        <span className="eyebrow">{mode === 'create' ? 'Create note' : editEyebrow ?? 'Edit note'}</span>
        <h1>
          {mode === 'create' ? 'Capture a new note' : editTitle ?? 'Update your note'}
        </h1>
        <p className="page-description">
          {mode === 'create'
            ? 'This composer keeps the current scripture-aware editor and local draft recovery while now surfacing the most important structured fields already used by the mobile product.'
            : editDescription ?? 'This composer keeps the current scripture-aware editor and local draft recovery while now surfacing the most important structured fields already used by the mobile product.'}
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
      {handoffMessage ? <section className="empty-state status-message" role="status">{handoffMessage}</section> : null}
      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}

      <details className="panel" style={{ padding: '0.9rem 1rem' }}>
        <summary style={detailsSummaryStyle}>
          <span>Scripture search</span>
          <span style={detailsMetaStyle}>Reference, phrase, or keyword</span>
        </summary>
        <div style={{ marginTop: '0.85rem' }}>
          <ScriptureSearchPanel compact onInsert={insertScripture} />
        </div>
      </details>

      {note?.clips?.length ? (
        <NoteClipsList
          clips={note.clips}
          title="Attached audio"
          description="This note includes saved audio from dictation or upload."
          onTranscribeClip={transcriptionEnabled ? transcribeSavedClip : undefined}
          paywallMessage={!transcriptionEnabled ? 'Upgrade to Premium, Team, or Ministry to transcribe saved clips.' : undefined}
        />
      ) : null}

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
                  Keep the request connected to its note so you can update it as you pray and revisit it later.
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
                <strong style={{ fontSize: '1.05rem' }}>Coming later</strong>
                <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                  Prayer reminders are not available in the web app yet.
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
                  This note type does not use a separate speaker field.
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
            <Link className="button button-secondary" href={cancelHref ?? (mode === 'create' ? '/notes' : `/notes/${note?.id}`)}>
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
  background: 'var(--field-bg)',
  color: 'var(--text)',
};

const detailsSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  fontWeight: 700,
  color: 'var(--text)',
  listStyle: 'none',
  display: 'grid',
  gap: '0.2rem',
};

const detailsMetaStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.92rem',
  fontWeight: 500,
};

function formatEditorTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeStyle: 'short',
  }).format(new Date(value));
}
