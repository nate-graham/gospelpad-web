import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type CheckoutPlanCode = 'premium' | 'team' | 'ministry';
type CheckoutBillingInterval = 'month' | 'year';

export async function createCheckoutSession(planCode: CheckoutPlanCode, billingInterval: CheckoutBillingInterval) {
  const supabase = getSupabaseBrowserClient();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabase || !base) {
    throw new Error('Billing is not configured for this browser session.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('You need to sign in before starting checkout.');
  }

  const response = await fetch(`${base}/functions/v1/create_checkout_session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ planCode, billingInterval }),
  });

  const payload = await response.json().catch(() => null);
  const message =
    payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : null;

  if (!response.ok) {
    throw new Error(message ?? 'Unable to start checkout right now.');
  }

  const url =
    payload && typeof payload === 'object' && 'url' in payload && typeof payload.url === 'string'
      ? payload.url
      : null;

  if (!url) {
    throw new Error('Stripe checkout did not return a redirect URL.');
  }

  return url;
}
