'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { AuthFrame } from '@/components/layout/auth-frame';
import { getSafeNextPath } from '@/lib/env';
import { ensureProfileForUser } from '@/lib/supabase/profile';

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    const finish = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setMessage('Supabase env vars are missing.');
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const next = getSafeNextPath(url.searchParams.get('next') || searchParams.get('next'));

      const authResult = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : accessToken && refreshToken
          ? await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
          : null;

      if (!authResult) {
        setMessage('No auth callback credentials were found in this URL.');
        return;
      }

      const { error } = authResult;
      if (error) {
        setMessage(error.message);
        return;
      }

      if (url.hash) {
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const metadata = user.user_metadata ?? {};
        const profileError = await ensureProfileForUser({
          id: user.id,
          username: String(metadata.username ?? '').trim(),
          name: String(metadata.name ?? metadata.username ?? '').trim(),
        });

        if (profileError) {
          setMessage(profileError);
          return;
        }
      }

      window.location.assign(next);
    };

    void finish();
  }, [searchParams]);

  return (
    <AuthFrame
      eyebrow="Auth Callback"
      title="Finishing your session"
      description={message}
    >
      <Link className="button button-secondary" href="/auth/sign-in">
        Return to sign in
      </Link>
    </AuthFrame>
  );
}
