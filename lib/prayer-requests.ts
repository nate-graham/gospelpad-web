import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type PrayerRequestStatus = 'Ongoing' | 'Answered';

export type PrayerRequestRecord = {
  id: string;
  created_by: string | null;
  title: string | null;
  body: string | null;
  status: PrayerRequestStatus;
  answered_at: string | null;
  group_id: string | null;
  shared: boolean;
  accepted: boolean;
  created_at: string;
  updated_at: string;
};

async function getAuthenticatedPrayerClient() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error('Supabase is not configured for this browser session.');
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error('Not authenticated');
  }

  return { supabase, userId: user.id };
}

export async function upsertPrayerRequest(payload: {
  id?: string;
  title: string;
  body: string;
  status: PrayerRequestStatus;
  groupId?: string | null;
  shared?: boolean;
  accepted?: boolean;
}) {
  const { supabase, userId } = await getAuthenticatedPrayerClient();
  const now = new Date().toISOString();
  const base = {
    title: payload.title.trim() || 'Untitled prayer request',
    body: payload.body,
    status: payload.status,
    answered_at: payload.status === 'Answered' ? now : null,
    group_id: payload.groupId ?? null,
    shared: payload.shared ?? false,
    accepted: payload.accepted ?? false,
    updated_at: now,
  };

  if (payload.id) {
    const { error } = await supabase.from('prayer_requests').update(base).eq('id', payload.id);
    if (error) {
      throw new Error(error.message);
    }

    return payload.id;
  }

  const { data, error } = await supabase
    .from('prayer_requests')
    .insert({
      ...base,
      created_by: userId,
      created_at: now,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

export async function getPrayerRequestById(prayerRequestId: string) {
  const { supabase } = await getAuthenticatedPrayerClient();

  const { data, error } = await supabase
    .from('prayer_requests')
    .select('*')
    .eq('id', prayerRequestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PrayerRequestRecord | null) ?? null;
}
