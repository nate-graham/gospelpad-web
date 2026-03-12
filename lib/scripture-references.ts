const BOOKS = [
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Kings',
  '2 Kings',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',
  'Esther',
  'Job',
  'Psalm',
  'Psalms',
  'Proverbs',
  'Ecclesiastes',
  'Song of Solomon',
  'Song of Songs',
  'Isaiah',
  'Jeremiah',
  'Lamentations',
  'Ezekiel',
  'Daniel',
  'Hosea',
  'Joel',
  'Amos',
  'Obadiah',
  'Jonah',
  'Micah',
  'Nahum',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Philemon',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation',
] as const;

const escapedBooks = [...BOOKS]
  .sort((a, b) => b.length - a.length)
  .map((book) => book.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const referenceRegex = new RegExp(
  `\\b(?:${escapedBooks})\\s+\\d{1,3}:\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?\\b`,
  'g'
);

export type ScriptureTextSegment =
  | { type: 'text'; value: string }
  | { type: 'reference'; value: string };

export function findScriptureReferences(text: string) {
  const matches = text.match(referenceRegex) ?? [];
  const seen = new Set<string>();

  return matches.filter((match) => {
    const normalized = normalizeReference(match);
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

export function splitTextByScriptureReferences(text: string): ScriptureTextSegment[] {
  const segments: ScriptureTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(referenceRegex)) {
    const index = match.index ?? 0;
    const value = match[0];

    if (index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    segments.push({ type: 'reference', value: normalizeReference(value) });
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

function normalizeReference(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\s*[-–]\s*/g, '-').trim();
}
