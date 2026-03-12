import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export async function ensureProfileForUser({
  id,
  username,
  name,
}: {
  id: string;
  username: string;
  name: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return 'Supabase is not configured for this browser session.';
  }

  const normalizedUsername = username.trim();
  const normalizedName = name.trim();

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('id, username, name')
    .eq('id', id)
    .maybeSingle();

  if (existingProfileError) {
    return existingProfileError.message;
  }

  if (existingProfile?.id) {
    const updates: { username?: string; name?: string } = {};
    if (!existingProfile.username && normalizedUsername) updates.username = normalizedUsername;
    if (!existingProfile.name && normalizedName) updates.name = normalizedName;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', id);
      if (updateError) {
        if (updateError.code === '23505') {
          return 'Username is already taken.';
        }
        return updateError.message;
      }
    }

    return null;
  }

  if (normalizedUsername) {
    // With self-only profile policies, rely on the unique constraint instead of
    // probing other profile rows from the client.
  }

  const { error: insertError } = await supabase.from('profiles').insert({
    id,
    username: normalizedUsername || null,
    name: normalizedName || normalizedUsername || null,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return 'Username is already taken.';
    }
    return insertError.message;
  }

  return null;
}
