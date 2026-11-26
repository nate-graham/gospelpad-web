/**
 * Light formatting for note bodies, stored as simple Markdown inside the plain text so notes stay
 * readable everywhere (the phone app, copy and share, verse detection):
 *   **bold**   _italic_   ## Heading   - bullet   1. numbered   > quote
 */

export type LineKind = 'heading' | 'bullet' | 'number' | 'quote';

export type LinePrefix = { kind: LineKind; marker: string; rest: string; number?: number };

const linePrefixPattern = /^(#{1,3} |[-*•] |\d{1,3}\. |> )/;

export function parseLinePrefix(line: string): LinePrefix | null {
  const match = line.match(linePrefixPattern);
  if (!match) return null;
  const marker = match[1];
  const rest = line.slice(marker.length);
  if (marker.startsWith('#')) return { kind: 'heading', marker, rest };
  if (marker === '> ') return { kind: 'quote', marker, rest };
  if (/^\d/.test(marker)) return { kind: 'number', marker, rest, number: Number.parseInt(marker, 10) };
  return { kind: 'bullet', marker, rest };
}

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold' | 'italic'; text: string; open: string; close: string };

// Bold: **text** (no spaces just inside the stars). Italic: _text_ not inside a word (so snake_case is safe).
const boldPattern = /\*\*([^\s*](?:[^*\n]*?[^\s*])?)\*\*/;
const italicPattern = /(^|[^\w])_([^\s_](?:[^_\n]*?[^\s_])?)_(?!\w)/;

export function tokenizeInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let rest = text;
  while (rest) {
    const bold = boldPattern.exec(rest);
    const italic = italicPattern.exec(rest);
    const italicIndex = italic ? italic.index + italic[1].length : -1;
    let index = -1;
    let length = 0;
    let segment: InlineSegment | null = null;
    if (bold && (!italic || bold.index <= italicIndex)) {
      index = bold.index;
      length = bold[0].length;
      segment = { kind: 'bold', text: bold[1], open: '**', close: '**' };
    } else if (italic) {
      index = italicIndex;
      length = italic[0].length - italic[1].length;
      segment = { kind: 'italic', text: italic[2], open: '_', close: '_' };
    }
    if (!segment) {
      segments.push({ kind: 'text', text: rest });
      break;
    }
    if (index > 0) segments.push({ kind: 'text', text: rest.slice(0, index) });
    segments.push(segment);
    rest = rest.slice(index + length);
  }
  return segments;
}

export function hasFormatting(text: string) {
  return text.split('\n').some((line) => parseLinePrefix(line) || tokenizeInline(line).some((s) => s.kind !== 'text'));
}

/** Shape of the formatting (not positions), so the editor only re-renders when it changes. */
export function formatSignature(text: string) {
  return text
    .split('\n')
    .map((line) => {
      const prefix = parseLinePrefix(line);
      const inline = tokenizeInline(prefix ? prefix.rest : line).filter((s) => s.kind !== 'text').length;
      return `${prefix?.kind ?? ''}${prefix?.kind === 'heading' ? prefix.marker.length : ''}:${inline}`;
    })
    .join('|');
}

/** Plain text with the formatting marks removed (for excerpts and link previews). */
export function stripFormatting(text: string) {
  return text
    .split('\n')
    .map((line) => {
      const prefix = parseLinePrefix(line);
      const body = prefix ? prefix.rest : line;
      return tokenizeInline(body)
        .map((segment) => segment.text)
        .join('');
    })
    .join('\n');
}

export type Selection = { start: number; end: number };
export type Edit = { value: string; selection: Selection };

