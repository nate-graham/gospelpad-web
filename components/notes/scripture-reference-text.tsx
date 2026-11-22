'use client';

import { Fragment } from 'react';
import { findScriptureReferences, splitTextByScriptureReferences } from '@/lib/scripture-references';

type TextBlock = { kind: 'text'; lines: string[] };
type VerseBlock = { kind: 'verse'; reference: string; translation: string; text: string };
type Block = TextBlock | VerseBlock;

const TRANSLATION = '([A-Za-z][A-Za-z0-9-]{1,11})';
// "John 14:27 [KJV] Peace I leave with you…" (inserted from Scripture search or a preview)
const inlineVersePattern = new RegExp(`^(.+?)\\s+\\[${TRANSLATION}\\]\\s+(.+)$`);
// "John 14:27 (KJV)" on its own line, verse text on the lines after it
const headingVersePattern = new RegExp(`^(.+?)\\s+\\(${TRANSLATION}\\)\\s*$`);

function asReference(candidate: string) {
  const trimmed = candidate.trim();
  const found = findScriptureReferences(trimmed);
  if (found.length !== 1) return null;
  const compact = (value: string) => value.replace(/\s+/g, '').toLowerCase();
  return compact(found[0]) === compact(trimmed) ? found[0] : null;
}

/** Splits a note body into ordinary text and verses that were inserted from Scripture. */
export function splitNoteIntoBlocks(text: string): Block[] {
  const lines = text.split('\n');
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
        blocks.push({ kind: 'verse', reference, translation: inline[2].toUpperCase(), text: inline[3].trim() });
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
        blocks.push({ kind: 'verse', reference, translation: heading[2].toUpperCase(), text: verseLines.join('\n') });
        current = null;
        index = next - 1;
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
    return <TextLines lines={text.split('\n')} onReferenceClick={onReferenceClick} />;
  }

  return (
    <span className="note-flow">
      {blocks.map((block, blockIndex) =>
        block.kind === 'verse' ? (
          <span className="verse-callout note-verse" key={`verse-${blockIndex}`} role="figure" aria-label={`${block.reference}, ${block.translation}`}>
            <span className="verse-callout-text">{block.text}</span>
            <button className="verse-callout-ref" onClick={() => onReferenceClick(block.reference)} type="button">
              {formatVerseReference(block.reference)} · {block.translation}
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
