import type { NoteRecord, NoteType } from '@/lib/notes';

export const DEFAULT_NOTE_TYPE: NoteType = 'Church notes';

export function getNoteExcerpt(note: Pick<NoteRecord, 'body'>) {
  const raw = (note.body ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return 'No content yet.';
  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
}

export function formatNoteDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

