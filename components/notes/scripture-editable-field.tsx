'use client';

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { splitTextByScriptureReferences } from '@/lib/scripture-references';
import { getVerseLineRanges } from '@/components/notes/scripture-reference-text';
import {
  continueList,
  formatSignature,
  parseLinePrefix,
  toggleInline,
  toggleLineKind,
  tokenizeInline,
  type Edit,
  type LineKind,
} from '@/lib/note-format';

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

function markHtml(mark: string, extra = '') {
  return `<span class="md-mark${extra}" data-mark="${escapeHtml(mark)}">${escapeHtml(mark)}</span>`;
}

function inlineHtml(text: string) {
  return tokenizeInline(text)
    .map((segment) => {
      if (segment.kind === 'text') return referencesHtml(segment.text);
      const tag = segment.kind === 'bold' ? 'strong' : 'em';
      return `${markHtml(segment.open)}<${tag}>${referencesHtml(segment.text)}</${tag}>${markHtml(segment.close)}`;
    })
    .join('');
}

/** One line of the editor: its list/heading marker (kept as text, styled) and inline formatting. */
function lineHtml(line: string) {
  const prefix = parseLinePrefix(line);
  if (!prefix) return inlineHtml(line);
  const level = prefix.kind === 'heading' ? ` md-h${prefix.marker.trim().length}` : '';
  return `<span class="md-line md-${prefix.kind}${level}">${markHtml(prefix.marker, ` md-mark-${prefix.kind}`)}${inlineHtml(prefix.rest)}</span>`;
}

function referencesHtml(line: string) {
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
  return `${JSON.stringify(getVerseLineRanges(value))}#${formatSignature(value)}`;
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

function offsetAt(root: HTMLElement, container: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(container, offset);
  const holder = document.createElement('div');
  holder.appendChild(range.cloneContents());
  // A <br> at the end of this partial copy is a real line break, not the editor's trailing one.
  return readPlainTextFromEditor(holder, true).length;
}

/** Caret position as an offset into the plain text, so it survives a re-render. */
function getCaretOffset(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0);
  return offsetAt(root, range.endContainer, range.endOffset);
}

/** The selection as plain-text offsets. */
function getSelectionOffsets(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0);
  return { start: offsetAt(root, range.startContainer, range.startOffset), end: offsetAt(root, range.endContainer, range.endOffset) };
}

