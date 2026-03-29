import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type EntitlementSummary = {
  planCode: string;
  subscriptionStatus: string;
  scriptureSearchEnabled: boolean;
  paidBibleTranslationsEnabled: boolean;
  transcriptionEnabled: boolean;
  groupMemberLimit: number;
};

export async function getMyEntitlements(): Promise<EntitlementSummary> {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error('Supabase is not configured for this browser session.');
  }

  const { data, error } = await supabase.rpc('get_my_entitlements');

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    planCode: row?.plan_code ?? 'free',
    subscriptionStatus: row?.subscription_status ?? 'inactive',
    scriptureSearchEnabled: Boolean(row?.scripture_search_enabled),
    paidBibleTranslationsEnabled: Boolean(row?.paid_bible_translations_enabled),
    transcriptionEnabled: Boolean(row?.transcription_enabled),
    groupMemberLimit: Number(row?.group_member_limit ?? 5),
  };
}
