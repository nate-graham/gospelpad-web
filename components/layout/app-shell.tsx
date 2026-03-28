'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/components/providers/supabase-auth-provider';

const navItems = [
  { href: '/notes', label: 'Notes', shortLabel: 'Notes' },
  { href: '/groups', label: 'Groups', shortLabel: 'Groups' },
  { href: '/profile', label: 'Profile', shortLabel: 'Profile' },
  { href: '/settings', label: 'Settings', shortLabel: 'Settings' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSupabaseAuth();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.replace('/auth/sign-in');
  };

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
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <div>
                <div className="eyebrow">GospelPad Web</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Your workspace</div>
              </div>
            </div>
          </header>

          <main className="panel app-main-panel" id="main-content" style={{ minHeight: '72vh', padding: '1.2rem' }} tabIndex={-1}>
            {children}
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
          left: 0.9rem;
          right: 0.9rem;
          bottom: 0.85rem;
          z-index: 30;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          padding: 0.3rem;
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
          }

          .shell-page {
            width: 100%;
            gap: 0.75rem;
          }

          .mobile-topbar {
            margin: 0.5rem 0.5rem 0;
          }

          .app-main-panel {
            min-height: calc(100vh - 7.5rem);
            padding: 1rem;
            border: 0;
            background: transparent;
            border-radius: 0;
            box-shadow: none;
            backdrop-filter: none;
          }

          .mobile-bottom-nav {
            left: 0.5rem;
            right: 0.5rem;
            bottom: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
