import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type AccountProfile = {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  church: string | null;
  defaultNoteType: string | null;
  onboardingCompleted: boolean;
};

export type AccountSummary = {
  noteCount: number;
  groupCount: number;
};

async function getAuthenticatedContext() {
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

  return { supabase, user };
}

export async function loadAccountProfile() {
  const { supabase, user } = await getAuthenticatedContext();

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, name, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    id: user.id,
    email: user.email ?? null,
    username: (profileRow?.username as string | null | undefined) ?? (user.user_metadata?.username as string | null | undefined) ?? null,
    name: (user.user_metadata?.name as string | null | undefined) ?? (profileRow?.name as string | null | undefined) ?? null,
    church: (user.user_metadata?.church as string | null | undefined) ?? null,
    defaultNoteType: (user.user_metadata?.default_note_type as string | null | undefined) ?? null,
    onboardingCompleted: Boolean(profileRow?.onboarding_completed),
  } satisfies AccountProfile;
}

export async function loadAccountSummary() {
  const { supabase, user } = await getAuthenticatedContext();

  const [{ count: noteCount, error: notesError }, { count: groupCount, error: groupsError }] = await Promise.all([
    supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .is('group_note_id', null),
    supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  if (notesError) throw new Error(notesError.message);
  if (groupsError) throw new Error(groupsError.message);

  return {
    noteCount: noteCount ?? 0,
    groupCount: groupCount ?? 0,
  } satisfies AccountSummary;
}

export async function updateAccountProfile(input: {
  name: string;
  church: string;
  defaultNoteType: string;
}) {
  const { supabase, user } = await getAuthenticatedContext();

  const { error: updateUserError } = await supabase.auth.updateUser({
    data: {
      ...(user.user_metadata ?? {}),
      name: input.name.trim(),
      church: input.church.trim(),
      default_note_type: input.defaultNoteType,
    },
  });

  if (updateUserError) {
    throw new Error(updateUserError.message);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      name: input.name.trim() || null,
    })
    .eq('id', user.id);

  if (profileError) {
    throw new Error(profileError.message);
  }
}

