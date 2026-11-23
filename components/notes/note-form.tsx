'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNote, NOTE_TYPES, updateNote, type NoteInput, type NoteRecord } from '@/lib/notes';
import { upsertPrayerRequest, type PrayerRequestStatus } from '@/lib/prayer-requests';
import { createRecordingSignedUrl, formatTranscriptText, transcribeRecording } from '@/lib/transcription';
import {
  DEFAULT_NOTE_TYPE,
  getNoteTypeGuidance,
  getNoteTypePlaceholders,
  supportsSpeakerField,
} from '@/components/notes/note-utils';
import { ScriptureRail } from '@/components/notes/scripture-rail';
import { getMyEntitlements } from '@/lib/entitlements';
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
  const [transcriptionEnabled, setTranscriptionEnabled] = useState<boolean | null>(null);
  const [phraseSearchEnabled, setPhraseSearchEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    getMyEntitlements()
      .then((entitlements) => {
        if (!active) return;
        setTranscriptionEnabled(entitlements.transcriptionEnabled);
        setPhraseSearchEnabled(entitlements.scriptureSearchEnabled);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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

  const wordCount = form.body.trim() ? form.body.trim().split(/\s+/).length : 0;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));
  const countLabel = wordCount ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'} · ${readMinutes} min read` : '';
  const railReference = activeReference ?? orderedDetectedReferences[0] ?? null;
  const backHref = cancelHref ?? (mode === 'create' ? '/notes' : `/notes/${note?.id}`);
  const statusText = mode === 'create' ? 'Draft saved in this browser' : editEyebrow ?? 'Editing · draft kept in this browser';

  return (
    <div className="page-section note-composer-page">
      {loadingDraft ? (
        <section className="loading-state status-message" role="status" aria-live="polite">
          <strong>Loading draft…</strong>
          <span style={{ color: 'var(--muted)' }}>Checking for a locally saved draft in this browser.</span>
        </section>
      ) : null}

      {handoffMessage ? <section className="empty-state status-message" role="status">{handoffMessage}</section> : null}
      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}

      {!loadingDraft ? (
        <form className="note-composer" onSubmit={onSubmit}>
          <div className="composer-topbar">
            <Link className="back-link" href={backHref}>
              <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 11 18" width="7">
                <path d="M9 1L1 9l8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
              {mode === 'create' ? 'Notebook' : 'Note'}
            </Link>
            <span className="composer-status">
              {statusText} · {format(new Date(), 'h:mm a')}
            </span>
            <div className="composer-topbar-actions">
              <button className="button button-ghost" onClick={clearDraft} type="button">
                {mode === 'create' ? 'Clear' : 'Discard changes'}
              </button>
              <button className="button button-primary" disabled={pending} type="submit">
                {pending ? 'Saving…' : mode === 'create' ? 'Save note' : 'Update note'}
              </button>
            </div>
          </div>

          <fieldset className="type-picker">
            <legend>What kind of note?</legend>
            <div className="type-picker-grid">
              {NOTE_TYPES.map((type) => (
                <label className={`type-card${form.type === type ? ' is-selected' : ''}`} key={type}>
                  <span className="type-card-title">
                    <input
                      checked={form.type === type}
                      name="note-type"
                      onChange={() => onChange('type', type)}
                      type="radio"
                      value={type}
                    />
                    {TYPE_LABELS[type] ?? type}
                  </span>
                  <span className="type-card-copy">{TYPE_DESCRIPTIONS[type] ?? ''}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="composer-columns">
            <section className="composer-main" aria-label={`${form.type} note`}>
              <input
                aria-label="Title"
                className="composer-title"
                onChange={(event) => onChange('title', event.target.value)}
                placeholder={placeholders.title}
                required
                value={form.title}
              />

              {showSpeakerField || mode === 'create' ? (
                <div className="composer-meta">
                  {showSpeakerField ? (
                    <label className="composer-field">
                      {form.type === 'Study' ? 'Teacher or source' : 'Speaker'}
                      <input
                        onChange={(event) => onChange('speaker', event.target.value)}
                        placeholder={placeholders.speaker}
                        value={form.speaker}
                      />
                    </label>
                  ) : null}
                  {mode === 'create' ? (
                    <div className="composer-field composer-capture">
                      <span>Capture</span>
                      <div className="capture-buttons">
                        <button aria-pressed="true" className="capture-button is-active" type="button">
                          Type
                        </button>
                        <Link className="capture-button" href="/notes/dictate">
                          Live dictation{transcriptionEnabled === false ? <em>Premium</em> : null}
                        </Link>
                        <Link className="capture-button" href="/notes/dictate">
                          Record, then transcribe{transcriptionEnabled === false ? <em>Premium</em> : null}
                        </Link>
                        <Link className="capture-button" href="/notes/dictate">
                          Upload audio
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isDreamNote ? (
                <div className="composer-meta">
                  <div className="composer-field">
                    <span>Kind of dream</span>
                    <div className="segmented" role="group" aria-label="Kind of dream">
                      <button aria-pressed={!form.isLucidDream} onClick={() => onChange('isLucidDream', false)} type="button">
                        Standard dream
                      </button>
                      <button aria-pressed={Boolean(form.isLucidDream)} onClick={() => onChange('isLucidDream', true)} type="button">
                        Lucid dream
                      </button>
                    </div>
                  </div>
                  <div className="composer-field">
                    <span>In the dream, I was</span>
                    <div className="segmented" role="group" aria-label="In the dream, I was">
                      <button aria-pressed={(form.dreamRole ?? 'observing') === 'observing'} onClick={() => onChange('dreamRole', 'observing')} type="button">
                        Observing
                      </button>
                      <button aria-pressed={form.dreamRole === 'involved'} onClick={() => onChange('dreamRole', 'involved')} type="button">
                        Involved
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {isPrayerRequest ? (
                <div className="composer-meta">
                  <div className="composer-field">
                    <span>Status</span>
                    <div className="segmented" role="group" aria-label="Prayer status">
                      {(['Ongoing', 'Answered'] as PrayerRequestStatus[]).map((status) => (
                        <button
                          aria-pressed={(form.prayerStatus ?? 'Ongoing') === status}
                          key={status}
                          onClick={() => onChange('prayerStatus', status)}
                          type="button"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="composer-hint">Prayer reminders aren’t in the web app yet.</p>
                </div>
              ) : null}

              <div className="composer-field composer-body">
                <span>Body</span>
                <div className="composer-body-box">
                  <ScriptureEditableField
                    ref={bodyRef}
                    value={form.body}
                    onChange={(nextBody) => onChange('body', nextBody)}
                    onReferenceClick={setActiveReference}
                    placeholder={placeholders.body}
                  />
                </div>
              </div>

              <div className="composer-refs">
                {orderedDetectedReferences.length ? (
                  <>
                    <span className="composer-refs-label">Detected references</span>
                    {[...detectedReferences].map((reference) => (
                      <button
                        className={`verse-chip${reference === railReference ? ' is-active' : ''}`}
                        key={reference}
                        onClick={() => setActiveReference(reference)}
                        type="button"
                      >
                        ¶ {reference}
                      </button>
                    ))}
                  </>
                ) : (
                  <span className="composer-hint">Type a reference like John 3:16 and it will appear here.</span>
                )}
                {countLabel ? <span className="composer-count">{countLabel}</span> : null}
              </div>
            </section>

            <aside className="composer-rail">
              <ScriptureRail onInsert={insertScripture} phraseSearchEnabled={phraseSearchEnabled} reference={railReference} />

              <p className="composer-guidance">{getNoteTypeGuidance(form.type)}</p>

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

const TYPE_LABELS: Record<string, string> = {
  'Prayer Requests': 'Prayer request',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  'Church notes': 'Sermon points, verses and the speaker',
  Study: 'Follow an argument, compare passages',
  Journal: 'Reflection and prayer in your own words',
  Dream: 'Symbols, sequence and tone, while fresh',
  'Prayer Requests': 'Track it as ongoing or answered',
};
