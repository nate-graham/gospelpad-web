import { AccountView } from '@/components/account/account-view';
import { isAllowedAdminEmail } from '@/lib/admin';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return <AccountView isAdmin={isAllowedAdminEmail(user?.email)} />;
}
