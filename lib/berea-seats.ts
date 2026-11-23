import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export const BEREA_SEAT_PRICE = { month: '£7', year: '£70' } as const;

export type BereaSeatHolder = {
  user_id: string;
  name: string;
  username: string | null;
  assigned_at: string;
};

export type BereaSeatSummary = {
  canManage: boolean;
  planCode: string;
  seatCount: number;
  billingInterval: 'month' | 'year' | null;
  managedByStripe: boolean;
  holders: BereaSeatHolder[];
  heldFrom: { ownerName: string; assignedAt: string; active: boolean } | null;
};

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Supabase is not configured for this browser session.');
  return supabase;
}

/** Your Berea seats (as a Team or Ministry owner) and the seat you hold, if any. */
export async function getMyBereaSeats(): Promise<BereaSeatSummary> {
  const { data, error } = await client().rpc('get_my_berea_seats');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  const held = row.held_from as Record<string, unknown> | null | undefined;
  return {
    canManage: Boolean(row.can_manage),
    planCode: typeof row.plan_code === 'string' ? row.plan_code : 'free',
    seatCount: Number(row.seat_count ?? 0),
    billingInterval: row.billing_interval === 'year' ? 'year' : row.billing_interval === 'month' ? 'month' : null,
    managedByStripe: Boolean(row.managed_by_stripe),
    holders: Array.isArray(row.holders) ? (row.holders as BereaSeatHolder[]) : [],
    heldFrom: held
      ? { ownerName: String(held.owner_name ?? 'a Team or Ministry member'), assignedAt: String(held.assigned_at ?? ''), active: held.active !== false }
      : null,
  };
}

export async function assignBereaSeat(userId: string) {
  const { error } = await client().rpc('assign_berea_seat', { target_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function revokeBereaSeat(userId: string) {
  const { error } = await client().rpc('revoke_berea_seat', { target_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function leaveBereaSeat() {
  const { error } = await client().rpc('leave_berea_seat');
  if (error) throw new Error(error.message);
}

async function callSeatsFunction(body: Record<string, unknown>) {
  const supabase = client();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!base || !session?.access_token) throw new Error('Sign in again to change your seats.');

  const response = await fetch(`${base}/functions/v1/update_berea_seats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; seatCount?: number; billingInterval?: 'month' | 'year' }
    | null;
  if (!response.ok) throw new Error(payload?.error ?? 'Unable to update your Berea seats right now.');
  return payload ?? {};
}

/** Sets how many Berea seats you pay for. Stripe adds or removes them on your current subscription. */
export async function setBereaSeatCount(quantity: number) {
  const payload = await callSeatsFunction({ quantity });
  return payload.seatCount ?? quantity;
}

/** Whether your seats would be billed monthly or yearly (follows your plan). Changes nothing. */
export async function getBereaSeatBillingInterval() {
  const payload = await callSeatsFunction({ preview: true });
  return payload.billingInterval === 'year' ? 'year' : 'month';
}
