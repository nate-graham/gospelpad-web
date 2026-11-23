'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/components/providers/supabase-auth-provider';

type NavKey = 'notes' | 'record' | 'berea' | 'groups' | 'profile' | 'settings';

const navItems: Array<{ key: NavKey; href: string; label: string; shortLabel: string }> = [
  { key: 'notes', href: '/notes', label: 'Notebook', shortLabel: 'Notes' },
  { key: 'record', href: '/notes/dictate', label: 'Record', shortLabel: 'Record' },
  { key: 'berea', href: '/berea', label: 'Berea', shortLabel: 'Berea' },
  { key: 'groups', href: '/groups', label: 'Groups', shortLabel: 'Groups' },
  { key: 'profile', href: '/settings', label: 'Profile & settings', shortLabel: 'Account' },
];

const mobileNavKeys: NavKey[] = ['notes', 'record', 'berea', 'groups', 'profile'];

function isNavActive(key: NavKey, pathname: string) {
  switch (key) {
    case 'record':
      return pathname.startsWith('/notes/dictate');
    case 'notes':
      return pathname.startsWith('/notes') && !pathname.startsWith('/notes/dictate');
    case 'berea':
      return pathname.startsWith('/berea');
    case 'groups':
      return pathname.startsWith('/groups');
    case 'profile':
      return pathname.startsWith('/profile') || pathname.startsWith('/settings') || pathname.startsWith('/admin');
    default:
      return false;
  }
}

