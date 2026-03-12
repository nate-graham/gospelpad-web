'use client';

import { Fragment } from 'react';
import { splitTextByScriptureReferences } from '@/lib/scripture-references';

export function ScriptureReferenceText({
  text,
  onReferenceClick,
}: {
  text: string;
  onReferenceClick: (reference: string) => void;
}) {
  const lines = text.split('\n');

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
