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
    case 'Prayer Requests':
      return 'Prayer requests work best when you keep the request focused, track whether it is ongoing or answered, and update the outcome over time.';
    default:
      return 'Keep your note clear and easy to revisit later.';
  }
}

export function supportsSpeakerField(type: string | null | undefined) {
  return type === 'Church notes' || type === 'Study';
}

export function getNoteTypePlaceholders(type: string | null | undefined) {
  switch (type) {
    case 'Study':
      return {
        title: 'Enter study topic',
        speaker: 'Study group, teacher, or source',
        body: 'Capture observations, interpretations, and questions from your study...',
      };
    case 'Journal':
      return {
        title: 'Journal entry title',
        speaker: 'Optional source or conversation',
        body: 'Write your reflection, prayer, or personal response...',
      };
    case 'Dream':
      return {
        title: 'Dream title or summary',
        speaker: 'Optional person or source in the dream',
        body: 'Record the dream sequence, symbols, emotions, and interpretation notes while it is still fresh...',
      };
    case 'Prayer Requests':
      return {
        title: 'Prayer request title',
        speaker: 'Optional person or source connected to this request',
        body: 'Write the request, context, and any updates or answered details...',
      };
    case 'Church notes':
    default:
      return {
        title: 'Sunday service notes',
        speaker: 'Pastor, teacher, or source',
        body: 'Capture sermon points, scripture references, and takeaways...',
      };
  }
}
