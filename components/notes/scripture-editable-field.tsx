'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { splitTextByScriptureReferences } from '@/lib/scripture-references';

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

function buildEditorHtml(value: string) {
  const lines = value.split('\n');

  return lines
    .map((line) =>
      splitTextByScriptureReferences(line)
        .map((segment) => {
          if (segment.type === 'reference') {
            return `<button type="button" class="scripture-ref-button" contenteditable="false" data-reference="${escapeHtml(segment.value)}">${escapeHtml(segment.value)}</button>`;
          }

          return escapeHtml(segment.value);
        })
        .join('')
    )
    .join('<br>');
}

function readPlainTextFromEditor(root: HTMLElement) {
  const chunks: string[] = [];

  const walk = (node: Node) => {
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
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n');
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

  range.insertNode(fragment);
  range.collapse(false);
  activeSelection.removeAllRanges();
  activeSelection.addRange(range);
}

export const ScriptureEditableField = forwardRef<HTMLDivElement, ScriptureEditableFieldProps>(
  function ScriptureEditableField({ value, onChange, onReferenceClick, placeholder = 'Write your note here...' }, forwardedRef) {
    const localRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(forwardedRef, () => localRef.current as HTMLDivElement, []);

    useEffect(() => {
      const root = localRef.current;
      if (!root) return;

      const currentValue = readPlainTextFromEditor(root);
      const isActive = document.activeElement === root;

      root.dataset.empty = value.trim() ? 'false' : 'true';

      if (isActive && currentValue === value) {
        return;
      }

      root.innerHTML = buildEditorHtml(value);
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
            event.preventDefault();
            insertTextIntoEditable(event.currentTarget, '\n');
            onChange(readPlainTextFromEditor(event.currentTarget));
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
            minHeight: 320,
            borderRadius: 16,
            border: '1px solid var(--line)',
            padding: '1rem',
            background: 'rgba(255,255,255,0.72)',
            color: 'var(--text)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
          suppressContentEditableWarning
        />
      </div>
    );
  }
);
