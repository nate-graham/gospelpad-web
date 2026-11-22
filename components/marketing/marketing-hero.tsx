import { ReactNode } from 'react';

export function MarketingHero({ actions }: { actions: ReactNode }) {
  return (
    <div className="gp-landing">
      <header className="gp-landing-bar">
        <span className="gp-landing-brand">
          <span>GospelPad</span>
          <span aria-hidden="true" className="gp-landing-dash" />
          <span className="gp-landing-tag">The Digital Sanctuary</span>
        </span>
        <span aria-hidden="true" className="pilcrow" style={{ color: 'var(--vermilion)', fontSize: '1.3rem' }}>
          ¶
        </span>
      </header>

      <section className="gp-landing-hero">
        <div aria-hidden="true" className="gp-landing-watermark">G</div>

        <div className="gp-landing-copy">
          <h1 className="gp-landing-title">
            Where your notes meet the <em>Word.</em>
          </h1>
          <p className="gp-landing-lede">
            Sermons, Scripture, journals and prayer in one quiet, beautiful place. Record a sermon, keep the verses it
            names, and study them properly with Berea.
          </p>
          <div className="cta-row">{actions}</div>

          <blockquote className="verse-callout" style={{ borderLeftColor: 'var(--vermilion)', maxWidth: '26rem', marginTop: '1.5rem' }}>
            <span className="verse-callout-text">“Thy word is a lamp unto my feet, and a light unto my path.”</span>
            <span className="verse-callout-ref" style={{ color: 'var(--vermilion)' }}>
              Psalm 119 : 105
            </span>
          </blockquote>
        </div>

        <div className="gp-landing-features">
          <article>
            <span className="eyebrow">Capture</span>
            <strong>Church notes, study, journals, dreams and prayer requests, typed or spoken.</strong>
          </article>
          <article>
            <span className="eyebrow">Scripture</span>
            <strong>Verses you mention are found in your notes, ready to read in KJV, WEB or OEB.</strong>
          </article>
          <article>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>
              Berea · New
            </span>
            <strong>Examine a passage the way the Bereans did: observe, interpret, apply.</strong>
          </article>
          <article>
            <span className="eyebrow">Together</span>
            <strong>Share notes, post announcements and pray with your group.</strong>
          </article>
        </div>
      </section>

      <footer className="gp-landing-foot">
        <span>gospelpad.com</span>
        <span>
          <a href="/pricing">Plans</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
        </span>
      </footer>

      <style>{`
        .gp-landing {
          width: min(100%, 1240px);
          margin: 0 auto;
          min-height: 100vh;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: clamp(2rem, 5vw, 4rem);
          padding-block: clamp(1.5rem, 4vw, 3rem);
          padding-left: max(16px, env(safe-area-inset-left, 0px));
          padding-right: max(16px, env(safe-area-inset-right, 0px));
        }
        .gp-landing-bar, .gp-landing-foot {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
        }
        .gp-landing-brand {
          display: inline-flex;
          align-items: center;
          gap: 0.8rem;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--accent);
        }
        .gp-landing-dash { width: 34px; height: 1px; background: var(--muted); }
        .gp-landing-tag { color: var(--muted); font-weight: 600; }
        .gp-landing-hero {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          gap: clamp(2rem, 5vw, 5rem);
          align-items: flex-end;
          flex: 1;
        }
        .gp-landing-watermark {
          position: absolute;
          right: -4%;
          top: -18%;
          font-family: var(--font-serif);
          font-weight: 500;
          font-size: clamp(320px, 52vw, 680px);
          line-height: 1;
          color: var(--accent);
          opacity: 0.07;
          pointer-events: none;
          user-select: none;
        }
        .gp-landing-copy {
          position: relative;
          flex: 999 1 420px;
          min-width: 0;
          display: grid;
          gap: 1.4rem;
          align-content: end;
        }
        .gp-landing-title {
          margin: 0;
          font-size: clamp(2.8rem, 7vw, 5.4rem);
          line-height: 1.04;
          max-width: 11ch;
        }
        .gp-landing-lede {
          margin: 0;
          max-width: 34rem;
          font-size: 1.12rem;
          line-height: 1.65;
          color: var(--muted-strong);
        }
        .gp-landing-features {
          position: relative;
          flex: 1 1 300px;
          min-width: 0;
          display: grid;
          gap: 0;
        }
        .gp-landing-features article {
          display: grid;
          gap: 0.4rem;
          padding: 1rem 0;
          border-top: 1px solid var(--line);
        }
        .gp-landing-features strong {
          font-family: var(--font-serif);
          font-weight: 500;
          font-size: 1.12rem;
          line-height: 1.45;
        }
        .gp-landing-foot {
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .gp-landing-foot a { color: var(--muted); }
        .gp-landing-foot a:hover { color: var(--accent); }
      `}</style>
    </div>
  );
}
