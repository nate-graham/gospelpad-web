'use client';

import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { findScriptureReferences, splitTextByScriptureReferences } from '@/lib/scripture-references';
import { hasFormatting, parseLinePrefix, tokenizeInline } from '@/lib/note-format';

type TextBlock = { kind: 'text'; lines: string[] };
type VerseBlock = {
  kind: 'verse';
  reference: string;
  translation: string;
  text: string;
  /** Where the verse sits in the note's lines: [start, end), and how many leading lines are its reference. */
  lines?: { start: number; end: number; head: number };
};
type Block = TextBlock | VerseBlock;

const TRANSLATION = '([A-Za-z][A-Za-z0-9 .()\'-]{0,47}?)';
// "John 14:27 [KJV] Peace I leave with you…" (inserted from Scripture search or a preview)
const inlineVersePattern = new RegExp(`^(.+?)\\s+\\[${TRANSLATION}\\]\\s+(.+)$`);
// "John 14:27 (KJV)" or "Psalm 103:1-2 (WORLD ENGLISH BIBLE)" on its own line, verse text below
// (the format the phone app and Copy use). The translation may also be empty: "John 3:16 ()".
const headingVersePattern = /^(.+?)\s+\(([^()]{0,48})\)\s*:?\s*$/;

const TRANSLATION_ABBREVIATIONS: Record<string, string> = {
  'KING JAMES VERSION': 'KJV',
  'KING JAMES BIBLE': 'KJV',
  'AUTHORIZED KING JAMES VERSION': 'KJV',
  'WORLD ENGLISH BIBLE': 'WEB',
  'OPEN ENGLISH BIBLE': 'OEB',
  'OPEN ENGLISH BIBLE (US)': 'OEB',
  'OPEN ENGLISH BIBLE, US EDITION': 'OEB',
  'OEB-US': 'OEB',
  'NEW INTERNATIONAL VERSION': 'NIV',
  'ENGLISH STANDARD VERSION': 'ESV',
  'NEW LIVING TRANSLATION': 'NLT',
  'NEW KING JAMES VERSION': 'NKJV',
  'AMERICAN STANDARD VERSION': 'ASV',
  'BIBLE IN BASIC ENGLISH': 'BBE',
};

function shortTranslation(value: string) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const upper = cleaned.toUpperCase();
  return TRANSLATION_ABBREVIATIONS[upper] ?? (upper.length <= 8 ? upper : cleaned);
}

/**
 * The whole string is one Scripture reference (abbreviations like "Rev 13:8" or "Matt 11:28"
 * included); returns it in its full form ("Revelation 13:8"), or null.
 */
function asReference(candidate: string) {
  const trimmed = candidate.trim().replace(/[:.,;]+$/, '');
  if (!trimmed) return null;
  const segments = splitTextByScriptureReferences(trimmed);
  const references = segments.filter((segment) => segment.type === 'reference');
  const leftover = segments
    .filter((segment) => segment.type === 'text')
    .map((segment) => segment.value)
    .join('')
    .trim();
  if (references.length !== 1 || leftover) return null;
  return findScriptureReferences(references[0].value)[0] ?? references[0].value;
}

/** Splits a note body into ordinary text and verses that were inserted from Scripture. */
// Line breaks other than "\n" (carriage returns, Unicode line/paragraph separators) still show as
// new lines on screen, and pasted or app-edited text can carry invisible characters. Normalise
// both before looking for verses so what looks like a verse is treated as one.
const LINE_BREAKS = /\r\n|\r|\u2028|\u2029|\u0085/g;
const INVISIBLES = /[\u200B-\u200F\u2060\uFEFF\u00AD]/g;

export function normaliseNoteText(text: string) {
  return text.replace(LINE_BREAKS, '\n').replace(INVISIBLES, '').replace(/\u00A0/g, ' ');
}

