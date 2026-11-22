import { createNote, listNotes, updateNote, type NoteRecord } from '@/lib/notes';

/**
 * Berea studies are stored as ordinary GospelPad notes (type "Study"), so they
 * need no database change and still read sensibly in the mobile app. The body is
 * plain text with "== Section ==" headings that this module writes and reads back.
 */

export const BEREA_MARKER = 'Berea study';
export const BEREA_SPEAKER = 'Berea';

export type BereaStage = 'observe' | 'interpret' | 'apply';

export type BereaStudy = {
  reference: string;
  translation: string;
  passage: string;
  observe: string;
  interpret: string;
  apply: string;
  prayer: string;
  related: string[];
  sourceNoteId: string | null;
  sourceTitle: string | null;
};

export const BEREA_STAGES: Array<{
  key: BereaStage;
  numeral: string;
  title: string;
  question: string;
  prompts: string[];
  placeholder: string;
}> = [
  {
    key: 'observe',
    numeral: 'I',
    title: 'Observe',
    question: 'What does it say?',
    prompts: [
      'Who is speaking, and to whom?',
      'What happens, and in what order?',
      'Where and when does it take place?',
      'Which words or ideas repeat?',
    ],
    placeholder: 'Write only what is actually on the page…',
  },
  {
    key: 'interpret',
    numeral: 'II',
    title: 'Interpret',
    question: 'What does it mean?',
    prompts: [
      'What did it mean to its first hearers?',
      'What does it show about God — his character and ways?',
      'How does it fit the whole story of Scripture?',
      'Is there a promise, command, warning, or example?',
    ],
    placeholder: 'Test it against the text and the wider Scripture…',
  },
  {
    key: 'apply',
    numeral: 'III',
    title: 'Apply',
    question: 'What must change in me?',
    prompts: [
      'What is God asking me to believe or do?',
      'A sin to confess? A habit to form? A step to take?',
      'How will today look different because of this?',
    ],
    placeholder: 'One honest, specific response…',
  },
];

const SECTION_KEYS: Record<string, keyof BereaStudy> = {
  passage: 'passage',
  observe: 'observe',
  interpret: 'interpret',
  apply: 'apply',
  prayer: 'prayer',
  related: 'related',
};

export function emptyBereaStudy(reference = ''): BereaStudy {
  return {
    reference,
    translation: 'KJV',
    passage: '',
    observe: '',
    interpret: '',
    apply: '',
    prayer: '',
    related: [],
    sourceNoteId: null,
    sourceTitle: null,
  };
}

export function isBereaNote(note: Pick<NoteRecord, 'body' | 'type'> | null | undefined) {
  if (!note) return false;
  return (note.body ?? '').trimStart().startsWith(BEREA_MARKER);
}

export function serializeBereaStudy(study: BereaStudy) {
  const lines: string[] = [`${BEREA_MARKER} · ${study.reference.trim() || 'Untitled passage'}`];

  if (study.sourceTitle || study.sourceNoteId) {
    lines.push(`From: ${study.sourceTitle ?? 'a note'}${study.sourceNoteId ? ` [${study.sourceNoteId}]` : ''}`);
  }

  const section = (heading: string, value: string) => {
    lines.push('', `== ${heading} ==`, value.trim());
  };

  section(`Passage (${study.translation || 'KJV'})`, study.passage);
  section('Observe · What does it say?', study.observe);
  section('Interpret · What does it mean?', study.interpret);
  section('Apply · What must change in me?', study.apply);
  section('Prayer', study.prayer);
  section('Related Scripture', study.related.map((reference) => `- ${reference}`).join('\n'));

  return `${lines.join('\n').trimEnd()}\n`;
}

export function parseBereaStudy(note: Pick<NoteRecord, 'title' | 'body'>): BereaStudy {
  const study = emptyBereaStudy(note.title ?? '');
  const body = note.body ?? '';
  const lines = body.split(/\r?\n/);

  const firstLine = lines[0] ?? '';
  const markerMatch = firstLine.match(/^Berea study\s*·\s*(.+)$/);
  if (markerMatch && markerMatch[1] && markerMatch[1] !== 'Untitled passage') {
    study.reference = markerMatch[1].trim();
  }

  let current: keyof BereaStudy | null = null;
  const buffers: Partial<Record<keyof BereaStudy, string[]>> = {};

  for (const line of lines.slice(1)) {
    const heading = line.match(/^==\s*(.+?)\s*==\s*$/);
    if (heading) {
      const label = heading[1];
      const key = label.split(/[\s·(]/)[0]?.toLowerCase() ?? '';
      current = SECTION_KEYS[key] ?? null;
      if (current === 'passage') {
        const translation = label.match(/\(([^)]+)\)/)?.[1];
        if (translation) study.translation = translation.trim();
      }
      if (current) buffers[current] = [];
      continue;
    }

    if (!current) {
      const from = line.match(/^From:\s*(.*?)(?:\s*\[([^\]]+)\])?\s*$/);
      if (from) {
        study.sourceTitle = from[1]?.trim() || null;
        study.sourceNoteId = from[2]?.trim() || null;
      }
      continue;
    }

    buffers[current]?.push(line);
  }

  const text = (key: keyof BereaStudy) => (buffers[key] ?? []).join('\n').trim();

  study.passage = text('passage');
  study.observe = text('observe');
  study.interpret = text('interpret');
  study.apply = text('apply');
  study.prayer = text('prayer');
  study.related = text('related')
    .split('\n')
    .map((line) => line.replace(/^\s*[-•]\s*/, '').trim())
    .filter(Boolean);

  return study;
}

export function getBereaProgress(study: BereaStudy) {
  return {
    observe: Boolean(study.observe.trim()),
    interpret: Boolean(study.interpret.trim()),
    apply: Boolean(study.apply.trim()),
  };
}

function toNoteInput(study: BereaStudy) {
  return {
    title: study.reference.trim() || 'Untitled passage',
    body: serializeBereaStudy(study),
    speaker: BEREA_SPEAKER,
    type: 'Study' as const,
  };
}

export async function createBereaStudy(study: BereaStudy) {
  return createNote(toNoteInput(study));
}

export async function saveBereaStudy(noteId: string, study: BereaStudy) {
  await updateNote(noteId, toNoteInput(study));
}

export async function listBereaStudies() {
  const notes = await listNotes({ type: 'Study', sort: 'updated-desc' });
  return notes.filter((note) => isBereaNote(note));
}

export function bereaHrefForReference(reference: string, from?: { id: string; title?: string | null }) {
  const params = new URLSearchParams({ ref: reference });
  if (from?.id) params.set('from', from.id);
  return `/berea/new?${params.toString()}`;
}
