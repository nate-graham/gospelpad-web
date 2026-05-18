'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/components/providers/supabase-auth-provider';

const navItems = [
  { href: '/notes', label: 'My Notes', shortLabel: 'Notes' },
  { href: '/groups', label: 'Groups', shortLabel: 'Groups' },
  { href: '/profile', label: 'Profile', shortLabel: 'Profile' },
  { href: '/settings', label: 'Preferences', shortLabel: 'Settings' },
];

const editorSidebarItems = [
  { href: '/notes', label: 'Library', icon: '📚' },
  { href: '/notes', label: 'My Notes', icon: '📄' },
  { href: '/groups', label: 'Groups', icon: '👥' },
  { href: '/notes', label: 'Daily Verses', icon: '✦' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

const editorTopNavItems = [
  { href: '/notes', label: 'Meditations' },
  { href: '/notes', label: 'Scriptures' },
  { href: '/profile', label: 'Reflections' },
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
  const isEditorRoute =
    pathname === '/notes/new' || /^\/notes\/[^/]+\/edit$/.test(pathname);

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

  return (
    <div className="app-shell-root" style={{ minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
      <a className="button button-secondary skip-link" href="#main-content">
        Skip to content
      </a>
      <header className={`app-top-nav${isEditorRoute ? ' is-hidden-on-editor-desktop' : ''}`}>
        <div className="top-nav-container">
          <div className="top-nav-left">
            <Link href="/notes" className="brand-logo">GospelPad</Link>
          </div>
          <nav className="top-nav-center">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`top-nav-link${active ? ' is-active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="top-nav-right">
            <div className="nav-search-wrapper">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search your sanctuary..." className="nav-search-input" />
            </div>
            <button className="profile-trigger" onClick={() => router.push('/profile')}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className={`shell-page full-width-layout${isEditorRoute ? ' editor-shell-layout' : ''}`}>
        {isEditorRoute ? (
          <aside className="editor-shell-sidebar">
            <Link href="/notes" className="editor-shell-brand">GospelPad</Link>
            <div className="editor-shell-curator">
              <div className="editor-shell-avatar" />
              <div className="editor-shell-curator-copy">
                <strong>{headerName}</strong>
                <span>In Silent Reflection</span>
              </div>
            </div>
            <Link href="/notes/new" className="editor-shell-primary-cta">
              New Journal Entry
            </Link>
            <nav className="editor-shell-nav">
              {editorSidebarItems.map((item, index) => {
                const active = index === 0;
                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className={`editor-shell-nav-link${active ? ' is-active' : ''}`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="editor-shell-footer-links">
              <Link href="/settings">Help</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          </aside>
        ) : null}

        <div className={`app-content-frame centered-container${isEditorRoute ? ' editor-content-frame' : ''}`}>
          {isEditorRoute ? (
            <header className="editor-shell-topnav">
              <nav className="editor-shell-topnav-center">
                {editorTopNavItems.map((item, index) => (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className={`editor-shell-topnav-link${index === 0 ? ' is-active' : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="editor-shell-topnav-right">
                <div className="editor-shell-search">
                  <span>🔍</span>
                  <input type="text" placeholder="Search the scriptures..." />
                </div>
                <button className="profile-trigger" onClick={() => router.push('/profile')}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </button>
              </div>
            </header>
          ) : null}

          <header className="mobile-topbar">
            <div className="mobile-topbar-title">
              <div className="mobile-topbar-title-text">
                {headerName}
              </div>
            </div>
          </header>

          <main
            className={`app-main-panel${isEditorRoute ? ' editor-main-panel' : ''}`}
            id="main-content"
            tabIndex={-1}
            style={{ paddingTop: isEditorRoute ? '1.25rem' : '2rem' }}
          >
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
      </div>

      <nav className="mobile-bottom-nav" aria-label="Bottom navigation">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              key={item.href}
              href={item.href}
              className={`mobile-bottom-nav-link${active ? ' is-active' : ''}`}
            >
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        .app-top-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(12, 15, 20, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          padding: 1.6rem 0;
        }

        .top-nav-container {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 4rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .brand-logo {
          font-size: 1.4rem;
          font-weight: 600;
          color: #D1AC70;
          letter-spacing: -0.02em;
        }

        .top-nav-center {
          display: flex;
          gap: 4.5rem;
          align-items: center;
        }

        .top-nav-link {
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--tertiary);
          letter-spacing: 0.02em;
          transition: color 0.2s;
        }

        .top-nav-link.is-active {
          color: var(--secondary);
          position: relative;
        }

        .top-nav-link.is-active::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 2px;
          background: #D1AC70;
        }

        .top-nav-right {
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .nav-search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          font-size: 0.8rem;
          opacity: 0.4;
        }

        .nav-search-input {
          background: rgba(255, 255, 255, 0.04);
          border: none;
          border-radius: 28px;
          padding: 0.65rem 1.2rem 0.65rem 3rem;
          width: 260px;
          color: var(--secondary);
          font-size: 0.85rem;
          letter-spacing: 0.01em;
        }

        .profile-trigger {
          background: none;
          border: none;
          color: var(--tertiary);
          cursor: pointer;
          padding: 0;
        }

        .centered-container {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 3rem;
        }

        .editor-shell-layout {
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
          align-items: stretch;
          width: 100%;
          min-height: 100vh;
        }

        .editor-shell-sidebar {
          display: none;
        }

        .editor-content-frame {
          max-width: none;
          width: 100%;
          padding: 0 2.75rem 0 1.8rem;
        }

        .editor-shell-topnav {
          display: none;
        }

        .editor-main-panel {
          min-height: calc(100vh - 120px);
        }

        .full-width-layout {
          width: 100%;
          min-width: 0;
        }

        .app-main-panel {
            min-height: calc(100vh - 80px);
        }

        .mobile-bottom-nav {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: 0.7rem;
          z-index: 30;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.2rem;
          padding: 0.2rem;
          width: calc(100vw - 1.4rem);
          max-width: 29rem;
          background: rgba(12, 15, 20, 0.96);
          border-radius: 22px;
          overflow: hidden;
        }

        .mobile-bottom-nav-link {
          display: grid;
          place-items: center;
          padding: 0.8rem 0.5rem;
          color: var(--muted);
          font-weight: 600;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-radius: 16px;
        }

        .mobile-bottom-nav-link.is-active {
          color: var(--accent);
          background: rgba(255, 248, 235, 0.05);
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

        @media (max-width: 979px) {
          .shell-page {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (min-width: 980px) {
          .full-width-layout {
             display: block;
          }

          .app-top-nav.is-hidden-on-editor-desktop {
            display: none;
          }

          .editor-shell-layout {
            display: grid;
          }

          .editor-shell-sidebar {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            padding: 2.2rem 2rem 2rem;
            background: #0b0e14;
            box-shadow: 40px 0 60px -15px rgba(0, 0, 0, 0.3);
          }

          .editor-shell-brand {
            color: var(--accent);
            font-size: 1.18rem;
            font-weight: 700;
            letter-spacing: -0.04em;
          }

          .editor-shell-curator {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 3rem 0 2rem;
          }

          .editor-shell-avatar {
            width: 56px;
            height: 56px;
            border-radius: 999px;
            background: radial-gradient(circle at 35% 30%, #d1ac70 0%, #8b5c2f 38%, #1d2026 100%);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
          }

          .editor-shell-curator-copy {
            display: grid;
            gap: 0.2rem;
          }

          .editor-shell-curator-copy strong {
            color: var(--text);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 0.82rem;
          }

          .editor-shell-curator-copy span {
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 0.72rem;
          }

          .editor-shell-primary-cta {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            min-height: 64px;
            margin-bottom: 2rem;
            border-radius: 999px;
            background: var(--accent);
            color: #101319;
            font-weight: 600;
            font-size: 0.95rem;
            letter-spacing: 0.02em;
          }

          .editor-shell-nav {
            display: grid;
            gap: 0.85rem;
          }

          .editor-shell-nav-link {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem 1.2rem;
            border-radius: 24px;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-size: 0.82rem;
          }

          .editor-shell-nav-link.is-active {
            background: rgba(255, 248, 235, 0.05);
            color: var(--accent);
            box-shadow: inset 0 0 0 1px rgba(209, 172, 112, 0.6);
          }

          .editor-shell-footer-links {
            margin-top: auto;
            display: grid;
            gap: 1rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(78, 70, 58, 0.15);
          }

          .editor-shell-footer-links :global(a) {
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-size: 0.74rem;
          }

          .editor-shell-topnav {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            padding: 1.9rem 0 1.25rem;
          }

          .editor-shell-topnav-center {
            display: flex;
            align-items: center;
            gap: 3rem;
          }

          .editor-shell-topnav-link {
            color: var(--muted);
            font-size: 0.95rem;
            letter-spacing: 0.01em;
          }

          .editor-shell-topnav-link.is-active {
            color: var(--accent);
            padding-bottom: 0.5rem;
            box-shadow: inset 0 -2px 0 var(--accent);
          }

          .editor-shell-topnav-right {
            display: flex;
            align-items: center;
            gap: 1.4rem;
            position: absolute;
            right: 0;
          }

          .editor-shell-search {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            min-width: 320px;
            padding: 0.85rem 1.1rem;
            border-radius: 999px;
            background: rgba(255, 248, 235, 0.045);
            color: var(--muted);
          }

          .editor-shell-search input {
            width: 100%;
            border: 0;
            outline: none;
            background: transparent;
            color: var(--text);
            font-size: 0.92rem;
          }

          .app-main-panel {
            padding-top: 0.5rem;
          }

          .mobile-topbar {
            display: none;
          }
        }

        @media (max-width: 767px) {
          .app-shell-root {
            padding: 0;
            overflow-x: visible;
          }

          .shell-page {
            width: 100%;
            gap: 0.8rem;
          }

          .mobile-topbar {
            width: calc(100% - 1.4rem);
            max-width: calc(100% - 1.4rem);
            margin: 0.7rem auto 0;
          }

          .app-main-panel {
            min-height: calc(100vh - 7.5rem);
            width: calc(100% - 1.4rem);
            max-width: calc(100% - 1.4rem);
            margin: 0 auto;
            padding: 0.85rem 0;
          }

          .mobile-bottom-nav {
            left: 50%;
            transform: translateX(-50%);
            bottom: 0.5rem;
            width: calc(100vw - 1.4rem);
            max-width: calc(100vw - 1.4rem);
          }

          .mobile-bottom-nav :global(a) {
            font-size: 0.68rem;
            padding: 0.8rem 0.25rem;
          }
        }
      `}</style>
    </div>
  );
}
