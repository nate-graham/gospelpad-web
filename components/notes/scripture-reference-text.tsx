'use client';

import { Fragment } from 'react';
import { findScriptureReferences, splitTextByScriptureReferences } from '@/lib/scripture-references';

type TextBlock = { kind: 'text'; lines: string[] };
type VerseBlock = { kind: 'verse'; reference: string; translation: string; text: string };
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

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    const inline = line.match(inlineVersePattern);
    if (inline) {
      const reference = asReference(inline[1]);
      if (reference) {
        blocks.push({ kind: 'verse', reference, translation: shortTranslation(inline[2]), text: inline[3].trim() });
        current = null;
        continue;
      }
    }

    const heading = line.match(headingVersePattern);
    if (heading && (lines[index + 1] ?? '').trim()) {
      const reference = asReference(heading[1]);
      if (reference) {
        const verseLines: string[] = [];
        let next = index + 1;
        while (next < lines.length && lines[next].trim()) {
          verseLines.push(lines[next].trim());
          next += 1;
        }
        blocks.push({ kind: 'verse', reference, translation: shortTranslation(heading[2]), text: verseLines.join('\n') });
        current = null;
        index = next - 1;
        continue;
      }
    }

    // "Psalm 23:5" alone on a line, then the verse starting with its own number ("5 You prepare…").
    const bare = asReference(line);
    const firstVerse = bare?.match(/:\s*(\d{1,3})/)?.[1];
    const verseStart = !(lines[index + 1] ?? '').trim() && (lines[index + 2] ?? '').trim() ? index + 2 : index + 1;
    const nextLine = lines[verseStart] ?? '';
    const nextNumber = nextLine.match(/^\s*(\d{1,3})\s*(?=[^\d\s:.,])/)?.[1];
    if (bare && firstVerse && nextNumber && Number(nextNumber) === Number(firstVerse)) {
      const verseLines: string[] = [];
      let next = verseStart;
      while (next < lines.length && lines[next].trim()) {
        verseLines.push(lines[next].trim());
        next += 1;
      }
      blocks.push({ kind: 'verse', reference: bare, translation: '', text: verseLines.join('\n') });
      current = null;
      index = next - 1;
      continue;
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

export function formatVerseReference(reference: string) {
  return reference.replace(/\s*:\s*/g, ' : ');
}

function TextLines({ lines, onReferenceClick }: { lines: string[]; onReferenceClick: (reference: string) => void }) {
  return (
    <>
      {lines.map((line, lineIndex) => (
        <Fragment key={`${line}-${lineIndex}`}>
          {splitTextByScriptureReferences(line).map((segment, segmentIndex) =>
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
          {lineIndex < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </>
  );
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
