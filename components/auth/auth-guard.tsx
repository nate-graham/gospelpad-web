'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppLoadingScreen } from '@/components/feedback/app-loading-screen';
import { AppErrorState } from '@/components/feedback/app-error-state';
import { useSupabaseAuth } from '@/components/providers/supabase-auth-provider';

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, envState } = useSupabaseAuth();

  useEffect(() => {
    if (!loading && envState.ok && !user) {
      router.replace(`/auth/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [envState.ok, loading, pathname, router, user]);

  if (!envState.ok) {
    return (
      <AppErrorState
        title="Web env vars are missing"
        description={envState.message}
      />
    );
  }

  if (loading) {
    return <AppLoadingScreen label="Loading your session..." />;
  }

  if (!user) {
    return <AppLoadingScreen label="Redirecting to sign in..." />;
  }

  return <>{children}</>;
}

