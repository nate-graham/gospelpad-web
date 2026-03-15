'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties, FormEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import { createGroupNote, updateGroupNote, type GroupNativeNoteSummary } from '@/lib/groups';
import { getNoteWordCount, getScriptureReferenceCount } from '@/components/notes/note-utils';
import { ScriptureEditableField, insertTextIntoEditable } from '@/components/notes/scripture-editable-field';
import { findScriptureReferences } from '@/lib/scripture-references';
import { ScriptureReferencePreview } from '@/components/notes/scripture-reference-preview';

type GroupNoteFormProps = {
  groupId: string;
  mode: 'create' | 'edit';
  note?: GroupNativeNoteSummary | null;
};

export function GroupNoteForm({ groupId, mode, note }: GroupNoteFormProps) {
  const router = useRouter();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const references = useMemo(() => findScriptureReferences(body), [body]);
  const wordCount = useMemo(() => getNoteWordCount({ body } as { body: string }), [body]);
  const scriptureCount = useMemo(() => getScriptureReferenceCount({ body } as { body: string }), [body]);

  const insertScripture = (payload: string) => {
    const editor = bodyRef.current;
    if (!editor) {
      setBody((current) => (current ? `${current.trimEnd()}\n\n${payload}` : payload));
      return;
    }

    insertTextIntoEditable(editor, body.trim() ? `\n\n${payload}` : payload);
    setBody(editor.innerText.replace(/\u00a0/g, ' ').trimEnd());
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      if (mode === 'create') {
        const created = await createGroupNote({
          groupId,
          title,
          body,
        });
        router.replace(`/groups/${groupId}/notes/${created.id}`);
        return;
      }

      if (!note?.id) {
        throw new Error('This group note could not be loaded for editing.');
      }

      await updateGroupNote(note.id, { title, body });
      router.replace(`/groups/${groupId}/notes/${note.id}?updated=1`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save group note.');
      setPending(false);
    }
  };

  return (
    <div className="page-section">
      <header className="page-header">
        <span className="eyebrow">{mode === 'create' ? 'Group note' : 'Edit group note'}</span>
        <h1>{mode === 'create' ? 'Capture a group note' : 'Update group note'}</h1>
        <p className="page-description">
          This uses the dedicated `group_notes` lifecycle already present in the mobile product, while keeping the same scripture-aware editing model already used on the web.
        </p>
      </header>

      <section className="responsive-grid compact">
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Content length</span>
          <strong style={{ fontSize: '1.15rem' }}>{wordCount} words</strong>
          <span style={{ color: 'var(--muted)' }}>
            {scriptureCount === 0 ? 'No scripture references detected yet.' : `${scriptureCount} scripture reference${scriptureCount === 1 ? '' : 's'} detected.`}
          </span>
        </article>
        <article className="status-card" style={{ padding: '1rem' }}>
          <span className="eyebrow">Lifecycle</span>
          <strong style={{ fontSize: '1.15rem' }}>{mode === 'create' ? 'New group note' : 'Existing group note'}</strong>
          <span style={{ color: 'var(--muted)' }}>
            Dedicated group notes stay separate from personal notes and shared personal notes.
          </span>
        </article>
      </section>

      {error ? <section className="error-state status-message" role="alert">{error}</section> : null}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          <label style={fieldStyle}>
            <span className="eyebrow" style={labelTextStyle}>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Group session title"
              required
              style={inputStyle}
            />
          </label>

          {references.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              <span className="eyebrow">Detected references in this note</span>
              <div className="cta-row">
                {references.map((reference) => (
                  <button
                    className="button button-secondary"
                    key={reference}
                    onClick={() => setActiveReference(reference)}
                    type="button"
                  >
                    {reference}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeReference ? (
            <ScriptureReferencePreview
              reference={activeReference}
              onInsert={insertScripture}
              onClose={() => setActiveReference(null)}
            />
          ) : null}

          <label style={fieldStyle}>
            <span className="eyebrow" style={labelTextStyle}>Body</span>
            <ScriptureEditableField
              ref={bodyRef}
              value={body}
              onChange={setBody}
              onReferenceClick={setActiveReference}
              placeholder="Capture the key moments, scripture, and discussion from this group session..."
            />
          </label>
        </section>

        <div className="cta-row">
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? (mode === 'create' ? 'Saving…' : 'Updating…') : mode === 'create' ? 'Save group note' : 'Update group note'}
          </button>
          <Link className="button button-secondary" href={mode === 'create' ? `/groups/${groupId}` : `/groups/${groupId}/notes/${note?.id}`}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '0.45rem',
};

const labelTextStyle: CSSProperties = {
  fontSize: '0.72rem',
};

const inputStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid var(--line)',
  padding: '0.85rem 1rem',
  background: 'rgba(255,255,255,0.72)',
  color: 'var(--text)',
};
