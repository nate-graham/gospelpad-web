'use client';

import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export const SUPPORT_EMAIL = 'support@gospelpad.com';

export type AccountDialog = 'help' | 'feedback' | 'password' | null;

function Dialog({
  eyebrow,
  title,
  description,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="share-dialog-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="account-dialog-title"
        aria-modal="true"
        className="share-dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        role="dialog"
      >
        <header className="share-dialog-header">
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>
              {eyebrow}
            </span>
            <h2 id="account-dialog-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button aria-label="Close" className="share-dialog-close" onClick={onClose} type="button">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

/** Contact options that work whether or not the person has a mail app set up. */
function ContactDialog({ kind, email, onClose }: { kind: 'help' | 'feedback'; email?: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const subject = kind === 'help' ? 'GospelPad help' : 'GospelPad feedback';
  const body = email ? `\n\n—\nGospelPad account: ${email}` : '';
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const outlook = `https://outlook.live.com/mail/0/deeplink/compose?to=${SUPPORT_EMAIL}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog
      description={
        kind === 'help'
          ? 'Email us with any question or problem and we’ll get back to you.'
          : 'Tell us what’s working, what isn’t, and what you’d love GospelPad to do next.'
      }
      eyebrow={kind === 'help' ? 'Help and contact' : 'Send feedback'}
      onClose={onClose}
      title={kind === 'help' ? 'How can we help?' : 'We’d love to hear from you'}
    >
      <div className="contact-email">
        <span>{SUPPORT_EMAIL}</span>
        <button className="button button-secondary" onClick={() => void copy()} type="button">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="contact-actions">
        <a className="button button-primary" href={`mailto:${SUPPORT_EMAIL}?${query}`}>
          Open mail app
        </a>
        <a className="button button-secondary" href={gmail} rel="noreferrer" target="_blank">
          Gmail
        </a>
        <a className="button button-secondary" href={outlook} rel="noreferrer" target="_blank">
          Outlook
        </a>
      </div>
    </Dialog>
  );
}

/** Change the password while signed in. */
function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6) return setError('Use at least 6 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError('Couldn’t reach GospelPad. Please try again.');
    setPending(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) return setError(updateError.message);
    setDone(true);
  };

  return (
    <Dialog
      description="Choose a new password for signing in to GospelPad."
      eyebrow="Account"
      onClose={onClose}
      title="Change password"
    >
      {done ? (
        <>
          <p className="success-state status-message" role="status">
            Your password has been changed.
          </p>
          <div className="share-dialog-footer">
            <button className="button button-primary" onClick={onClose} type="button">
              Done
            </button>
          </div>
        </>
      ) : (
        <form className="account-form" onSubmit={submit} style={{ display: 'grid', gap: '1rem' }}>
          <label className="composer-field">
            <span>New password</span>
            <input autoComplete="new-password" autoFocus minLength={6} onChange={(e) => setPassword(e.target.value)} required type="password" value={password} />
          </label>
          <label className="composer-field">
            <span>Confirm new password</span>
            <input autoComplete="new-password" minLength={6} onChange={(e) => setConfirm(e.target.value)} required type="password" value={confirm} />
          </label>
          {error ? (
            <p className="error-state status-message" role="alert">
              {error}
            </p>
          ) : null}
          <div className="share-dialog-footer" style={{ gap: '0.6rem' }}>
            <button className="button button-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="button button-primary" disabled={pending} type="submit">
              {pending ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function AccountDialogs({ open, email, onClose }: { open: AccountDialog; email?: string | null; onClose: () => void }) {
  if (open === 'help' || open === 'feedback') return <ContactDialog email={email} kind={open} onClose={onClose} />;
  if (open === 'password') return <PasswordDialog onClose={onClose} />;
  return null;
}