export function splitNoteIntoBlocks(text: string): Block[] {
  const lines = normaliseNoteText(text).split('\n');
  const blocks: Block[] = [];
  let current: TextBlock | null = null;

  const pushText = (line: string) => {
    if (!current) {
      current = { kind: 'text', lines: [] };
      blocks.push(current);
    }
    current.lines.push(line);
  };

  const isBlank = (at: number) => !(lines[at] ?? '').trim();
  const numberLine = (value: string) => value.trim().match(/^(\d{1,3})$/)?.[1];
  const numberedStart = (value: string) => value.match(/^\s*(\d{1,3})\s*(?=[^\d\s:.,])/)?.[1];

  /** Verse numbers a reference covers, e.g. "Matthew 6:25-34" → 25..34. */
  const verseRange = (reference: string) => {
    const match = reference.match(/:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*$/);
    if (!match) return null;
    const from = Number(match[1]);
    return { from, to: match[2] ? Number(match[2]) : from };
  };

  /**
   * Reads the verse text that starts at `from`: consecutive lines, joining a verse number that
   * sits on its own line ("16" then "For God so loved…"), and carrying on across blank lines while
   * the next line is a later verse inside the reference's range.
   */
  const collectVerse = (from: number, reference: string) => {
    const range = verseRange(reference);
    const verseLines: string[] = [];
    let at = from;
    let lastNumber = 0;

    for (;;) {
      while (at < lines.length && !isBlank(at)) {
        const value = lines[at].trim();
        const lone = numberLine(value);
        if (lone && !isBlank(at + 1)) {
          verseLines.push(`${lone} ${lines[at + 1].trim()}`);
          lastNumber = Number(lone);
          at += 2;
          continue;
        }
        const numbered = numberedStart(value);
        if (numbered) lastNumber = Number(numbered);
        verseLines.push(value);
        at += 1;
      }

      if (!range || range.to <= range.from) break;
      let peek = at;
      while (peek < lines.length && isBlank(peek)) peek += 1;
      if (peek - at > 2 || peek >= lines.length) break;
      const nextValue = lines[peek].trim();
      const nextNumber = Number(numberedStart(nextValue) ?? numberLine(nextValue) ?? NaN);
      if (!(nextNumber > lastNumber && nextNumber <= range.to)) break;
      at = peek;
    }

    return { text: verseLines.join('\n'), next: at };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    const inline = line.match(inlineVersePattern);
    if (inline) {
      const reference = asReference(inline[1]);
      if (reference) {
        blocks.push({
          kind: 'verse',
          reference,
          translation: shortTranslation(inline[2]),
          text: inline[3].trim(),
          lines: { start: index, end: index + 1, head: 0 },
        });
        current = null;
        continue;
      }
    }

    const heading = line.match(headingVersePattern);
    if (heading && !isBlank(index + 1)) {
      const reference = asReference(heading[1]);
      if (reference) {
        const verse = collectVerse(index + 1, reference);
        blocks.push({
          kind: 'verse',
          reference,
          translation: shortTranslation(heading[2]),
          text: verse.text,
          lines: { start: index, end: verse.next, head: 1 },
        });
        current = null;
        index = verse.next - 1;
        continue;
      }
    }

    // A reference alone on a line ("Psalm 23:5" or "Rev 13:8"), optionally followed by the
    // translation on its own line ("(King James Version)"), then the verse starting with its own
    // number ("5 You prepare…", or "16" on one line and the text on the next).
    const bare = asReference(line);
    const range = bare ? verseRange(bare) : null;
    if (bare && range) {
      let at = isBlank(index + 1) && !isBlank(index + 2) ? index + 2 : index + 1;

      // "Matt 6:33" followed by "Matthew 6:33 [KJV] …": the inserted verse already names itself.
      const inlineNext = (lines[at] ?? '').match(inlineVersePattern);
      if (inlineNext && asReference(inlineNext[1])) {
        current = null;
        continue;
      }

      let translation = '';
      const translationLine = (lines[at] ?? '').trim().match(/^\(([^()]{1,48})\)$/);
      if (translationLine) {
        translation = shortTranslation(translationLine[1]);
        at += 1;
      }

      const startValue = (lines[at] ?? '').trim();
      const startNumber = numberedStart(startValue) ?? (numberLine(startValue) && !isBlank(at + 1) ? numberLine(startValue) : undefined);
      if (startNumber && Number(startNumber) === range.from) {
        const verse = collectVerse(at, bare);
        blocks.push({ kind: 'verse', reference: bare, translation, text: verse.text, lines: { start: index, end: verse.next, head: at - index } });
        current = null;
        index = verse.next - 1;
        continue;
      }
    }

    pushText(line);
  }

  // Blank lines next to a verse are spacing the verse block already provides.
  return blocks
    .map((block, blockIndex) => {
      if (block.kind !== 'text') return block;
      const lines = [...block.lines];
      if (blocks[blockIndex - 1]?.kind === 'verse') {
        while (lines.length && !lines[0].trim()) lines.shift();
      }
      if (blocks[blockIndex + 1]?.kind === 'verse') {
        while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      }
      return { ...block, lines };
    })
    .filter((block) => block.kind === 'verse' || block.lines.length > 0);
}

