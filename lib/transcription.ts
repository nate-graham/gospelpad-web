import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type TranscriptionResponse = {
  text: string;
};

export type UploadedRecording = {
  bucket: string;
  path: string;
  signedUrl: string;
};

export function formatTranscriptText(text: string) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return '';
  }

  if (normalized.includes('\n\n')) {
    return normalized;
  }

  const singleLine = normalized.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const sentences = singleLine.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);

  if (sentences.length <= 2) {
    return singleLine;
  }

  const paragraphs: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    const sentenceCount = current ? current.split(/(?<=[.!?])\s+/).filter(Boolean).length + 1 : 1;

    if (current && (next.length > 280 || sentenceCount > 3)) {
      paragraphs.push(current);
      current = sentence;
      continue;
    }

    current = next;
  }

  if (current) {
    paragraphs.push(current);
  }

  return paragraphs.join('\n\n');
}

function getRecordingBucket() {
  return process.env.NEXT_PUBLIC_STORAGE_BUCKET_RECORDINGS?.trim() || 'recordings';
}

function guessExtension(type: string) {
  if (type.includes('wav')) return 'wav';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('webm')) return 'webm';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('m4a')) return 'm4a';
  return 'webm';
}

export async function uploadRecordingBlob(blob: Blob): Promise<UploadedRecording> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured for this browser session.');
  }

  const bucket = getRecordingBucket();
  const ext = guessExtension(blob.type || 'audio/webm');
  const path = `recording-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || 'audio/webm',
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const signed = await supabase.storage.from(bucket).createSignedUrl(data.path, 60 * 60);
  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error || new Error('Failed to create a signed URL for the recording.');
  }

  return {
    bucket,
    path: data.path,
    signedUrl: signed.data.signedUrl,
  };
}

export async function createRecordingSignedUrl(path: string, bucket = getRecordingBucket()) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured for this browser session.');
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    throw error || new Error('Failed to create a signed URL for this clip.');
  }

  return data.signedUrl;
}

export async function transcribeRecording(fileUrl: string, path?: string, bucket?: string): Promise<TranscriptionResponse> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabase = getSupabaseBrowserClient();

  if (!base || !supabase) {
    throw new Error('Supabase is not configured for this browser session.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (sessionError || !accessToken) {
    throw new Error('You must be signed in to transcribe audio.');
  }

  const response = await fetch(`${base}/functions/v1/transcribe_audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fileUrl, path, bucket }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : null;

    if (response.status === 403) {
      throw new Error('Dictation and transcription are available on Premium, Team, and Ministry.');
    }

    if (response.status === 400) {
      throw new Error(message ?? 'The audio file could not be prepared for transcription.');
    }

    throw new Error(message ?? `Transcription failed (${response.status}).`);
  }

  const result = (await response.json()) as TranscriptionResponse;

  return {
    ...result,
    text: formatTranscriptText(result.text ?? ''),
  };
}