function NavIcon({ name }: { name: NavKey }) {
  const common = { width: 17, height: 17, fill: 'none', 'aria-hidden': true as const };
  switch (name) {
    case 'notes':
      return (
        <svg {...common} viewBox="0 0 16 16">
          <path d="M3 1.5h7.5l2.5 2.5v10.5H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M5.5 7h5M5.5 10h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'record':
      return (
        <svg {...common} viewBox="0 0 16 20">
          <rect x="4.5" y="1" width="7" height="12" rx="3.5" stroke="var(--vermilion)" strokeWidth="1.6" />
          <path d="M1.5 9.5a6.5 6.5 0 0013 0M8 16v3" stroke="var(--vermilion)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'berea':
      return (
        <svg {...common} viewBox="0 0 18 18">
          <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11.5 11.5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'groups':
      return (
        <svg {...common} viewBox="0 0 16 16">
          <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="11.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1.5 14c.5-2.5 2.3-4 4.5-4s4 1.5 4.5 4M10.5 10.2c2-.2 3.6 1 4 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common} viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

const PAGE_TRANSITION_MS = 280;

type TransitionDirection = 'forward' | 'backward';
type RenderedRoute = {
  pathname: string;
  node: ReactNode;
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [routeRender, setRouteRender] = useState<{
    current: RenderedRoute;
    previous: RenderedRoute | null;
    direction: TransitionDirection;
    animating: boolean;
  }>({
    current: { pathname, node: children },
    previous: null,
    direction: 'forward',
    animating: false,
  });
  const popNavigationRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerName =
    (typeof user?.user_metadata?.username === 'string' && user.user_metadata.username.trim()) ||
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()) ||
    (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    user?.email?.split('@')[0] ||
    'Account';

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.replace('/auth/sign-in');
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      popNavigationRef.current = true;
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (routeRender.current.pathname === pathname) {
      setRouteRender((current) => ({
        ...current,
        current: { ...current.current, node: children },
      }));
      return;
    }

    const direction: TransitionDirection = popNavigationRef.current ? 'backward' : 'forward';
    popNavigationRef.current = false;

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    setRouteRender((current) => ({
      current: { pathname, node: children },
      previous: current.current,
      direction,
      animating: true,
    }));

    transitionTimerRef.current = setTimeout(() => {
      setRouteRender((current) => ({
        ...current,
        previous: null,
        animating: false,
      }));
      transitionTimerRef.current = null;
    }, PAGE_TRANSITION_MS);
  }, [children, mounted, pathname, routeRender.current.pathname]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);


  const initial = headerName.trim().charAt(0).toUpperCase() || 'G';

  return (
    <div className="gp-shell">
      <a className="button button-secondary skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="gp-sidebar" aria-label="GospelPad">
        <Link href="/notes" className="gp-brand">
          <span className="gp-brand-name">GospelPad</span>
          <span className="gp-brand-tag">The Digital Sanctuary</span>
        </Link>

        <Link href="/notes/new" className="button button-primary gp-new-note">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          New note
        </Link>

        <nav className="gp-nav" aria-label="Primary">
          {navItems.map((item) => {
            const active = isNavActive(item.key, pathname);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`gp-nav-link${active ? ' is-active' : ''}`}
              >
                <NavIcon name={item.key} />
                <span>{item.label}</span>
                {item.key === 'berea' ? <span className="gp-nav-tag">Study</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="gp-sidebar-footer">
          <Link href="/settings" className="gp-user">
            <span className="gp-avatar" aria-hidden="true">{initial}</span>
            <span className="gp-user-copy">
              <strong>{headerName}</strong>
              <span>Profile and plan</span>
            </span>
          </Link>
          <button className="gp-signout" disabled={signingOut} onClick={() => void signOut()} type="button">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="gp-content">
        <header className="gp-mobile-bar">
          <Link href="/notes" className="gp-brand-name">GospelPad</Link>
          <Link href="/notes/new" className="button button-primary gp-mobile-new">
            New note
          </Link>
        </header>

        <main className="gp-main" id="main-content" tabIndex={-1}>
          {mounted ? (
            <div
              className={`app-page-transition-stage${routeRender.animating ? ` is-animating is-${routeRender.direction}` : ''}`}
            >
              {routeRender.previous ? (
                <div
                  className="app-page-transition-layer app-page-transition-layer-previous"
                  style={{ display: routeRender.animating ? 'block' : 'none' }}
                >
                  {routeRender.previous.node}
                </div>
              ) : null}
              <div
                className="app-page-transition-layer app-page-transition-layer-current"
                key={routeRender.current.pathname}
              >
                {routeRender.current.node}
              </div>
            </div>
          ) : (
            <div className="app-page-transition-stage">
              <div className="app-page-transition-layer app-page-transition-layer-current">{children}</div>
            </div>
          )}
        </main>
      </div>

      <nav className="gp-bottom-nav" aria-label="Bottom navigation">
        {navItems
          .filter((item) => mobileNavKeys.includes(item.key))
          .map((item) => {
            const active = isNavActive(item.key, pathname);
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                key={item.key}
                href={item.href}
                className={`gp-bottom-link${active ? ' is-active' : ''}`}
              >
                <NavIcon name={item.key} />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
      </nav>

      <style jsx>{`
        .gp-shell {
          min-height: 100vh;
          display: flex;
          align-items: stretch;
          background: var(--bg);
        }

        .gp-sidebar {
          display: none;
        }

        .gp-content {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .gp-main {
          flex: 1;
          width: 100%;
          max-width: 1320px;
          margin: 0 auto;
          box-sizing: border-box;
          padding: 1.25rem max(16px, env(safe-area-inset-right, 0px)) 6.5rem max(16px, env(safe-area-inset-left, 0px));
        }

        .gp-main:focus {
          outline: none;
        }

        .gp-mobile-bar {
          position: sticky;
          top: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: calc(0.75rem + env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 0.75rem max(16px, env(safe-area-inset-left, 0px));
          background: color-mix(in srgb, var(--bg) 92%, transparent);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--line);
        }

        .gp-mobile-bar :global(.gp-mobile-new) {
          min-height: 38px;
          padding: 0.5rem 1rem;
          font-size: 0.88rem;
        }

        .gp-shell :global(.gp-brand-name) {
          font-family: var(--font-sans);
          font-size: 0.86rem;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--accent);
        }

        .gp-bottom-nav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 40;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          padding: 0.35rem max(8px, env(safe-area-inset-right, 0px)) calc(0.35rem + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
          background: var(--panel);
          border-top: 1px solid var(--line);
        }

        .gp-bottom-nav :global(.gp-bottom-link) {
          display: grid;
          justify-items: center;
          gap: 0.2rem;
          padding: 0.45rem 0.2rem;
          border-radius: 12px;
          color: var(--muted);
          font-size: 0.7rem;
          font-weight: 600;
          min-width: 0;
        }

        .gp-bottom-nav :global(.gp-bottom-link.is-active) {
          color: var(--accent-strong);
          background: var(--accent-soft);
        }

        .app-page-transition-stage {
          position: relative;
          min-height: 100%;
          overflow: visible;
        }

        .app-page-transition-layer {
          min-width: 0;
          width: 100%;
        }

        .app-page-transition-stage.is-animating {
          display: grid;
        }

        .app-page-transition-stage.is-animating .app-page-transition-layer {
          grid-area: 1 / 1;
          will-change: transform, opacity;
        }

        .app-page-transition-stage.is-animating.is-forward .app-page-transition-layer-previous {
          animation: app-page-exit-left ${PAGE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .app-page-transition-stage.is-animating.is-forward .app-page-transition-layer-current {
          animation: app-page-enter-right ${PAGE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .app-page-transition-stage.is-animating.is-backward .app-page-transition-layer-previous {
          animation: app-page-exit-right ${PAGE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .app-page-transition-stage.is-animating.is-backward .app-page-transition-layer-current {
          animation: app-page-enter-left ${PAGE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes app-page-enter-right {
          from { transform: translate3d(24px, 0, 0); opacity: 0.4; }
          to { transform: translate3d(0, 0, 0); opacity: 1; }
        }

        @keyframes app-page-exit-left {
          from { transform: translate3d(0, 0, 0); opacity: 1; }
          to { transform: translate3d(-18px, 0, 0); opacity: 0; }
        }

        @keyframes app-page-enter-left {
          from { transform: translate3d(-24px, 0, 0); opacity: 0.4; }
          to { transform: translate3d(0, 0, 0); opacity: 1; }
        }

        @keyframes app-page-exit-right {
          from { transform: translate3d(0, 0, 0); opacity: 1; }
          to { transform: translate3d(18px, 0, 0); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .app-page-transition-stage.is-animating .app-page-transition-layer-previous,
          .app-page-transition-stage.is-animating .app-page-transition-layer-current {
            animation: none;
          }
        }

        @media (min-width: 980px) {
          .gp-mobile-bar,
          .gp-bottom-nav {
            display: none;
          }

          .gp-sidebar {
            position: sticky;
            top: 0;
            height: 100vh;
            flex: 0 0 var(--sidebar-width);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 1.6rem;
            padding: 1.9rem 1.3rem 1.4rem;
            background: var(--bg-soft);
            border-right: 1px solid var(--line);
            overflow-y: auto;
          }

          .gp-sidebar :global(.gp-brand) {
            display: grid;
            gap: 0.35rem;
            padding: 0 0.6rem;
          }

          .gp-brand-tag {
            font-size: 0.66rem;
            font-weight: 600;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--muted);
          }

          .gp-sidebar :global(.gp-new-note) {
            gap: 0.5rem;
          }

          .gp-nav {
            display: grid;
            gap: 0.15rem;
          }

          .gp-nav :global(.gp-nav-link) {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.68rem 0.75rem;
            border-radius: 12px;
            font-size: 0.92rem;
            font-weight: 600;
            color: var(--ink-soft);
          }

          .gp-nav :global(.gp-nav-link:hover) {
            background: var(--surface-1);
          }

          .gp-nav :global(.gp-nav-link.is-active) {
            background: var(--accent-soft);
            color: var(--accent-strong);
          }

          .gp-nav-tag {
            margin-left: auto;
            font-size: 0.62rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--accent);
          }

          .gp-sidebar-footer {
            margin-top: auto;
            display: grid;
            gap: 0.6rem;
            padding-top: 1rem;
            border-top: 1px solid var(--line);
          }

          .gp-sidebar-footer :global(.gp-user) {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            padding: 0.4rem 0.5rem;
            border-radius: 12px;
            min-width: 0;
          }

          .gp-sidebar-footer :global(.gp-user:hover) {
            background: var(--surface-1);
          }

          .gp-avatar {
            width: 32px;
            height: 32px;
            flex: none;
            border-radius: 999px;
            display: grid;
            place-items: center;
            background: var(--accent-soft);
            color: var(--accent-strong);
            font-weight: 700;
            font-size: 0.82rem;
          }

          .gp-user-copy {
            display: grid;
            min-width: 0;
          }

          .gp-user-copy strong {
            font-size: 0.88rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .gp-user-copy span {
            font-size: 0.76rem;
            color: var(--muted);
          }

          .gp-signout {
            justify-self: start;
            border: 0;
            background: none;
            padding: 0.35rem 0.5rem;
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--muted);
          }

          .gp-signout:hover {
            color: var(--vermilion);
          }

          .gp-main {
            padding: 2rem clamp(1.5rem, 3.5vw, 3.5rem) 3.5rem;
          }
        }
      `}</style>
    </div>
  );
}
