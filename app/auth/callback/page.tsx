'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { AuthFrame } from '@/components/layout/auth-frame';
import { getSafeNextPath } from '@/lib/env';
import { ensureProfileForUser } from '@/lib/supabase/profile';

export default function AuthCallbackPage() {
  const router = useRouter();
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
      const next = getSafeNextPath(url.searchParams.get('next') || searchParams.get('next'));

      if (!code) {
        setMessage('No auth code was found in this callback URL.');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setMessage(error.message);
        return;
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

      router.replace(next);
    };

    void finish();
  }, [router, searchParams]);

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
