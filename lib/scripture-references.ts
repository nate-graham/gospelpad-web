const BOOK_ALIASES = [
  { canonical: 'Genesis', aliases: ['Genesis', 'Gen', 'Ge', 'Gn'] },
  { canonical: 'Exodus', aliases: ['Exodus', 'Exod', 'Exo', 'Ex'] },
  { canonical: 'Leviticus', aliases: ['Leviticus', 'Lev', 'Le', 'Lv'] },
  { canonical: 'Numbers', aliases: ['Numbers', 'Num', 'Nu', 'Nm', 'Nb'] },
  { canonical: 'Deuteronomy', aliases: ['Deuteronomy', 'Deut', 'Deu', 'Dt'] },
  { canonical: 'Joshua', aliases: ['Joshua', 'Josh', 'Jos'] },
  { canonical: 'Judges', aliases: ['Judges', 'Judg', 'Jdg', 'Jg', 'Jdgs'] },
  { canonical: 'Ruth', aliases: ['Ruth', 'Rth', 'Ru'] },
  { canonical: '1 Samuel', aliases: ['1 Samuel', '1 Sam', '1Sam', 'I Samuel', 'I Sam'] },
  { canonical: '2 Samuel', aliases: ['2 Samuel', '2 Sam', '2Sam', 'II Samuel', 'II Sam'] },
  { canonical: '1 Kings', aliases: ['1 Kings', '1 Kgs', '1Kgs', 'I Kings', 'I Kgs'] },
  { canonical: '2 Kings', aliases: ['2 Kings', '2 Kgs', '2Kgs', 'II Kings', 'II Kgs'] },
  { canonical: '1 Chronicles', aliases: ['1 Chronicles', '1 Chron', '1Chr', 'I Chronicles', 'I Chron'] },
  { canonical: '2 Chronicles', aliases: ['2 Chronicles', '2 Chron', '2Chr', 'II Chronicles', 'II Chron'] },
  { canonical: 'Ezra', aliases: ['Ezra', 'Ezr'] },
  { canonical: 'Nehemiah', aliases: ['Nehemiah', 'Neh', 'Ne'] },
  { canonical: 'Esther', aliases: ['Esther', 'Esth', 'Est'] },
  { canonical: 'Job', aliases: ['Job'] },
  { canonical: 'Psalm', aliases: ['Psalm', 'Psalms', 'Ps', 'Psa', 'Psm', 'Pss'] },
  { canonical: 'Proverbs', aliases: ['Proverbs', 'Prov', 'Pro', 'Prv', 'Pr'] },
  { canonical: 'Ecclesiastes', aliases: ['Ecclesiastes', 'Eccles', 'Eccle', 'Ecc', 'Ec'] },
  { canonical: 'Song of Solomon', aliases: ['Song of Solomon', 'Song of Songs', 'Song', 'SOS', 'So'] },
  { canonical: 'Isaiah', aliases: ['Isaiah', 'Isa', 'Is'] },
  { canonical: 'Jeremiah', aliases: ['Jeremiah', 'Jer', 'Je', 'Jr'] },
  { canonical: 'Lamentations', aliases: ['Lamentations', 'Lam', 'La'] },
  { canonical: 'Ezekiel', aliases: ['Ezekiel', 'Ezek', 'Eze', 'Ezk'] },
  { canonical: 'Daniel', aliases: ['Daniel', 'Dan', 'Da', 'Dn'] },
  { canonical: 'Hosea', aliases: ['Hosea', 'Hos', 'Ho'] },
  { canonical: 'Joel', aliases: ['Joel', 'Joe', 'Jl'] },
  { canonical: 'Amos', aliases: ['Amos', 'Am'] },
  { canonical: 'Obadiah', aliases: ['Obadiah', 'Obad', 'Ob'] },
  { canonical: 'Jonah', aliases: ['Jonah', 'Jon', 'Jnh'] },
  { canonical: 'Micah', aliases: ['Micah', 'Mic', 'Mc'] },
  { canonical: 'Nahum', aliases: ['Nahum', 'Nah', 'Na'] },
  { canonical: 'Habakkuk', aliases: ['Habakkuk', 'Hab', 'Hb'] },
  { canonical: 'Zephaniah', aliases: ['Zephaniah', 'Zeph', 'Zep', 'Zp'] },
  { canonical: 'Haggai', aliases: ['Haggai', 'Hag', 'Hg'] },
  { canonical: 'Zechariah', aliases: ['Zechariah', 'Zech', 'Zec', 'Zc'] },
  { canonical: 'Malachi', aliases: ['Malachi', 'Mal', 'Ml'] },
  { canonical: 'Matthew', aliases: ['Matthew', 'Matt', 'Mat', 'Mt'] },
  { canonical: 'Mark', aliases: ['Mark', 'Mrk', 'Mar', 'Mk', 'Mr'] },
  { canonical: 'Luke', aliases: ['Luke', 'Luk', 'Lk'] },
  { canonical: 'John', aliases: ['John', 'Jn', 'Jhn'] },
  { canonical: 'Acts', aliases: ['Acts', 'Act', 'Ac'] },
  { canonical: 'Romans', aliases: ['Romans', 'Rom', 'Ro', 'Rm'] },
  { canonical: '1 Corinthians', aliases: ['1 Corinthians', '1 Cor', '1Cor', 'I Corinthians', 'I Cor'] },
  { canonical: '2 Corinthians', aliases: ['2 Corinthians', '2 Cor', '2Cor', 'II Corinthians', 'II Cor'] },
  { canonical: 'Galatians', aliases: ['Galatians', 'Gal', 'Ga'] },
  { canonical: 'Ephesians', aliases: ['Ephesians', 'Eph', 'Ep'] },
  { canonical: 'Philippians', aliases: ['Philippians', 'Phil', 'Php', 'Pp'] },
  { canonical: 'Colossians', aliases: ['Colossians', 'Col', 'Co'] },
  { canonical: '1 Thessalonians', aliases: ['1 Thessalonians', '1 Thess', '1Thess', 'I Thessalonians', 'I Thess'] },
  { canonical: '2 Thessalonians', aliases: ['2 Thessalonians', '2 Thess', '2Thess', 'II Thessalonians', 'II Thess'] },
  { canonical: '1 Timothy', aliases: ['1 Timothy', '1 Tim', '1Tim', 'I Timothy', 'I Tim'] },
  { canonical: '2 Timothy', aliases: ['2 Timothy', '2 Tim', '2Tim', 'II Timothy', 'II Tim'] },
  { canonical: 'Titus', aliases: ['Titus', 'Tit', 'Ti'] },
  { canonical: 'Philemon', aliases: ['Philemon', 'Philem', 'Phm', 'Pm'] },
  { canonical: 'Hebrews', aliases: ['Hebrews', 'Heb'] },
  { canonical: 'James', aliases: ['James', 'Jas', 'Jm'] },
  { canonical: '1 Peter', aliases: ['1 Peter', '1 Pet', '1Pet', 'I Peter', 'I Pet'] },
  { canonical: '2 Peter', aliases: ['2 Peter', '2 Pet', '2Pet', 'II Peter', 'II Pet'] },
  { canonical: '1 John', aliases: ['1 John', '1 Jn', '1Jn', 'I John', 'I Jn'] },
  { canonical: '2 John', aliases: ['2 John', '2 Jn', '2Jn', 'II John', 'II Jn'] },
  { canonical: '3 John', aliases: ['3 John', '3 Jn', '3Jn', 'III John', 'III Jn'] },
  { canonical: 'Jude', aliases: ['Jude', 'Jud'] },
  { canonical: 'Revelation', aliases: ['Revelation', 'Rev', 'Re', 'The Revelation'] },
] as const;

