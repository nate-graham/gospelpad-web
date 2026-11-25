'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNote, NOTE_TYPES, type NoteInput } from '@/lib/notes';
import { upsertPrayerRequest, type PrayerRequestStatus } from '@/lib/prayer-requests';
import { formatTranscriptText, uploadRecordingBlob, transcribeRecording, type UploadedRecording } from '@/lib/transcription';
import { getNoteTypePlaceholders, supportsSpeakerField } from '@/components/notes/note-utils';
import { ScriptureEditableField } from '@/components/notes/scripture-editable-field';
import { formatVerseReference, splitNoteIntoBlocks } from '@/components/notes/scripture-reference-text';
import { fetchScriptureByReference, formatScriptureTextForInsertion, type ScriptureResult } from '@/lib/scripture';
import { findScriptureReferences, splitTextByScriptureReferences } from '@/lib/scripture-references';

type DictationDraft = Pick<NoteInput, 'title' | 'speaker' | 'type' | 'isLucidDream' | 'dreamRole' | 'prayerStatus'> & {
  transcript: string;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  item: (index: number) => SpeechRecognitionAlternativeLike;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    item: (index: number) => SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const initialDraft: DictationDraft = {
  title: '',
  speaker: '',
  type: 'Journal',
  transcript: '',
  isLucidDream: false,
  dreamRole: 'observing',
  prayerStatus: 'Ongoing',
};

function normalizeLiveSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTranscriptSuffix(previousText: string, nextText: string) {
  const previousWords = previousText.trim().split(/\s+/).filter(Boolean);
  const nextWords = nextText.trim().split(/\s+/).filter(Boolean);

  if (!nextWords.length) return '';
  if (!previousWords.length) return nextWords.join(' ');

  const maxPrefix = Math.min(previousWords.length, nextWords.length);
  let sharedPrefixWords = 0;

  for (let index = 0; index < maxPrefix; index += 1) {
    if (normalizeLiveSegment(previousWords[index]) !== normalizeLiveSegment(nextWords[index])) {
      break;
    }
    sharedPrefixWords += 1;
  }

  if (sharedPrefixWords >= nextWords.length) return '';
  return nextWords.slice(sharedPrefixWords).join(' ').trim();
}

export function DictationCaptureView() {
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const liveResultReceivedRef = useRef(false);
  const keepLiveDictationRunningRef = useRef(false);
  const liveCommittedTranscriptRef = useRef('');
  const restartTimerRef = useRef<number | null>(null);
  const [draft, setDraft] = useState<DictationDraft>(initialDraft);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState('Dictation clip');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedClip, setUploadedClip] = useState<UploadedRecording | null>(null);
  const [liveListening, setLiveListening] = useState(false);
  const [liveInterim, setLiveInterim] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [mode, setMode] = useState<'live' | 'record' | 'upload'>('live');
  const [liveSupported, setLiveSupported] = useState(true);
  const [recordSupported, setRecordSupported] = useState(true);
  const [activeReference, setActiveReference] = useState<string | null>(null);

  // What this browser can do is only known in the browser, so it is checked after the first render.
  useEffect(() => {
    const live = typeof window.SpeechRecognition !== 'undefined' || typeof window.webkitSpeechRecognition !== 'undefined';
    const record = typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    setLiveSupported(live);
    setRecordSupported(record);
    setMode(live ? 'live' : record ? 'record' : 'upload');
  }, []);

  useEffect(() => {
    if (!liveListening) return undefined;
    const timer = window.setInterval(() => setLiveSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [liveListening]);

  // References heard so far, most recent first, and the ones whose verse is already in the note.
  const heardReferences = useMemo(() => findScriptureReferences(draft.transcript).reverse(), [draft.transcript]);
  const insertedReferences = useMemo(
    () =>
      new Set(
        splitNoteIntoBlocks(draft.transcript)
          .filter((block) => block.kind === 'verse')
          .map((block) => (block.kind === 'verse' ? block.reference : ''))
      ),
    [draft.transcript]
  );

  /** Puts the verse on its own lines after the paragraph where the reference was last mentioned. */
  const insertVerseAfterReference = (reference: string, verse: string) => {
    setDraft((current) => {
      const text = current.transcript;
      let offset = 0;
      let mentionEnd = -1;
      for (const segment of splitTextByScriptureReferences(text)) {
        const length = segment.value.length;
        if (segment.type === 'reference' && segment.value === reference) mentionEnd = offset + length;
        offset += length;
      }
      if (mentionEnd < 0) {
        return { ...current, transcript: `${text.trimEnd()}\n\n${verse}\n\n` };
      }
      const breakAt = text.indexOf('\n\n', mentionEnd);
      const cut = breakAt < 0 ? text.length : breakAt;
      const before = text.slice(0, cut).trimEnd();
      const after = text.slice(cut).replace(/^\s+/, '');
      return { ...current, transcript: `${before}\n\n${verse}\n\n${after}` };
    });
    setActiveReference(null);
  };

  useEffect(() => {
    if (!recording) return undefined;

    const timer = window.setInterval(() => {
      setRecordSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [recording]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }
      keepLiveDictationRunningRef.current = false;
      speechRecognitionRef.current?.stop();
    };
  }, [audioUrl]);

  const placeholders = useMemo(() => getNoteTypePlaceholders(draft.type), [draft.type]);
  const showSpeakerField = supportsSpeakerField(draft.type);
  const isDream = draft.type === 'Dream';
  const isPrayerRequest = draft.type === 'Prayer Requests';

  const updateDraft = <K extends keyof DictationDraft>(key: K, value: DictationDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const resetAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setUploadedClip(null);
    setRecordSeconds(0);
  };

  const appendTranscriptText = (nextText: string) => {
    const cleaned = formatTranscriptText(nextText).trim();
    if (!cleaned) return;

    setDraft((current) => ({
      ...current,
      transcript: current.transcript.trim()
        ? `${current.transcript.trimEnd()}\n\n${cleaned}`
        : cleaned,
    }));
  };

  const appendLiveTranscriptText = (nextText: string) => {
    const cleaned = nextText.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;

    setDraft((current) => {
      const currentTranscript = current.transcript.trimEnd();
      const needsSpace =
        currentTranscript.length > 0 &&
        !/[\s\n]$/.test(current.transcript) &&
        !/^[,.;:!?)]/.test(cleaned);

      return {
        ...current,
        transcript: currentTranscript
          ? `${currentTranscript}${needsSpace ? ' ' : ''}${cleaned}`
          : cleaned,
      };
    });
  };

  const startRecording = async () => {
    try {
      setPermissionError(null);
      setError(null);
      setNotice(null);
      resetAudio();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const nextUrl = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioName(`Dictation clip ${new Date().toLocaleString('en-GB')}`);
        setAudioUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
      };

      recorder.start();
      setRecordSeconds(0);
      setRecording(true);
    } catch (recordError) {
      setPermissionError(recordError instanceof Error ? recordError.message : 'Could not access the microphone.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const startLiveDictation = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setLiveError('Live dictation is not supported in this browser.');
      return;
    }

    try {
      if (!speechRecognitionRef.current) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-GB';
        recognition.onstart = () => {
          setLiveListening(true);
          setLiveError(null);
          setNotice('Live dictation is listening. You can keep editing the transcript while it adds new text.');
        };
        recognition.onresult = (event) => {
          liveResultReceivedRef.current = true;
          const finalSegments: string[] = [];
          let interimText = '';

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const transcript = (result[0]?.transcript ?? result.item(0)?.transcript ?? '').trim();
            if (result.isFinal) {
              if (transcript) {
                finalSegments.push(transcript);
              }
            } else {
              interimText += transcript;
            }
          }

          if (finalSegments.length > 0) {
            const fullFinalTranscript = finalSegments.join(' ').trim();
            const nextSuffix = getTranscriptSuffix(liveCommittedTranscriptRef.current, fullFinalTranscript);
            if (nextSuffix) {
              appendLiveTranscriptText(nextSuffix);
            }
            liveCommittedTranscriptRef.current = fullFinalTranscript;
          }
          setLiveInterim(interimText.trim());
        };
        recognition.onerror = (event) => {
          setLiveListening(false);
          setLiveInterim('');
          const fatalError = event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture';
          if (fatalError) {
            keepLiveDictationRunningRef.current = false;
          }
          setLiveError(event.error ? `Live dictation stopped: ${event.error}.` : 'Live dictation stopped unexpectedly.');
        };
        recognition.onend = () => {
          setLiveListening(false);
          setLiveInterim('');
          if (keepLiveDictationRunningRef.current) {
            restartTimerRef.current = window.setTimeout(() => {
              try {
                speechRecognitionRef.current?.start();
              } catch {
                setLiveError('Live dictation paused here. Try starting it again or use record and transcribe instead.');
                keepLiveDictationRunningRef.current = false;
              }
            }, 250);
            return;
          }
          if (!liveResultReceivedRef.current) {
            setLiveError('This browser did not return live speech results here. Use record and transcribe instead.');
          }
        };
        speechRecognitionRef.current = recognition;
      }

      liveResultReceivedRef.current = false;
      liveCommittedTranscriptRef.current = '';
      setLiveSeconds(0);
      keepLiveDictationRunningRef.current = true;
      setLiveError(null);
      setError(null);
      speechRecognitionRef.current.start();
      setNotice('Starting live dictation…');
    } catch (speechError) {
      setLiveListening(false);
      setLiveError(speechError instanceof Error ? speechError.message : 'Could not start live dictation.');
    }
  };

  const stopLiveDictation = () => {
    keepLiveDictationRunningRef.current = false;
    liveCommittedTranscriptRef.current = '';
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
    }
    speechRecognitionRef.current?.stop();
    setLiveListening(false);
    setLiveInterim('');
  };

  const onAudioFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetAudio();
    const url = URL.createObjectURL(file);
    setAudioBlob(file);
    setAudioName(file.name || 'Uploaded audio');
    setAudioUrl(url);
    setNotice(`Loaded ${file.name} for transcription.`);
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    try {
      setTranscribing(true);
      setError(null);
      setNotice(null);
      const upload = await uploadRecordingBlob(audioBlob);
      setUploadedClip(upload);
      const result = await transcribeRecording(upload.signedUrl, upload.path, upload.bucket);
      setDraft((current) => ({
        ...current,
        transcript: formatTranscriptText(result.text?.trim() || ''),
      }));
      setNotice('Transcription complete. Review and edit the text before saving.');
    } catch (transcriptionError) {
      const message = transcriptionError instanceof Error ? transcriptionError.message : 'Failed to transcribe audio.';
      setError(message);
    } finally {
      setTranscribing(false);
    }
  };

  const createNoteFromTranscript = async () => {
    const body = draft.transcript.trim();
    if (!body) {
      setError('Transcription text is required before saving.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      let prayerRequestId: string | null = null;
      let nextUploadedClip = uploadedClip;

      if (audioBlob && !nextUploadedClip) {
        nextUploadedClip = await uploadRecordingBlob(audioBlob);
        setUploadedClip(nextUploadedClip);
      }

      if (draft.type === 'Prayer Requests') {
        prayerRequestId = await upsertPrayerRequest({
          title: draft.title,
          body,
          status: draft.prayerStatus ?? 'Ongoing',
          shared: false,
          accepted: false,
          groupId: null,
        });
      }

      const noteId = await createNote({
        title: draft.title,
        body,
        speaker: showSpeakerField ? draft.speaker : '',
        type: draft.type,
        isLucidDream: draft.type === 'Dream' ? Boolean(draft.isLucidDream) : undefined,
        dreamRole: draft.type === 'Dream' ? draft.dreamRole ?? 'observing' : undefined,
        prayerStatus: draft.type === 'Prayer Requests' ? draft.prayerStatus ?? 'Ongoing' : undefined,
        prayerRequestId,
        clips:
          nextUploadedClip
            ? [
                {
                  id: `clip-${Date.now()}`,
                  uri: nextUploadedClip.path,
                  duration: recordSeconds * 1000,
                  name: audioName || 'Dictation clip',
                },
              ]
            : undefined,
      });

      router.replace(`/notes/${noteId}/edit?dictated=1`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save dictated note.');
      setSaving(false);
    }
  };

  const busy = recording || liveListening || keepLiveDictationRunningRef.current;
  const statusLabel = liveListening
    ? 'Listening'
    : recording
      ? 'Recording'
      : transcribing
        ? 'Transcribing'
        : draft.transcript.trim()
          ? 'Ready to save'
          : 'Not started';

  return (
    <div className="page-container page-section record-page">
      <div className="composer-topbar">
        <Link className="back-link" href="/notes">
          <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 11 18" width="7">
            <path d="M9 1L1 9l8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
          Notebook
        </Link>
        <span className="composer-status">
          Record · {statusLabel}
          {liveListening || recording ? ` · ${formatSeconds(liveListening ? liveSeconds : recordSeconds)}` : ''}
        </span>
        <div className="composer-topbar-actions">
          <button
            className="button button-primary"
            disabled={saving || transcribing || !draft.transcript.trim()}
            onClick={createNoteFromTranscript}
            type="button"
          >
            {saving ? 'Saving…' : 'Save as note'}
          </button>
        </div>
      </div>

      <div className="segmented record-modes" role="group" aria-label="How to capture">
        <button aria-pressed={mode === 'live'} disabled={busy} onClick={() => setMode('live')} type="button">
          Live dictation
        </button>
        <button aria-pressed={mode === 'record'} disabled={busy} onClick={() => setMode('record')} type="button">
          Record, then transcribe
        </button>
        <button aria-pressed={mode === 'upload'} disabled={busy} onClick={() => setMode('upload')} type="button">
          Upload audio
        </button>
      </div>

      {permissionError ? <section className="error-state status-message" role="alert">{permissionError}</section> : null}
      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}

      <div className="composer-columns">
        <section className="composer-main" aria-label="Transcript">
          <input
            aria-label="Title"
            className="composer-title"
            onChange={(event) => updateDraft('title', event.target.value)}
            placeholder={placeholders.title}
            value={draft.title}
          />

          <div className="composer-meta">
            <label className="composer-field">
              Note type
              <select onChange={(event) => updateDraft('type', event.target.value as DictationDraft['type'])} value={draft.type}>
                {NOTE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'Prayer Requests' ? 'Prayer request' : type}
                  </option>
                ))}
              </select>
            </label>
            {showSpeakerField ? (
              <label className="composer-field">
                {draft.type === 'Study' ? 'Teacher or source' : 'Speaker'}
                <input
                  onChange={(event) => updateDraft('speaker', event.target.value)}
                  placeholder={placeholders.speaker}
                  value={draft.speaker}
                />
              </label>
            ) : null}
            {isDream ? (
              <div className="composer-field">
                <span>Kind of dream</span>
                <div className="segmented" role="group" aria-label="Kind of dream">
                  <button aria-pressed={!draft.isLucidDream} onClick={() => updateDraft('isLucidDream', false)} type="button">
                    Standard
                  </button>
                  <button aria-pressed={Boolean(draft.isLucidDream)} onClick={() => updateDraft('isLucidDream', true)} type="button">
                    Lucid
                  </button>
                </div>
              </div>
            ) : null}
            {isDream ? (
              <div className="composer-field">
                <span>In the dream, I was</span>
                <div className="segmented" role="group" aria-label="In the dream, I was">
                  <button aria-pressed={(draft.dreamRole ?? 'observing') === 'observing'} onClick={() => updateDraft('dreamRole', 'observing')} type="button">
                    Observing
                  </button>
                  <button aria-pressed={draft.dreamRole === 'involved'} onClick={() => updateDraft('dreamRole', 'involved')} type="button">
                    Involved
                  </button>
                </div>
              </div>
            ) : null}
            {isPrayerRequest ? (
              <div className="composer-field">
                <span>Status</span>
                <div className="segmented" role="group" aria-label="Prayer status">
                  {(['Ongoing', 'Answered'] as PrayerRequestStatus[]).map((status) => (
                    <button
                      aria-pressed={(draft.prayerStatus ?? 'Ongoing') === status}
                      key={status}
                      onClick={() => updateDraft('prayerStatus', status)}
                      type="button"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="composer-field composer-body">
            <span className="record-transcript-label">
              Transcript
              {liveListening ? <em className="record-live-dot">Live</em> : null}
            </span>
            <div className="composer-body-box record-transcript">
              <ScriptureEditableField
                onChange={(next) => updateDraft('transcript', next)}
                onReferenceClick={setActiveReference}
                placeholder={
                  mode === 'live'
                    ? 'Press the red button and start speaking. Your words appear here as you talk, and you can edit them at any time.'
                    : mode === 'record'
                      ? 'Record, then press Transcribe. The text appears here for you to tidy before saving.'
                      : 'Choose an audio file, then press Transcribe. The text appears here for you to tidy before saving.'
                }
                value={draft.transcript}
              />
              {liveInterim ? <p className="record-interim">{liveInterim}…</p> : null}
            </div>
          </div>
        </section>

        <aside className="composer-rail">
          <section className="scripture-rail" aria-label="Verses heard">
            <span className="rail-heading account-heading-row">
              <span>Verses heard</span>
              <span className="account-heading-aside">{heardReferences.length || ''}</span>
            </span>
            {heardReferences.length === 0 ? (
              <p className="composer-hint">
                References like “John 3:16” appear here as they’re spoken or typed. Insert one to put the verse into your note.
              </p>
            ) : (
              heardReferences.map((reference) => (
                <HeardVerse
                  active={reference === activeReference}
                  inserted={insertedReferences.has(reference)}
                  key={reference}
                  onInsert={(verse) => insertVerseAfterReference(reference, verse)}
                  onSelect={() => setActiveReference(reference === activeReference ? null : reference)}
                  reference={reference}
                />
              ))
            )}
          </section>

          {audioUrl ? (
            <section className="rail-section">
              <span className="rail-heading">Recording</span>
              <audio className="record-audio" controls src={audioUrl} />
              <span className="composer-hint">
                {audioName}
                {recordSeconds ? ` · ${formatSeconds(recordSeconds)}` : ''}
              </span>
              <div className="scripture-rail-actions">
                <button className="button button-primary" disabled={transcribing} onClick={transcribeAudio} type="button">
                  {transcribing ? 'Transcribing…' : draft.transcript.trim() ? 'Transcribe again' : 'Transcribe'}
                </button>
                <button className="button button-secondary" disabled={transcribing} onClick={resetAudio} type="button">
                  Discard audio
                </button>
              </div>
              {draft.transcript.trim() && !transcribing ? (
                <span className="composer-hint">Transcribing again replaces the transcript.</span>
              ) : null}
            </section>
          ) : null}

          <p className="composer-guidance">
            Saving keeps the transcript as your note{audioBlob ? ' and attaches the audio' : ''}. You can tidy it further in the editor afterwards.
          </p>
        </aside>
      </div>

      <div className="record-bar" role="region" aria-label="Recording controls">
        {mode === 'live' ? (
          <>
            <button
              aria-label={liveListening ? 'Stop live dictation' : 'Start live dictation'}
              className={`record-button${liveListening ? ' is-on' : ''}`}
              disabled={!liveSupported}
              onClick={liveListening ? stopLiveDictation : startLiveDictation}
              type="button"
            >
              <span aria-hidden="true" />
            </button>
            <Waveform active={liveListening} />
            <span className="record-bar-status">
              {liveSupported
                ? liveListening
                  ? `Listening · ${formatSeconds(liveSeconds)}`
                  : liveError ?? 'Live dictation · words appear as you speak'
                : 'Live dictation isn’t available in this browser. Use Record, then transcribe.'}
            </span>
            {liveListening ? (
              <button className="button button-secondary" onClick={stopLiveDictation} type="button">
                Stop
              </button>
            ) : null}
          </>
        ) : mode === 'record' ? (
          <>
            <button
              aria-label={recording ? 'Stop recording' : 'Start recording'}
              className={`record-button${recording ? ' is-on' : ''}`}
              disabled={!recordSupported || transcribing}
              onClick={recording ? stopRecording : startRecording}
              type="button"
            >
              <span aria-hidden="true" />
            </button>
            <Waveform active={recording} />
            <span className="record-bar-status">
              {recordSupported
                ? recording
                  ? `Recording · ${formatSeconds(recordSeconds)}`
                  : audioUrl
                    ? 'Recorded · press Transcribe to turn it into text'
                    : 'Record the whole sermon, then transcribe it'
                : 'This browser can’t record here. Upload an audio file instead.'}
            </span>
            {recording ? (
              <button className="button button-secondary" onClick={stopRecording} type="button">
                Stop
              </button>
            ) : audioUrl ? (
              <button className="button button-primary" disabled={transcribing} onClick={transcribeAudio} type="button">
                {transcribing ? 'Transcribing…' : 'Transcribe'}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <label className="button button-secondary record-upload">
              Choose audio file
              <input accept="audio/*" onChange={onAudioFileSelected} type="file" />
            </label>
            <span className="record-bar-status">{audioUrl ? audioName : 'MP3, M4A, WAV or WebM'}</span>
            {audioUrl ? (
              <button className="button button-primary" disabled={transcribing} onClick={transcribeAudio} type="button">
                {transcribing ? 'Transcribing…' : 'Transcribe'}
              </button>
            ) : null}
          </>
        )}
      </div>
      {notice && !error ? <p className="composer-hint record-notice" role="status">{notice}</p> : null}
    </div>
  );
}

/** A reference heard in the transcript: tap to read it, then insert the verse into the note. */
function HeardVerse({
  reference,
  active,
  inserted,
  onSelect,
  onInsert,
}: {
  reference: string;
  active: boolean;
  inserted: boolean;
  onSelect: () => void;
  onInsert: (verse: string) => void;
}) {
  const [result, setResult] = useState<ScriptureResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active || result) return;
    let live = true;
    fetchScriptureByReference(reference, 'KJV')
      .then((next) => live && setResult(next))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [active, reference, result]);

  const insert = async () => {
    try {
      const verse = result ?? (await fetchScriptureByReference(reference, 'KJV'));
      setResult(verse);
      onInsert(formatScriptureTextForInsertion(verse));
    } catch {
      setFailed(true);
    }
  };

  return (
    <article className={`heard-verse${active ? ' is-open' : ''}`}>
      <div className="heard-verse-head">
        <button className="heard-verse-ref" onClick={onSelect} type="button">
          <span className="pilcrow" aria-hidden="true">¶</span>
          {formatVerseReference(reference)}
        </button>
        {inserted ? (
          <span className="heard-verse-done">Inserted</span>
        ) : (
          <button className="button button-secondary" onClick={() => void insert()} type="button">
            Insert
          </button>
        )}
      </div>
      {active ? (
        result ? (
          <p className="scripture-rail-text">{result.text.trim()}</p>
        ) : (
          <p className="composer-hint">{failed ? 'Couldn’t load this verse.' : 'Loading the verse…'}</p>
        )
      ) : null}
    </article>
  );
}

/** Decorative level bars that move while audio is being captured. */
function Waveform({ active }: { active: boolean }) {
  return (
    <span className={`record-wave${active ? ' is-active' : ''}`} aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => (
        <span key={index} style={{ animationDelay: `${(index % 7) * 0.11}s`, height: `${30 + ((index * 37) % 60)}%` }} />
      ))}
    </span>
  );
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