/** Wrap or unwrap the selection in an inline mark (** or _). */
export function toggleInline(value: string, selection: Selection, mark: '**' | '_'): Edit {
  let { start, end } = selection;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const selected = value.slice(start, end);

  if (before.endsWith(mark) && after.startsWith(mark)) {
    return {
      value: before.slice(0, -mark.length) + selected + after.slice(mark.length),
      selection: { start: start - mark.length, end: end - mark.length },
    };
  }
  if (selected.length >= mark.length * 2 && selected.startsWith(mark) && selected.endsWith(mark)) {
    const inner = selected.slice(mark.length, -mark.length);
    return { value: before + inner + after, selection: { start, end: start + inner.length } };
  }
  if (!selected) {
    return { value: before + mark + mark + after, selection: { start: start + mark.length, end: start + mark.length } };
  }
  // Keep spaces at the edges of the selection outside the marks.
  const lead = selected.match(/^\s*/)?.[0].length ?? 0;
  const trail = selected.match(/\s*$/)?.[0].length ?? 0;
  const core = selected.slice(lead, selected.length - trail);
  if (!core) return { value, selection };
  start += lead;
  end -= trail;
  return {
    value: value.slice(0, start) + mark + core + mark + value.slice(end),
    selection: { start: start + mark.length, end: end + mark.length },
  };
}

function markerFor(kind: LineKind, index: number) {
  if (kind === 'heading') return '## ';
  if (kind === 'bullet') return '- ';
  if (kind === 'quote') return '> ';
  return `${index + 1}. `;
}

/** Turn the selected lines into (or back out of) a heading, list or quote. */
export function toggleLineKind(value: string, rawSelection: Selection, kind: LineKind): Edit {
  // A selection that starts at the end of the line above, or ends at the start of the next, is about these lines only.
  const selection = { ...rawSelection };
  if (selection.end > selection.start && value[selection.start] === '\n') selection.start += 1;
  if (selection.end > selection.start && value[selection.end - 1] === '\n') selection.end -= 1;
  const blockStart = value.lastIndexOf('\n', selection.start - 1) + 1;
  const nextBreak = value.indexOf('\n', selection.end);
  const blockEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(blockStart, blockEnd).split('\n');
  const filled = lines.filter((line) => line.trim());
  const allHave = filled.length > 0 && filled.every((line) => parseLinePrefix(line)?.kind === kind);

  let count = 0;
  const nextLines = lines.map((line) => {
    const prefix = parseLinePrefix(line);
    const bare = prefix ? prefix.rest : line;
    if (allHave) return bare;
    if (!line.trim() && lines.length > 1) return line;
    return markerFor(kind, count++) + bare;
  });

  const block = nextLines.join('\n');
  const nextValue = value.slice(0, blockStart) + block + value.slice(blockEnd);
  if (selection.start === selection.end) {
    const firstOld = lines[0].length;
    const firstNew = nextLines[0].length;
    const caret = Math.max(blockStart, selection.start + (firstNew - firstOld));
    return { value: nextValue, selection: { start: caret, end: caret } };
  }
  return { value: nextValue, selection: { start: blockStart, end: blockStart + block.length } };
}

/** Enter inside a list: continue it, or end it when the item is empty. Null when not in a list. */
export function continueList(value: string, caret: number): Edit | null {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
  const nextBreak = value.indexOf('\n', caret);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const line = value.slice(lineStart, lineEnd);
  const prefix = parseLinePrefix(line);
  if (!prefix || prefix.kind === 'heading') return null;
  if (caret < lineStart + prefix.marker.length) return null;

  if (!prefix.rest.trim()) {
    // Empty item: end the list.
    const nextValue = value.slice(0, lineStart) + value.slice(lineStart + prefix.marker.length);
    return { value: nextValue, selection: { start: lineStart, end: lineStart } };
  }

  const marker = prefix.kind === 'number' ? `${(prefix.number ?? 0) + 1}. ` : prefix.marker;
  const insert = `\n${marker}`;
  const nextValue = value.slice(0, caret) + insert + value.slice(caret);
  const position = caret + insert.length;
  return { value: nextValue, selection: { start: position, end: position } };
}
