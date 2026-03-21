'use client';

import { useEffect, useState } from 'react';

type DeleteNotesDialogProps = {
  open: boolean;
  noteCount: number;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: (hideWarningNextTime: boolean) => void;
};

export function DeleteNotesDialog({
  open,
  noteCount,
  deleting = false,
  onCancel,
  onConfirm,
}: DeleteNotesDialogProps) {
  const [hideWarningNextTime, setHideWarningNextTime] = useState(false);

  useEffect(() => {
    if (open) {
      setHideWarningNextTime(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      role="dialog"
      style={backdropStyle}
    >
      <section className="panel" style={dialogStyle}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span className="eyebrow">Delete note{noteCount === 1 ? '' : 's'}</span>
          <strong style={{ fontSize: '1.15rem' }}>
            Move {noteCount === 1 ? 'this note' : `${noteCount} notes`} to recently deleted?
          </strong>
          <span style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            You can restore {noteCount === 1 ? 'it' : 'them'} from your profile for 30 days before permanent removal.
          </span>
        </div>

        <label style={checkboxRowStyle}>
          <input
            checked={hideWarningNextTime}
            onChange={(event) => setHideWarningNextTime(event.target.checked)}
            type="checkbox"
          />
          <span>Do not show this warning again</span>
        </label>

        <div className="cta-row" style={{ justifyContent: 'flex-end' }}>
          <button className="button button-secondary" disabled={deleting} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="button button-primary" disabled={deleting} onClick={() => onConfirm(hideWarningNextTime)} type="button">
            {deleting ? 'Deleting…' : noteCount === 1 ? 'Delete note' : `Delete ${noteCount} notes`}
          </button>
        </div>
      </section>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'color-mix(in srgb, var(--background-strong) 52%, transparent)',
  display: 'grid',
  placeItems: 'center',
  padding: '1rem',
  zIndex: 80,
};

const dialogStyle: React.CSSProperties = {
  width: 'min(100%, 30rem)',
  padding: '1rem',
  display: 'grid',
  gap: '1rem',
};

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'flex-start',
  lineHeight: 1.5,
};