function setSelectionOffsets(root: HTMLElement, start: number, end: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const from = rangeAtOffset(root, start);
  const to = start === end ? from : rangeAtOffset(root, end);
  const range = document.createRange();
  range.setStart(from.startContainer, from.startOffset);
  range.setEnd(to.startContainer, to.startOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setCaretOffset(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(rangeAtOffset(root, offset));
}

function rangeAtOffset(root: HTMLElement, offset: number) {
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
    const children = Array.from(node.childNodes);
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      // At the very end of a formatting mark, prefer the start of what follows it.
      if (child instanceof HTMLElement && child.classList.contains('md-mark') && remaining === (child.textContent?.length ?? 0)) {
        const next = children[index + 1];
        if (next) {
          remaining = 0;
          if (next.nodeType === Node.TEXT_NODE) range.setStart(next, 0);
          else if (next.firstChild?.nodeType === Node.TEXT_NODE) range.setStart(next.firstChild, 0);
          else range.setStartAfter(child);
          return true;
        }
      }
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
  return range;
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

export function readPlainTextFromEditor(root: HTMLElement, keepTrailingBreak = false) {
  const chunks: string[] = [];
  const sentinel = keepTrailingBreak ? null : trailingSentinel(root);

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

const TOOLBAR_KEY = 'gospelpad-format-toolbar';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
      {children}
    </svg>
  );
}

const LINE_TOOLS: { kind: LineKind; label: string; icon: ReactNode }[] = [
  {
    kind: 'heading',
    label: 'Heading',
    icon: (
      <Icon>
        <path d="M6 5v14M18 5v14M6 12h12" />
      </Icon>
    ),
  },
  {
    kind: 'bullet',
    label: 'Bulleted list',
    icon: (
      <Icon>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <circle cx="4.5" cy="6" fill="currentColor" r="1" />
        <circle cx="4.5" cy="12" fill="currentColor" r="1" />
        <circle cx="4.5" cy="18" fill="currentColor" r="1" />
      </Icon>
    ),
  },
  {
    kind: 'number',
    label: 'Numbered list',
    icon: (
      <Icon>
        <path d="M10 6h10M10 12h10M10 18h10M4 5h1.5v4M4 9h3M4 15.5c0-.8.7-1.5 1.5-1.5s1.5.6 1.5 1.3c0 1.2-3 1.9-3 3.7h3" />
      </Icon>
    ),
  },
  {
    kind: 'quote',
    label: 'Quote',
    icon: (
      <Icon>
        <path d="M5 6v12M10 8h9M10 12h9M10 16h6" />
      </Icon>
    ),
  },
];

export const ScriptureEditableField = forwardRef<HTMLDivElement, ScriptureEditableFieldProps>(
  function ScriptureEditableField({ value, onChange, onReferenceClick, placeholder = 'Write your note here...' }, forwardedRef) {
    const localRef = useRef<HTMLDivElement | null>(null);
    const renderedSignatureRef = useRef<string | null>(null);
    const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
    const [toolbarOpen, setToolbarOpen] = useState(true);

    useImperativeHandle(forwardedRef, () => localRef.current as HTMLDivElement, []);

    useEffect(() => {
      try {
        if (window.localStorage.getItem(TOOLBAR_KEY) === 'hidden') setToolbarOpen(false);
      } catch {
        // Storage unavailable: keep the toolbar showing.
      }
    }, []);

    const toggleToolbar = () => {
      setToolbarOpen((open) => {
        try {
          window.localStorage.setItem(TOOLBAR_KEY, open ? 'hidden' : 'shown');
        } catch {
          // Not remembered this time.
        }
        return !open;
      });
    };

    useEffect(() => {
      const root = localRef.current;
      if (!root) return;

      const currentValue = readPlainTextFromEditor(root);
      const isActive = document.activeElement === root;
      const pending = pendingSelectionRef.current;

      root.dataset.empty = value.trim() ? 'false' : 'true';

      if (isActive && currentValue === value && !pending) {
        // Typing (or inserting a verse) changed where verses or formatting are: re-render so they
        // take their styling straight away, keeping the caret where it was.
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
      if (pending) {
        pendingSelectionRef.current = null;
        root.focus();
        setSelectionOffsets(root, pending.start, pending.end);
      }
    }, [value]);

    /** Apply a formatting change made on the plain text, then put the selection back. */
    const applyEdit = (makeEdit: (current: string, selection: { start: number; end: number }) => Edit | null) => {
      const root = localRef.current;
      if (!root) return false;
      const current = readPlainTextFromEditor(root);
      const selection = getSelectionOffsets(root) ?? { start: current.length, end: current.length };
      const edit = makeEdit(current, selection);
      if (!edit) return false;
      if (edit.value === current) {
        setSelectionOffsets(root, edit.selection.start, edit.selection.end);
        return true;
      }
      pendingSelectionRef.current = edit.selection;
      onChange(edit.value);
      return true;
    };

    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && (event.key === 'b' || event.key === 'B')) {
        event.preventDefault();
        applyEdit((current, selection) => toggleInline(current, selection, '**'));
        return;
      }
      if (mod && !event.altKey && (event.key === 'i' || event.key === 'I')) {
        event.preventDefault();
        applyEdit((current, selection) => toggleInline(current, selection, '_'));
        return;
      }
      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
      event.preventDefault();
      // Enter is applied to the text and the editor re-rendered, so the caret always lands at the
      // start of the new line (Safari included). Inside a list it continues (or ends) the list.
      applyEdit((current, selection) => {
        if (!event.shiftKey && selection.start === selection.end) {
          const listEdit = continueList(current, selection.start);
          if (listEdit) return listEdit;
        }
        const next = current.slice(0, selection.start) + '\n' + current.slice(selection.end);
        return { value: next, selection: { start: selection.start + 1, end: selection.start + 1 } };
      });
    };

    // Toolbar buttons keep the editor's selection: act on mousedown and don't take focus.
    const toolProps = (action: () => void) => ({
      onMouseDown: (event: ReactMouseEvent) => {
        event.preventDefault();
        action();
      },
      onClick: (event: ReactMouseEvent) => {
        // Keyboard users (Enter/Space on the button) get a click without a mousedown.
        if (event.detail === 0) action();
      },
      type: 'button' as const,
    });

    return (
      <div className="note-editor-wrap">
        <div className={`format-bar${toolbarOpen ? '' : ' is-collapsed'}`} role="toolbar" aria-label="Formatting">
          {toolbarOpen ? (
            <>
              <button aria-label="Bold (⌘B)" className="format-button" title="Bold (⌘B)" {...toolProps(() => applyEdit((v, sel) => toggleInline(v, sel, '**')))}>
                <strong style={{ fontFamily: 'var(--font-sans)', fontSize: 15 }}>B</strong>
              </button>
              <button aria-label="Italic (⌘I)" className="format-button" title="Italic (⌘I)" {...toolProps(() => applyEdit((v, sel) => toggleInline(v, sel, '_')))}>
                <em style={{ fontFamily: 'var(--font-serif)', fontSize: 17 }}>I</em>
              </button>
              <span className="format-divider" aria-hidden="true" />
              {LINE_TOOLS.map((tool) => (
                <button
                  aria-label={tool.label}
                  className="format-button"
                  key={tool.kind}
                  title={tool.label}
                  {...toolProps(() => applyEdit((v, sel) => toggleLineKind(v, sel, tool.kind)))}
                >
                  {tool.icon}
                </button>
              ))}
            </>
          ) : null}
          <button
            aria-expanded={toolbarOpen}
            aria-label={toolbarOpen ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
            className="format-toggle"
            onClick={toggleToolbar}
            title={toolbarOpen ? 'Hide formatting' : 'Show formatting'}
            type="button"
          >
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>Aa</span>
            {toolbarOpen ? null : <span>Formatting</span>}
          </button>
        </div>
        <div
          ref={localRef}
          aria-label="Note body"
          aria-multiline="true"
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
            const root = event.currentTarget;
            // Typing into a formatting mark (e.g. just after "**"): re-render so the new text
            // takes the right style.
            const anchor = window.getSelection()?.anchorNode;
            const mark = (anchor instanceof HTMLElement ? anchor : anchor?.parentElement)?.closest('.md-mark');
            if (mark instanceof HTMLElement && mark.textContent !== mark.dataset.mark) {
              renderedSignatureRef.current = null;
            }
            onChange(readPlainTextFromEditor(root));
          }}
          onKeyDown={onKeyDown}
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
