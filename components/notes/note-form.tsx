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
  getNoteTypePlaceholders,
  supportsSpeakerField,
} from '@/components/notes/note-utils';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';
import { insertTextIntoEditable, readPlainTextFromEditor, ScriptureEditableField } from '@/components/notes/scripture-editable-field';
import { NoteClipsList } from '@/components/notes/note-clips-list';
import { findScriptureReferences } from '@/lib/scripture-references';
import { format } from 'date-fns';

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
}: NoteFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const lastDetectedReferenceRef = useRef<string | null>(null);
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
  const [activeReference, setActiveReference] = useState<string | null>(null);

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
      }
    } catch {
    } finally {
      setLoadingDraft(false);
    }
  }, [draftKey, initialState]);

  useEffect(() => {
    if (typeof window === 'undefined' || loadingDraft) return;

    window.localStorage.setItem(draftKey, JSON.stringify(form));
  }, [draftKey, form, loadingDraft]);

  const detectedReferences = useMemo(() => findScriptureReferences(form.body), [form.body]);
  const orderedDetectedReferences = useMemo(() => [...detectedReferences].reverse(), [detectedReferences]);

  useEffect(() => {
    const newestReference = orderedDetectedReferences[0] ?? null;
    const previousNewestReference = lastDetectedReferenceRef.current;

    if (!newestReference) {
      lastDetectedReferenceRef.current = null;
      setActiveReference(null);
      return;
    }

    if (newestReference !== previousNewestReference) {
      setActiveReference(newestReference);
    }

    lastDetectedReferenceRef.current = newestReference;
  }, [orderedDetectedReferences]);
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
    setForm(initialState);
  };

  const transcribeSavedClip = async (clip: NoteClip) => {
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
  };

  const insertScripture = (payload: string) => {
    const editor = bodyRef.current;

    if (!editor) {
      setForm((current) => ({
        ...current,
        body: current.body ? `${current.body.trimEnd()}\n${payload}` : payload,
      }));
      return;
    }

    insertTextIntoEditable(editor, form.body.trim() ? `\n${payload}` : payload);

    setForm((current) => ({
      ...current,
      body: readPlainTextFromEditor(editor).trimEnd(),
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
      {loadingDraft ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading draft…</strong>
          <span style={{ color: 'var(--muted)' }}>Checking for a locally saved draft in this browser.</span>
        </section>
      ) : null}

      {handoffMessage ? <section className="empty-state status-message" role="status">{handoffMessage}</section> : null}
      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}

      {!loadingDraft ? (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div
            className="note-editor-layout"
            style={{
              gridTemplateColumns: 'minmax(0, 1fr) 360px',
              alignItems: 'start',
              gap: '2rem',
            }}
          >
            <div className="note-editor-main">
              <section
                className="editor-surface"
                style={{
                  padding: 0,
                  gap: 0,
                  background: 'rgba(18, 20, 25, 0.95)',
                  borderRadius: '40px',
                  overflow: 'hidden',
                  minHeight: '76vh',
                  position: 'relative',
                  boxShadow: '0 32px 80px rgba(0, 0, 0, 0.35)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '1.6rem 2.4rem',
                    borderBottom: '1px solid rgba(78, 70, 58, 0.14)',
                  }}
                >
                  <div
                    className="meta-row"
                    style={{
                      gap: '1rem 1.2rem',
                      fontSize: '0.68rem',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>
                      {mode === 'create' ? 'Draft saved:' : editEyebrow ?? 'Draft saved:'}{' '}
                      {format(new Date(), 'hh:mm a')}
                    </span>
                    <span style={{ opacity: 0.72 }}>Personal Reflection</span>
                    {showSpeakerField && form.speaker?.trim() ? <span>{form.speaker.trim()}</span> : null}
                    {isPrayerRequest ? <span>{form.prayerStatus ?? 'Ongoing'}</span> : null}
                    {isDreamNote ? <span>{form.isLucidDream ? 'Lucid dream' : 'Dream note'}</span> : null}
                  </div>
                  {orderedDetectedReferences.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                        gap: '0.65rem',
                        minWidth: 0,
                      }}
                    >
                      {orderedDetectedReferences.slice(0, 3).map((reference) => (
                        <button
                          key={reference}
                          onClick={() => setActiveReference(reference)}
                          type="button"
                          style={{
                            border: 0,
                            borderRadius: '999px',
                            background: reference === activeReference ? 'rgba(209, 172, 112, 0.14)' : 'rgba(255, 248, 235, 0.05)',
                            color: 'var(--accent)',
                            padding: '0.58rem 0.92rem',
                            fontSize: '0.74rem',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.55rem',
                          }}
                        >
                          <span>{reference}</span>
                          <span style={{ opacity: 0.75 }}>×</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '2.2rem',
                    padding: '4.3rem 3.6rem 7.5rem',
                    minHeight: '100%',
                  }}
                >
                  <input
                    value={form.title}
                    onChange={(event) => onChange('title', event.target.value)}
                    placeholder={placeholders.title}
                    required
                    style={{
                      border: 0,
                      outline: 'none',
                      background: 'transparent',
                      color: 'rgba(220, 223, 229, 0.48)', // Readable ghosted title
                      fontSize: 'clamp(3.6rem, 6vw, 5.2rem)',
                      lineHeight: 0.94,
                      letterSpacing: '-0.07em',
                      fontWeight: 600,
                      padding: 0,
                      width: '100%',
                    }}
                  />

                  <div
                    style={{
                      display: 'flex', // Changed to flex for better control over spacing
                      flexWrap: 'wrap', // Allow wrapping if space is constrained
                      justifyContent: 'start',
                      gap: '0.9rem', // Adjusted gap
                      alignItems: 'center',
                      maxWidth: showSpeakerField ? '640px' : '200px',
                      marginTop: '-0.6rem',
                    }}
                  >
                    {showSpeakerField ? (
                      <input
                        value={form.speaker}
                        onChange={(event) => onChange('speaker', event.target.value)}
                        placeholder={placeholders.speaker}
                        style={canvasInputStyle}
                      />
                    ) : null}
                    <select
                      value={form.type}
                      onChange={(event) => onChange('type', event.target.value as NoteInput['type'])}
                      // Added styles to make select look like text, matching PNG
                      // while preserving functionality.
                      // This is a visual hack to match the PNG without changing logic.
                      // In a real app, this would likely be a custom component or a modal trigger.
                      style={canvasInputStyle}
                    >
                      {NOTE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isDreamNote ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(180px, 220px)',
                        gap: '0.9rem 1rem',
                        alignItems: 'center',
                        maxWidth: '560px',
                      }}
                    >
                      <label style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', color: 'var(--muted)' }}>
                        <input
                          checked={Boolean(form.isLucidDream)}
                          onChange={(event) => onChange('isLucidDream', event.target.checked)}
                          type="checkbox"
                        />
                        <span style={{ lineHeight: 1.5 }}>Mark this as a lucid dream</span>
                      </label>
                      <select
                        value={form.dreamRole ?? 'observing'}
                        onChange={(event) => onChange('dreamRole', event.target.value as 'observing' | 'involved')}
                        style={canvasInputStyle}
                      >
                        <option value="observing">Observing</option>
                        <option value="involved">Involved</option>
                      </select>
                    </div>
                  ) : null}

                  {isPrayerRequest ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(180px, 220px) minmax(220px, 1fr)',
                        gap: '0.9rem 1rem',
                        alignItems: 'center',
                        maxWidth: '720px',
                      }}
                    >
                      <select
                        value={form.prayerStatus ?? 'Ongoing'}
                        onChange={(event) => onChange('prayerStatus', event.target.value as PrayerRequestStatus)}
                        style={canvasInputStyle}
                      >
                        <option value="Ongoing">Ongoing</option>
                        <option value="Answered">Answered</option>
                      </select>
                      <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                        Prayer reminders are not available in the web app yet.
                      </span>
                    </div>
                  ) : null}

                  <section
                    className="note-body-section"
                    style={{
                      display: 'grid',
                      gap: '1rem',
                      minHeight: '420px',
                      maxWidth: '860px',
                      paddingTop: '1.1rem',
                    }}
                  >
                    <div className="note-body-frame" style={{ gap: 0 }}>
                      <ScriptureEditableField
                        ref={bodyRef}
                        value={form.body}
                        onChange={(nextBody) => onChange('body', nextBody)}
                        onReferenceClick={setActiveReference}
                        placeholder={placeholders.body}
                      />
                    </div>
                  </section>
                </div>

                <div
                  style={{
                    position: 'sticky',
                    bottom: '2rem',
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    paddingBottom: '1.4rem',
                    marginTop: '-6rem',
                    zIndex: 20,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                    alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.8rem',
                    borderRadius: '999px',
                      background: 'rgba(25, 28, 35, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(20px)',
                      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
                    pointerEvents: 'auto',
                  }}
                >
                    <button className="button button-primary" disabled={pending} type="submit" style={toolbarActionStyle}>
                      {pending ? 'SAVING…' : 'SAVE'}
                    </button>
                    <button className="button button-ghost" onClick={clearDraft} type="button" style={toolbarActionStyle}>
                      CLEAR
                    </button>
                    <Link className="button button-ghost" href={cancelHref ?? (mode === 'create' ? '/notes' : `/notes/${note?.id}`)} style={toolbarActionStyle}>
                      CANCEL
                    </Link>
                  </div>
                </div>
              </section>
            </div>

            <aside className="note-editor-rail" style={{ gap: '1.5rem', alignContent: 'start' }}>
              <ScriptureReferencePreview
                onInsert={insertScripture}
                onClose={() => setActiveReference(null)}
                reference={activeReference ?? orderedDetectedReferences[0] ?? null}
              />

              {note?.clips?.length ? (
                <NoteClipsList
                  clips={note.clips}
                  title="Attached audio"
                  description="This note includes saved audio from dictation or upload."
                  onTranscribeClip={transcribeSavedClip}
                />
              ) : null}
            </aside>
          </div>
        </form>
      ) : null}
    </div>
  );
}

const canvasInputStyle: CSSProperties = {
  minHeight: 54,
  borderRadius: 18,
  padding: '0.95rem 1.05rem',
  background: 'rgba(255, 248, 235, 0.02)',
  color: 'var(--text)',
  border: '1px solid rgba(78, 70, 58, 0.08)',
  outline: 'none',
  appearance: 'none',
  backgroundImage: 'none',
  cursor: 'pointer',
};

const toolbarActionStyle = {
  minHeight: 'auto',
  padding: '0.6rem 1.1rem',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
} as const;
