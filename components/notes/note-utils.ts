import type { NoteRecord, NoteType } from '@/lib/notes';
import { findScriptureReferences } from '@/lib/scripture-references';

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

export function getNoteWordCount(note: Pick<NoteRecord, 'body'>) {
  const words = (note.body ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.length;
}

export function getNoteReadingTimeMinutes(note: Pick<NoteRecord, 'body'>) {
  const wordCount = getNoteWordCount(note);
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function getScriptureReferenceCount(note: Pick<NoteRecord, 'body'>) {
  return findScriptureReferences(note.body ?? '').length;
}

export function getNoteTypeGuidance(type: string | null | undefined) {
  switch (type) {
    case 'Church notes':
      return 'Capture sermon points, scripture references, and speaker insights in a structure you can revisit easily.';
    case 'Study':
      return 'Use this note to follow an argument, compare passages, and keep detailed observations together.';
    case 'Journal':
      return 'Journal notes work best when you record reflection, prayer, and application clearly in your own words.';
    case 'Dream':
      return 'Dream notes benefit from immediacy. Capture symbols, sequence, tone, and interpretation questions while they are fresh.';
    default:
      return 'This note is stored in the current plain-text V1 format for reliable capture and review.';
  }
}