/** Line ranges of the verses in a note, for styling them while the note is being edited. */
export function getVerseLineRanges(text: string) {
  return splitNoteIntoBlocks(text)
    .map((block) => (block.kind === 'verse' ? block.lines : undefined))
    .filter((range): range is { start: number; end: number; head: number } => Boolean(range));
}

export function formatVerseReference(reference: string) {
  return reference.replace(/\s*:\s*/g, ' : ');
}

function References({ text, onReferenceClick }: { text: string; onReferenceClick: (reference: string) => void }) {
  return (
    <>
      {splitTextByScriptureReferences(text).map((segment, segmentIndex) =>
        segment.type === 'reference' ? (
          <button
            className="scripture-ref-button"
            key={`${segment.value}-${segmentIndex}`}
            onClick={() => onReferenceClick(segment.value)}
            type="button"
          >
            {segment.value}
          </button>
        ) : (
          <Fragment key={`${segment.value}-${segmentIndex}`}>{segment.value}</Fragment>
        )
      )}
    </>
  );
}

/** A line's text with **bold**, _italic_ and tappable references. */
function InlineText({ text, onReferenceClick }: { text: string; onReferenceClick: (reference: string) => void }) {
  return (
    <>
      {tokenizeInline(text).map((segment, index) =>
        segment.kind === 'bold' ? (
          <strong key={index}>
            <References onReferenceClick={onReferenceClick} text={segment.text} />
          </strong>
        ) : segment.kind === 'italic' ? (
          <em key={index}>
            <References onReferenceClick={onReferenceClick} text={segment.text} />
          </em>
        ) : (
          <References key={index} onReferenceClick={onReferenceClick} text={segment.text} />
        )
      )}
    </>
  );
}

