'use client';

import { ReactNode, useMemo } from 'react';
import { SupabaseAuthProvider } from '@/components/providers/supabase-auth-provider';
import { DisplayPreferencesProvider } from '@/components/providers/display-preferences-provider';
import { getRequiredEnvState } from '@/lib/env';

export function AppProviders({ children }: { children: ReactNode }) {
  const envState = useMemo(() => getRequiredEnvState(), []);

  return (
    <DisplayPreferencesProvider>
      <SupabaseAuthProvider envState={envState}>{children}</SupabaseAuthProvider>
    </DisplayPreferencesProvider>
  );
}
