'use client';

import { useEffect, useState } from 'react';
import {
  assignBereaSeat,
  BEREA_SEAT_PRICE,
  getBereaSeatBillingInterval,
  getMyBereaSeats,
  leaveBereaSeat,
  revokeBereaSeat,
  setBereaSeatCount,
  type BereaSeatSummary,
} from '@/lib/berea-seats';
import { searchShareableProfiles, type ShareableProfile } from '@/lib/notes';

const profileLabel = (profile: ShareableProfile) =>
  profile.display_name?.trim() || profile.name?.trim() || profile.username?.trim() || 'GospelPad member';

/**
 * Berea seats in Settings. Team and Ministry owners buy seats and give them to anyone with a
 * GospelPad account; a person holding a seat sees who gave it and can hand it back.
 */
export function BereaSeatsSection() {
  const [billingInterval, setBillingInterval] = useState<'month' | 'year' | null>(null);
  const [billingNote, setBillingNote] = useState<string | null>(null);
  const [summary, setSummary] = useState<BereaSeatSummary | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [desired, setDesired] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ShareableProfile[]>([]);

  const load = async () => {
    try {
      const next = await getMyBereaSeats();
      setSummary(next);
      setDesired(next.seatCount);
      if (next.canManage && !next.billingInterval) {
        getBereaSeatBillingInterval()
          .then(setBillingInterval)
          .catch((intervalError) => setBillingNote(intervalError instanceof Error ? intervalError.message : null));
      }
    } catch {
      // Seats aren't set up on this database yet: leave the section out.
      setUnavailable(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!summary?.canManage || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      searchShareableProfiles(query)
        .then((found) => active && setResults(found.slice(0, 6)))
        .catch(() => active && setResults([]));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, summary?.canManage]);

  if (unavailable || !summary) return null;
  if (!summary.canManage && !summary.heldFrom) return null;

  const run = async (key: string, action: () => Promise<void>, done: string) => {
    try {
      setBusy(key);
      setError(null);
      setNotice(null);
      await action();
      await load();
      setNotice(done);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  if (!summary.canManage && summary.heldFrom) {
    return (
      <section className="account-section">
        <span className="rail-heading">Berea seat</span>
        <p className="seat-held">
          {summary.heldFrom.active
            ? `${summary.heldFrom.ownerName} has given you a Berea seat, so you can use Berea.`
            : `${summary.heldFrom.ownerName} gave you a Berea seat, but it isn’t active right now. Ask them to check their seats.`}
        </p>
        <div className="account-actions">
          <button
            className="button button-secondary"
            disabled={busy === 'leave'}
            onClick={() => {
              if (window.confirm('Give your Berea seat back? You’ll lose access to Berea unless you’re on a paid plan.')) {
                void run('leave', leaveBereaSeat, 'Seat given back.');
              }
            }}
            type="button"
          >
            {busy === 'leave' ? 'Giving back…' : 'Give the seat back'}
          </button>
        </div>
        {error ? <p className="composer-hint is-error" role="alert">{error}</p> : null}
      </section>
    );
  }

  const interval = summary.billingInterval ?? billingInterval ?? 'month';
  const unit = BEREA_SEAT_PRICE[interval];
  const unitNumber = interval === 'year' ? 70 : 7;
  const used = summary.holders.length;
  const free = Math.max(0, summary.seatCount - used);
  const changed = desired !== summary.seatCount;
  const heldIds = new Set(summary.holders.map((holder) => holder.user_id));

  return (
    <section className="account-section" id="berea-seats">
      <span className="rail-heading account-heading-row">
        <span>Berea seats</span>
        <span className="account-heading-aside">
          {unit} per seat a {interval}
        </span>
      </span>
      <p className="composer-hint">
        Give Berea to people in your church or team who aren’t on a paid plan. Anyone with a GospelPad account can have a seat; it
        unlocks Berea only.
      </p>

      <div className="seat-meter">
        <strong>
          {used} of {summary.seatCount}
        </strong>
        <span>seats given{free ? ` · ${free} free` : ''}</span>
      </div>

      {billingNote ? <p className="composer-hint">{billingNote}</p> : null}

      {!billingNote ? (
        <div className="seat-stepper">
          <span>Seats you pay for</span>
          <div className="seat-stepper-controls">
            <button aria-label="One fewer seat" disabled={desired <= used || Boolean(busy)} onClick={() => setDesired((n) => Math.max(used, n - 1))} type="button">
              −
            </button>
            <output aria-live="polite">{desired}</output>
            <button aria-label="One more seat" disabled={desired >= 500 || Boolean(busy)} onClick={() => setDesired((n) => n + 1)} type="button">
              +
            </button>
          </div>
          {changed ? (
            <button className="button button-primary" onClick={() => setConfirming(true)} type="button">
              Update seats
            </button>
          ) : null}
        </div>
      ) : null}

      {confirming && changed ? (
        <section className="confirm-card seat-confirm" role="alertdialog" aria-label="Confirm seat change">
          <p>
            {desired > summary.seatCount
              ? `Add ${desired - summary.seatCount} ${desired - summary.seatCount === 1 ? 'seat' : 'seats'} to your subscription.`
              : `Remove ${summary.seatCount - desired} ${summary.seatCount - desired === 1 ? 'seat' : 'seats'} from your subscription.`}{' '}
            You’ll pay £{(desired * unitNumber).toLocaleString('en-GB')} a {interval} for {desired} {desired === 1 ? 'seat' : 'seats'}, on top of
            your plan. Stripe adjusts your next bill for the part of the {interval} that’s left.
          </p>
          <div className="danger-zone-actions">
            <button className="button button-secondary" onClick={() => setConfirming(false)} type="button">
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={busy === 'seats'}
              onClick={() =>
                void run(
                  'seats',
                  async () => {
                    await setBereaSeatCount(desired);
                    setConfirming(false);
                  },
                  `You now have ${desired} Berea ${desired === 1 ? 'seat' : 'seats'}.`
                )
              }
              type="button"
            >
              {busy === 'seats' ? 'Updating…' : 'Confirm'}
            </button>
          </div>
        </section>
      ) : null}

      {notice ? <p className="composer-hint" role="status">{notice}</p> : null}
      {error ? <p className="composer-hint is-error" role="alert">{error}</p> : null}

      {free > 0 ? (
        <div className="seat-give">
          <label className="composer-field">
            Give a seat
            <input
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or username"
              type="search"
              value={query}
            />
          </label>
          {results.length ? (
            <ul className="seat-results">
              {results.map((profile) => (
                <li key={profile.id}>
                  <span className="member-name">
                    <strong>{profileLabel(profile)}</strong>
                    {profile.username ? <small>@{profile.username}</small> : null}
                  </span>
                  {heldIds.has(profile.id) ? (
                    <span className="composer-hint">Has a seat</span>
                  ) : (
                    <button
                      className="button button-secondary"
                      disabled={busy === `give-${profile.id}`}
                      onClick={() =>
                        void run(
                          `give-${profile.id}`,
                          async () => {
                            await assignBereaSeat(profile.id);
                            setQuery('');
                          },
                          `${profileLabel(profile)} now has a Berea seat.`
                        )
                      }
                      type="button"
                    >
                      {busy === `give-${profile.id}` ? 'Giving…' : 'Give seat'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : query.trim().length >= 2 ? (
            <p className="composer-hint">No one found with that name or username.</p>
          ) : null}
        </div>
      ) : summary.seatCount > 0 ? (
        <p className="composer-hint">All your seats are in use. Add a seat to give one to someone else.</p>
      ) : null}

      {summary.holders.length ? (
        <ul className="member-list">
          {summary.holders.map((holder, index) => (
            <li className="member-row seat-holder" key={holder.user_id}>
              <span className="member-avatar" aria-hidden="true">
                {holder.name.charAt(0).toUpperCase()}
              </span>
              <span className="member-name">
                <strong>{holder.name}</strong>
                <small>
                  {holder.username ? `@${holder.username} · ` : ''}
                  {index < summary.seatCount ? 'active' : 'waiting for a seat'}
                </small>
              </span>
              <span />
              <button
                className="feed-link is-danger"
                disabled={busy === `take-${holder.user_id}`}
                onClick={() => {
                  if (window.confirm(`Take ${holder.name}’s Berea seat back?`)) {
                    void run(`take-${holder.user_id}`, () => revokeBereaSeat(holder.user_id), `${holder.name}’s seat is free again.`);
                  }
                }}
                type="button"
              >
                {busy === `take-${holder.user_id}` ? 'Removing…' : 'Take back'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
