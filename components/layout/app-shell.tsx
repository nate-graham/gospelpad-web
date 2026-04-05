'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/components/providers/supabase-auth-provider';

const navItems = [
  { href: '/notes', label: 'Notes', shortLabel: 'Notes' },
  { href: '/groups', label: 'Groups', shortLabel: 'Groups' },
  { href: '/profile', label: 'Profile', shortLabel: 'Profile' },
  { href: '/settings', label: 'Settings', shortLabel: 'Settings' },
];

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
    const handlePopState = () => {
      popNavigationRef.current = true;
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
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
  }, [children, pathname, routeRender.current.pathname]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className="app-shell-root"
      style={{
        minHeight: '100vh',
        padding: '1rem',
      }}
    >
      <a className="button button-secondary skip-link" href="#main-content">
        Skip to content
      </a>
      <div
        className="shell-page"
        style={{
          display: 'grid',
          gap: '1rem',
        }}
      >
        <aside className="panel app-sidebar">
          <div style={{ padding: '1.2rem', display: 'grid', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              <span className="badge">GospelPad</span>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>GospelPad</div>
                <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                  Keep your notes, groups, and account details close at hand.
                </div>
              </div>
            </div>
            <nav style={{ display: 'grid', gap: '0.45rem' }} aria-label="Primary">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    aria-current={active ? 'page' : undefined}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.9rem 1rem',
                      borderRadius: '16px',
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(154, 106, 27, 0.18)' : 'transparent'}`,
                      color: active ? 'var(--accent-strong)' : 'var(--text)',
                      fontWeight: active ? 700 : 600,
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Open</span>
                  </Link>
                );
              })}
            </nav>
            <div className="empty-state" style={{ gap: '0.5rem' }}>
              <strong>Signed in as</strong>
              <span style={{ color: 'var(--muted)', overflowWrap: 'anywhere' }}>{user?.email ?? 'Unknown user'}</span>
              <button className="button button-ghost" onClick={signOut} disabled={signingOut} type="button">
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </aside>

        <div style={{ display: 'grid', gap: '1rem', minWidth: 0 }}>
          <header className="panel mobile-topbar" style={{ padding: '1rem 1.1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                GospelPad {headerName}
              </div>
            </div>
          </header>

          <main className="panel app-main-panel" id="main-content" style={{ minHeight: '72vh', padding: '1.2rem' }} tabIndex={-1}>
            <div
              className={`app-page-transition-stage${routeRender.animating ? ` is-animating is-${routeRender.direction}` : ''}`}
            >
              {routeRender.previous ? (
                <div className="app-page-transition-layer app-page-transition-layer-previous">
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
          </main>
        </div>
      </div>

      <nav className="mobile-bottom-nav panel" aria-label="Bottom navigation">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              key={item.href}
              href={item.href}
              style={{
                display: 'grid',
                placeItems: 'center',
                padding: '0.8rem 0.4rem',
                color: active ? 'var(--accent-strong)' : 'var(--muted)',
                fontWeight: active ? 700 : 600,
                fontSize: '0.85rem',
              }}
            >
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        .app-sidebar {
          display: none;
        }

        .mobile-bottom-nav {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: 0.85rem;
          z-index: 30;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          padding: 0.3rem;
          width: calc(100vw - 1.8rem);
          max-width: calc(100vw - 1.8rem);
          overflow: hidden;
        }

        .mobile-bottom-nav :global(a) {
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .app-page-transition-stage {
          position: relative;
          min-height: 100%;
          overflow-x: clip;
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
          from {
            transform: translate3d(40px, 0, 0);
            opacity: 0.38;
          }

          to {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
        }

        @keyframes app-page-exit-left {
          from {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }

          to {
            transform: translate3d(-28px, 0, 0);
            opacity: 0;
          }
        }

        @keyframes app-page-enter-left {
          from {
            transform: translate3d(-40px, 0, 0);
            opacity: 0.38;
          }

          to {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
        }

        @keyframes app-page-exit-right {
          from {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }

          to {
            transform: translate3d(28px, 0, 0);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .app-page-transition-stage.is-animating .app-page-transition-layer-previous,
          .app-page-transition-stage.is-animating .app-page-transition-layer-current {
            animation: none;
          }
        }

        @media (min-width: 768px) {
          .mobile-bottom-nav {
            display: none;
          }
        }

        @media (min-width: 980px) {
          .app-sidebar {
            display: block;
          }

          .mobile-topbar {
            display: none;
          }
        }

        @media (max-width: 979px) {
          .shell-page {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (min-width: 980px) {
          .shell-page {
            grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
          }
        }

        @media (max-width: 767px) {
          .app-shell-root {
            padding: 0;
            overflow-x: clip;
          }

          .shell-page {
            width: 100%;
            gap: 0.75rem;
          }

          .mobile-topbar {
            width: calc(100% - 1rem);
            max-width: calc(100% - 1rem);
            margin: 0.5rem auto 0;
          }

          .app-main-panel {
            min-height: calc(100vh - 7.5rem);
            width: calc(100% - 1rem);
            max-width: calc(100% - 1rem);
            margin: 0 auto;
            padding: 1rem 0;
            border: 0;
            background: transparent;
            border-radius: 0;
            box-shadow: none;
            backdrop-filter: none;
          }

          .mobile-bottom-nav {
            left: 50%;
            transform: translateX(-50%);
            bottom: 0.5rem;
            width: calc(100vw - 1rem);
            max-width: calc(100vw - 1rem);
          }

          .mobile-bottom-nav :global(a) {
            font-size: 0.8rem;
            padding: 0.8rem 0.2rem;
          }
        }
      `}</style>
    </div>
  );
}