const aliasMap = new Map<string, string>();

for (const book of BOOK_ALIASES) {
  for (const alias of book.aliases) {
    aliasMap.set(alias.toLowerCase(), book.canonical);
  }
}

const escapedAliases = [...aliasMap.keys()]
  .sort((a, b) => b.length - a.length)
  .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

const referenceRegex = new RegExp(
  `\\b(${escapedAliases})\\s+(\\d{1,3}:\\d{1,3}(?:\\s*[-–]\\s*\\d{1,3})?)\\b`,
  'gi'
);

export type ScriptureTextSegment =
  | { type: 'text'; value: string }
  | { type: 'reference'; value: string };

export function findScriptureReferences(text: string) {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const match of text.matchAll(referenceRegex)) {
    const normalized = normalizeReference(match[0]);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    results.push(normalized);
  }

  return results;
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
  const collapsed = value.replace(/\s+/g, ' ').replace(/\s*[-–]\s*/g, '-').trim();
  const match = collapsed.match(/^(.+?)\s+(\d{1,3}:\d{1,3}(?:-\d{1,3})?)$/i);

  if (!match) {
    return collapsed;
  }

  const [, rawBook, versePart] = match;
  const canonicalBook = aliasMap.get(rawBook.toLowerCase()) ?? rawBook;

  return `${canonicalBook} ${versePart}`;
}
