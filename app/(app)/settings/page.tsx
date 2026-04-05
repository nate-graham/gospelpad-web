import { SettingsView } from '@/components/account/settings-view';
import { isAllowedAdminEmail } from '@/lib/admin';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return <SettingsView isAdmin={isAllowedAdminEmail(user?.email)} />;
}