function TextLines({ lines, onReferenceClick }: { lines: string[]; onReferenceClick: (reference: string) => void }) {
  // Notes without formatting keep exactly the inline rendering they had before.
  if (!hasFormatting(lines.join('\n'))) {
    return (
      <>
        {lines.map((line, lineIndex) => (
          <Fragment key={`${line}-${lineIndex}`}>
            <References onReferenceClick={onReferenceClick} text={line} />
            {lineIndex < lines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </>
    );
  }

  // Group lines into paragraphs, headings, lists and quotes.
  const out: ReactNode[] = [];
  let plain: string[] = [];
  const flushPlain = () => {
    if (!plain.length) return;
    const chunk = plain;
    plain = [];
    out.push(
      <span className="note-md-text" key={`p-${out.length}`}>
        {chunk.map((line, index) => (
          <Fragment key={index}>
            <InlineText onReferenceClick={onReferenceClick} text={line} />
            {index < chunk.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </span>
    );
  };

  for (let index = 0; index < lines.length; index += 1) {
    const prefix = parseLinePrefix(lines[index]);
    if (!prefix) {
      plain.push(lines[index]);
      continue;
    }
    // Drop the blank line the writer left right before a heading or list; spacing comes from CSS.
    if (plain.length && !plain[plain.length - 1].trim()) plain.pop();
    flushPlain();

    if (prefix.kind === 'heading') {
      out.push(
        <span className={`note-md-heading is-h${prefix.marker.trim().length}`} key={`h-${index}`} role="heading" aria-level={prefix.marker.trim().length + 1}>
          <InlineText onReferenceClick={onReferenceClick} text={prefix.rest} />
        </span>
      );
      if (!lines[index + 1]?.trim() && lines[index + 1] !== undefined) index += 1;
      continue;
    }

    const items: string[] = [];
    let start = prefix.number ?? 1;
    let cursor = index;
    while (cursor < lines.length) {
      const item = parseLinePrefix(lines[cursor]);
      if (!item || item.kind !== prefix.kind) break;
      if (cursor === index && item.number) start = item.number;
      items.push(item.rest);
      cursor += 1;
    }
    index = cursor - 1;
    if (!lines[index + 1]?.trim() && lines[index + 1] !== undefined) index += 1;

    if (prefix.kind === 'quote') {
      out.push(
        <span className="note-md-quote" key={`q-${index}`}>
          {items.map((item, itemIndex) => (
            <Fragment key={itemIndex}>
              <InlineText onReferenceClick={onReferenceClick} text={item} />
              {itemIndex < items.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </span>
      );
      continue;
    }

    const List = prefix.kind === 'number' ? 'ol' : 'ul';
    out.push(
      <List className={`note-md-list is-${prefix.kind}`} key={`l-${index}`} start={prefix.kind === 'number' ? start : undefined}>
        {items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <InlineText onReferenceClick={onReferenceClick} text={item} />
          </li>
        ))}
      </List>
    );
  }
  flushPlain();
  return <span className="note-md">{out}</span>;
}

export function ScriptureReferenceText({
  text,
  onReferenceClick,
}: {
  text: string;
  onReferenceClick: (reference: string) => void;
}) {
  const blocks = splitNoteIntoBlocks(text);

  // Plain notes keep exactly the inline rendering they had before.
  if (!blocks.some((block) => block.kind === 'verse')) {
    return <TextLines lines={normaliseNoteText(text).split('\n')} onReferenceClick={onReferenceClick} />;
  }

  return (
    <span className="note-flow">
      {blocks.map((block, blockIndex) =>
        block.kind === 'verse' ? (
          <span className="verse-callout note-verse" key={`verse-${blockIndex}`} role="figure" aria-label={`${block.reference}, ${block.translation}`}>
            <span className="verse-callout-text">
              {block.text.split('\n').map((line, lineIndex, all) => {
                const numbered = line.match(/^\s*(\d{1,3})\s*([^\d\s:.,].*)$/);
                return (
                  <Fragment key={`${lineIndex}-${line}`}>
                    {numbered ? (
                      <>
                        <sup className="verse-num">{numbered[1]}</sup>
                        {numbered[2]}
                      </>
                    ) : (
                      line
                    )}
                    {lineIndex < all.length - 1 ? <br /> : null}
                  </Fragment>
                );
              })}
            </span>
            <button className="verse-callout-ref" onClick={() => onReferenceClick(block.reference)} type="button">
              {formatVerseReference(block.reference)}
              {block.translation ? ` · ${block.translation}` : ''}
            </button>
          </span>
        ) : (
          <span className="note-flow-text" key={`text-${blockIndex}`}>
            <TextLines lines={block.lines} onReferenceClick={onReferenceClick} />
          </span>
        )
      )}
    </span>
  );
}
