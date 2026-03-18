'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createNote, NOTE_TYPES, type NoteInput } from '@/lib/notes';
import { upsertPrayerRequest, type PrayerRequestStatus } from '@/lib/prayer-requests';
import { formatTranscriptText, uploadRecordingBlob, transcribeRecording, type UploadedRecording } from '@/lib/transcription';
import { getNoteTypePlaceholders, supportsSpeakerField } from '@/components/notes/note-utils';

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
  const canRecord = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const canLiveDictate =
    typeof window !== 'undefined' && (typeof window.SpeechRecognition !== 'undefined' || typeof window.webkitSpeechRecognition !== 'undefined');

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
      setError(transcriptionError instanceof Error ? transcriptionError.message : 'Failed to transcribe audio.');
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

  return (
    <div className="page-section">
      <header className="page-header">
        <span className="eyebrow">Dictation mode</span>
        <h1>Capture a note by voice</h1>
        <p className="page-description">
          Use live dictation for text that appears while you speak, or record audio first and transcribe it after you stop. Both paths still hand the result into the note editor for cleanup.
        </p>
      </header>

      <section className="responsive-grid compact">
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Capture mode</span>
          <strong style={{ fontSize: '1.1rem' }}>
            {canLiveDictate ? 'Live dictation and recording' : canRecord ? 'Record, then transcribe' : 'Upload-first fallback'}
          </strong>
          <span style={{ color: 'var(--muted)' }}>
            {canLiveDictate
              ? 'Start live dictation for text as you speak, or keep using the saved-audio path when you want playback and retranscription later.'
              : canRecord
                ? 'Use the microphone directly in this browser, then run transcription after you stop recording.'
                : 'This browser does not support microphone capture here, so use the audio upload fallback.'}
          </span>
        </article>
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Transcription backend</span>
          <strong style={{ fontSize: '1.1rem' }}>Secure transcription</strong>
          <span style={{ color: 'var(--muted)' }}>
            Your audio is uploaded securely, transcribed, and then handed into the note editor for cleanup.
          </span>
        </article>
      </section>

      {permissionError ? <section className="error-state status-message" role="alert">{permissionError}</section> : null}
      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}
      {liveError ? <section className="error-state status-message" role="alert">{liveError}</section> : null}
      {notice ? <section className="empty-state status-message" role="status">{notice}</section> : null}

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div className="page-header" style={{ gap: '0.35rem' }}>
          <span className="eyebrow">Live dictation</span>
          <strong style={{ fontSize: '1.1rem' }}>{liveListening ? 'Listening now' : 'Speak and watch text appear'}</strong>
        </div>

        <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Live dictation adds recognized phrases into the transcript while you can still edit manually. This mode does not save an audio clip for playback later.
        </span>

        <div className="cta-row">
          {canLiveDictate ? (
            liveListening ? (
              <button className="button button-primary" onClick={stopLiveDictation} type="button">
                Stop live dictation
              </button>
            ) : (
              <button className="button button-primary" onClick={startLiveDictation} type="button">
                Start live dictation
              </button>
            )
          ) : (
            <span style={{ color: 'var(--muted)' }}>
              This browser does not expose the live speech-recognition API here. Use the record-and-transcribe flow below instead.
            </span>
          )}
        </div>

        {liveInterim ? (
          <div className="status-card" style={{ padding: '1rem' }}>
            <span className="eyebrow">Listening preview</span>
            <strong style={{ fontSize: '1rem', lineHeight: 1.6 }}>{liveInterim}</strong>
          </div>
        ) : null}
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div className="page-header" style={{ gap: '0.35rem' }}>
          <span className="eyebrow">Audio capture</span>
          <strong style={{ fontSize: '1.1rem' }}>{recording ? `Recording ${formatSeconds(recordSeconds)}` : audioBlob ? 'Audio ready' : 'Start with audio'}</strong>
        </div>

        <div className="cta-row">
          {canRecord ? (
            recording ? (
              <button className="button button-primary" type="button" onClick={stopRecording}>
                Stop recording
              </button>
            ) : (
              <button className="button button-primary" type="button" onClick={startRecording}>
                Start recording
              </button>
            )
          ) : null}

          <label className="button button-secondary" style={{ position: 'relative', overflow: 'hidden' }}>
            Upload audio
            <input
              accept="audio/*"
              onChange={onAudioFileSelected}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
              type="file"
            />
          </label>

          {audioBlob ? (
            <button className="button button-ghost" type="button" onClick={resetAudio}>
              Clear audio
            </button>
          ) : null}
        </div>

        {audioUrl ? (
          <audio controls src={audioUrl} style={{ width: '100%' }}>
            Your browser does not support audio playback.
          </audio>
        ) : null}

        <div className="cta-row">
          <button
            className="button button-primary"
            disabled={!audioBlob || transcribing}
            onClick={transcribeAudio}
            type="button"
          >
            {transcribing ? 'Transcribing…' : 'Transcribe audio'}
          </button>
        </div>
      </section>

      <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
        <div className="page-header" style={{ gap: '0.35rem' }}>
          <span className="eyebrow">Note setup</span>
          <strong style={{ fontSize: '1.1rem' }}>Review before saving</strong>
          <span style={{ color: 'var(--muted)' }}>
            Adjust the transcript and note type here, then continue into the standard editor after save.
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <label style={fieldStyle}>
            <span className="eyebrow" style={labelTextStyle}>Title</span>
            <input
              value={draft.title}
              onChange={(event) => updateDraft('title', event.target.value)}
              placeholder={placeholders.title}
              style={inputStyle}
            />
          </label>

          {showSpeakerField ? (
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Speaker</span>
              <input
                value={draft.speaker}
                onChange={(event) => updateDraft('speaker', event.target.value)}
                placeholder={placeholders.speaker}
                style={inputStyle}
              />
            </label>
          ) : null}

          <label style={fieldStyle}>
            <span className="eyebrow" style={labelTextStyle}>Type</span>
            <select
              value={draft.type}
              onChange={(event) => updateDraft('type', event.target.value as NoteInput['type'])}
              style={inputStyle}
            >
              {NOTE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isDream ? (
          <div className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            <label style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
              <input
                checked={Boolean(draft.isLucidDream)}
                onChange={(event) => updateDraft('isLucidDream', event.target.checked)}
                type="checkbox"
              />
              <span style={{ color: 'var(--muted)' }}>Mark this as a lucid dream</span>
            </label>
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>In the dream</span>
              <select
                value={draft.dreamRole ?? 'observing'}
                onChange={(event) => updateDraft('dreamRole', event.target.value as 'observing' | 'involved')}
                style={inputStyle}
              >
                <option value="observing">Observing</option>
                <option value="involved">Involved</option>
              </select>
            </label>
          </div>
        ) : null}

        {isPrayerRequest ? (
          <div className="status-card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
            <label style={fieldStyle}>
              <span className="eyebrow" style={labelTextStyle}>Prayer status</span>
              <select
                value={draft.prayerStatus ?? 'Ongoing'}
                onChange={(event) => updateDraft('prayerStatus', event.target.value as PrayerRequestStatus)}
                style={inputStyle}
              >
                <option value="Ongoing">Ongoing</option>
                <option value="Answered">Answered</option>
              </select>
            </label>
          </div>
        ) : null}

        <label style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
          <span className="eyebrow" style={labelTextStyle}>Transcript</span>
          <textarea
            value={draft.transcript}
            onChange={(event) => updateDraft('transcript', event.target.value)}
            placeholder="Your transcript will appear here after transcription. You can edit it before saving."
            style={textareaStyle}
          />
        </label>

        <div className="cta-row">
          <button
            className="button button-primary"
            disabled={!draft.transcript.trim() || saving}
            onClick={createNoteFromTranscript}
            type="button"
          >
            {saving ? 'Saving…' : 'Save and continue editing'}
          </button>
          <Link className="button button-secondary" href="/notes">
            Back to notes
          </Link>
        </div>
      </section>
    </div>
  );
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const fieldStyle: React.CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '0.72rem',
};

const inputStyle: React.CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid var(--line)',
  padding: '0.85rem 1rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
};

const textareaStyle: React.CSSProperties = {
  minHeight: 240,
  borderRadius: 18,
  border: '1px solid var(--line)',
  padding: '1rem',
  background: 'var(--field-bg)',
  color: 'var(--text)',
  resize: 'vertical',
};
