'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createRecordingSignedUrl } from '@/lib/transcription';

type NoteClip = {
  id: string;
  uri: string;
  duration: number;
  name: string;
};

type NoteClipsListProps = {
  clips: NoteClip[];
  title?: string;
  description?: string;
  onTranscribeClip?: (clip: NoteClip) => Promise<void>;
  transcribeLabel?: string;
  paywallMessage?: string;
};

export function NoteClipsList({
  clips,
  title = 'Audio clips',
  description = 'Play back or download the audio saved with this note.',
  onTranscribeClip,
  transcribeLabel = 'Transcribe again',
  paywallMessage,
}: NoteClipsListProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [transcribingClipId, setTranscribingClipId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setError(null);
        const entries = await Promise.all(
          clips.map(async (clip) => {
            if (/^https?:\/\//i.test(clip.uri)) {
              return [clip.id, clip.uri] as const;
            }

            const signedUrl = await createRecordingSignedUrl(clip.uri);
            return [clip.id, signedUrl] as const;
          })
        );

        if (!active) return;
        setUrls(Object.fromEntries(entries));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load clip URLs.');
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [clips]);

  if (clips.length === 0) {
    return null;
  }

  return (
    <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
      <div className="page-header" style={{ gap: '0.35rem' }}>
        <span className="eyebrow">{title}</span>
        <strong style={{ fontSize: '1.1rem' }}>
          {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
        </strong>
        <span style={{ color: 'var(--muted)' }}>{description}</span>
      </div>

      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}
      {actionError ? <section className="error-state status-message" role="alert">{actionError}</section> : null}
      {paywallMessage ? (
        <section className="empty-state status-message" role="status">
          <span>{paywallMessage}</span>
          <div className="cta-row">
            <Link className="button button-secondary" href="/pricing">
              View plans
            </Link>
          </div>
        </section>
      ) : null}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {clips.map((clip) => (
          <article className="status-card" key={clip.id} style={{ padding: '1rem', display: 'grid', gap: '0.6rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <strong>{clip.name || 'Audio clip'}</strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                  {formatDuration(clip.duration)}
                </span>
              </div>
              {urls[clip.id] ? (
                <div className="cta-row">
                  {onTranscribeClip ? (
                    <button
                      className="button button-secondary"
                      disabled={transcribingClipId === clip.id}
                      onClick={async () => {
                        try {
                          setActionError(null);
                          setTranscribingClipId(clip.id);
                          await onTranscribeClip(clip);
                        } catch (clipError) {
                          setActionError(clipError instanceof Error ? clipError.message : 'Failed to transcribe this clip.');
                        } finally {
                          setTranscribingClipId(null);
                        }
                      }}
                      type="button"
                    >
                      {transcribingClipId === clip.id ? 'Transcribing…' : transcribeLabel}
                    </button>
                  ) : null}
                  <a className="button button-secondary" href={urls[clip.id]} download target="_blank" rel="noreferrer">
                    Download
                  </a>
                </div>
              ) : null}
            </div>

            {urls[clip.id] ? (
              <audio controls src={urls[clip.id]} style={{ width: '100%' }}>
                Your browser does not support audio playback.
              </audio>
            ) : (
              <span style={{ color: 'var(--muted)' }}>Preparing audio preview…</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDuration(duration: number) {
  const totalSeconds = Math.max(0, Math.floor((duration || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
