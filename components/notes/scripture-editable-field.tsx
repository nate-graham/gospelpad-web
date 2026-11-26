'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { splitTextByScriptureReferences } from '@/lib/scripture-references';
import { getVerseLineRanges } from '@/components/notes/scripture-reference-text';

type ScriptureEditableFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onReferenceClick: (reference: string) => void;
  placeholder?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function lineHtml(line: string) {
  return splitTextByScriptureReferences(line)
    .map((segment) => {
      if (segment.type === 'reference') {
        return `<span class="scripture-ref-button" data-reference="${escapeHtml(segment.value)}" role="link">${escapeHtml(segment.value)}</span>`;
      }

      return escapeHtml(segment.value);
    })
    .join('');
}

/** Identifies where verses sit, so the editor only re-renders when that changes. */
function verseSignature(value: string) {
  return JSON.stringify(getVerseLineRanges(value));
}

/**
 * Builds the editor's HTML: one line per "\n", with verses inserted from Scripture wrapped so they
 * show as they will once saved (indented, italic, a lapis rule on the left). The wrapper adds no
 * text, so the plain text read back out is unchanged.
 */
function buildEditorHtml(value: string) {
  const lines = value.split('\n');
  const ranges = getVerseLineRanges(value);
  const parts: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const range = ranges.find((candidate) => candidate.start === index);
    if (range && range.end > range.start) {
      const inner = lines
        .slice(range.start, range.end)
        .map((line, offset) =>
          offset < range.head && line.trim()
            ? `<span class="editor-verse-ref">${lineHtml(line)}</span>`
            : lineHtml(line)
        )
        .join('<br>');
      parts.push(`<span class="editor-verse">${inner}</span>`);
      index = range.end;
      continue;
    }
    parts.push(lineHtml(lines[index]));
    index += 1;
  }

  return parts.join('<br>') + (value.endsWith('\n') ? '<br>' : '');
}

/** Enter at the very end of a verse starts the next line outside it, not inside the verse. */
function leaveVerseAtEnd(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return;
  const anchor = selection.anchorNode;
  const verse = (anchor instanceof HTMLElement ? anchor : anchor?.parentElement)?.closest('.editor-verse');
  if (!verse || !root.contains(verse)) return;
  const after = document.createRange();
  after.selectNodeContents(verse);
  after.setStart(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset);
  if (after.toString().length > 0) return;
  const outside = document.createRange();
  outside.setStartAfter(verse);
  outside.collapse(true);
  selection.removeAllRanges();
  selection.addRange(outside);
}

/** Caret position as an offset into the plain text, so it survives a re-render. */
function getCaretOffset(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset);
  const holder = document.createElement('div');
  holder.appendChild(range.cloneContents());
  return readPlainTextFromEditor(holder).length;
}

function setCaretOffset(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  let remaining = offset;
  const range = document.createRange();

  const place = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(node, remaining);
        return true;
      }
      remaining -= length;
      return false;
    }
    if (!(node instanceof HTMLElement)) return false;
    if (node.tagName === 'BR') {
      if (remaining === 0) {
        range.setStartBefore(node);
        return true;
      }
      remaining -= 1;
      if (remaining === 0) {
        const next = node.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE) range.setStart(next, 0);
        else range.setStartAfter(node);
        return true;
      }
      return false;
    }
    if (node.dataset.reference) {
      const length = node.dataset.reference.length;
      if (remaining <= length) {
        if (remaining === length) range.setStartAfter(node);
        else if (node.firstChild) range.setStart(node.firstChild, remaining);
        else range.setStartAfter(node);
        return true;
      }
      remaining -= length;
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (place(child)) return true;
    }
    return false;
  };

  if (!place(root)) {
    range.selectNodeContents(root);
    range.collapse(false);
  } else {
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * A line break at the very end of a contenteditable doesn't show (or hold the caret) unless a
 * second one follows it, so the editor keeps one extra trailing <br> that isn't part of the text.
 */
function trailingSentinel(root: HTMLElement) {
  let node: Node | null = root.lastChild;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '')) {
      node = node.previousSibling;
      continue;
    }
    if (node instanceof HTMLElement && node.tagName !== 'BR' && !node.dataset.reference && node.lastChild) {
      node = node.lastChild;
      continue;
    }
    break;
  }
  return node instanceof HTMLElement && node.tagName === 'BR' ? node : null;
}

export function readPlainTextFromEditor(root: HTMLElement) {
  const chunks: string[] = [];
  const sentinel = trailingSentinel(root);

  const walk = (node: Node) => {
    if (node === sentinel) return;
    if (node.nodeType === Node.TEXT_NODE) {
      chunks.push(node.textContent ?? '');
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.tagName === 'BR') {
      chunks.push('\n');
      return;
    }

    if (node.dataset.reference) {
      chunks.push(node.dataset.reference);
      return;
    }

    const startsBlock = node !== root && ['DIV', 'P'].includes(node.tagName);
    if (startsBlock && chunks.length > 0 && !chunks[chunks.length - 1]?.endsWith('\n')) {
      chunks.push('\n');
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }

    if (startsBlock && !chunks[chunks.length - 1]?.endsWith('\n')) {
      chunks.push('\n');
    }
  };

  walk(root);

  return chunks
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n');
}

function isSelectionInside(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.anchorNode) return false;
  return root.contains(selection.anchorNode);
}

function placeCaretAtEnd(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** After a line break, make sure the caret sits on the new line (inside the next text, or before the trailing <br>). */
function ensureCaretOnNewLine(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  if (!root.contains(container) || container.nodeType === Node.TEXT_NODE) return;
  const before = container.childNodes[range.startOffset - 1];
  const after = container.childNodes[range.startOffset];
  if (!(before instanceof HTMLElement) || before.tagName !== 'BR') return;
  const next = document.createRange();
  if (after && after.nodeType === Node.TEXT_NODE) {
    next.setStart(after, 0);
  } else if (!after) {
    // Nothing after the new line yet: it needs a trailing <br> to show and hold the caret.
    const sentinel = document.createElement('br');
    container.appendChild(sentinel);
    next.setStartBefore(sentinel);
  } else {
    return;
  }
  next.collapse(true);
  selection.removeAllRanges();
  selection.addRange(next);
}

export function insertTextIntoEditable(root: HTMLElement, text: string) {
  const selection = window.getSelection();
  const lines = text.split('\n');

  if (!selection || selection.rangeCount === 0 || !isSelectionInside(root)) {
    root.focus();
    placeCaretAtEnd(root);
  }

  const activeSelection = window.getSelection();
  if (!activeSelection || activeSelection.rangeCount === 0) {
    root.textContent = `${root.textContent ?? ''}${text}`;
    return;
  }

  const range = activeSelection.getRangeAt(0);
  range.deleteContents();

  const fragment = document.createDocumentFragment();

  lines.forEach((line, index) => {
    if (index > 0) {
      fragment.appendChild(document.createElement('br'));
    }
    if (line.length > 0) {
      fragment.appendChild(document.createTextNode(line));
    }
  });

  const lastInserted = fragment.lastChild;
  range.insertNode(fragment);
  range.collapse(false);

  // Ending on a new line with nothing after it: add the trailing <br> that lets the line show.
  if (lastInserted instanceof HTMLElement && lastInserted.tagName === 'BR') {
    const rest = document.createRange();
    rest.selectNodeContents(root);
    rest.setStartAfter(lastInserted);
    const holder = document.createElement('div');
    holder.appendChild(rest.cloneContents());
    if (!holder.textContent && !holder.querySelector('br')) {
      root.appendChild(document.createElement('br'));
      range.setStartAfter(lastInserted);
      range.collapse(true);
    }
  }

  activeSelection.removeAllRanges();
  activeSelection.addRange(range);
}

export const ScriptureEditableField = forwardRef<HTMLDivElement, ScriptureEditableFieldProps>(
  function ScriptureEditableField({ value, onChange, onReferenceClick, placeholder = 'Write your note here...' }, forwardedRef) {
    const localRef = useRef<HTMLDivElement | null>(null);
    const renderedSignatureRef = useRef<string | null>(null);

    useImperativeHandle(forwardedRef, () => localRef.current as HTMLDivElement, []);

    useEffect(() => {
      const root = localRef.current;
      if (!root) return;

      const currentValue = readPlainTextFromEditor(root);
      const isActive = document.activeElement === root;

      root.dataset.empty = value.trim() ? 'false' : 'true';

      if (isActive && currentValue === value) {
        // Typing (or inserting a verse) changed where verses are: re-render so they take their
        // verse styling straight away, keeping the caret where it was.
        const signature = verseSignature(value);
        if (signature === renderedSignatureRef.current) return;
        const caret = getCaretOffset(root);
        root.innerHTML = buildEditorHtml(value);
        renderedSignatureRef.current = signature;
        if (caret !== null) setCaretOffset(root, caret);
        return;
      }

      root.innerHTML = buildEditorHtml(value);
      renderedSignatureRef.current = verseSignature(value);
    }, [value]);

    return (
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        <div
          ref={localRef}
          aria-label="Note body"
          className="scripture-editor"
          contentEditable
          data-empty={value.trim() ? 'false' : 'true'}
          data-placeholder={placeholder}
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            const reference = target?.dataset.reference;
            if (!reference) return;
            event.preventDefault();
            onReferenceClick(reference);
          }}
          onInput={(event) => {
            const nextValue = readPlainTextFromEditor(event.currentTarget);
            onChange(nextValue);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            const root = event.currentTarget;
            leaveVerseAtEnd(root);
            // The browser's own line break moves the caret onto the new line reliably (Safari
            // included); fall back to inserting the <br> ourselves if it isn't supported.
            const handled = typeof document.execCommand === 'function' && document.execCommand('insertLineBreak');
            if (!handled) insertTextIntoEditable(root, '\n');
            ensureCaretOnNewLine(root);
            onChange(readPlainTextFromEditor(root));
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData('text/plain');
            insertTextIntoEditable(event.currentTarget, pasted);
            onChange(readPlainTextFromEditor(event.currentTarget));
          }}
          role="textbox"
          spellCheck
          style={{
            minHeight: 420,
            borderRadius: 0,
            border: 0,
            padding: '0 0 1.2rem',
            background: 'transparent',
            color: 'var(--text)',
            lineHeight: 1.8,
            fontSize: '1.14rem',
            fontFamily: 'var(--font-serif)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
          suppressContentEditableWarning
        />
      </div>
    );
  }
);
