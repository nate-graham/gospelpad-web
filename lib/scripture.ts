import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type ScriptureResult = {
  reference: string;
  text: string;
  translation: string;
  reason?: string;
};

export type ScriptureSearchResponse = {
  results: ScriptureResult[];
};

async function getScriptureRequestHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  const supabase = getSupabaseBrowserClient();
  const session = supabase
    ? (
        await supabase.auth.getSession().catch(() => ({
          data: { session: null },
        }))
      ).data.session
    : null;

  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${session?.access_token ?? anonKey}`,
    } satisfies HeadersInit,
  };
}

export async function fetchScriptureByReference(reference: string, translation = 'KJV'): Promise<ScriptureResult> {
  const { url, headers } = await getScriptureRequestHeaders();
  const endpoint = `${url}/functions/v1/fetch_scripture`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ verse_ref: reference, translation }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Scripture lookup failed: ${res.status} ${body || res.statusText}`);
  }

  const data = (await res.json()) as ScriptureResult;
  if (!data.reference || !data.text) {
    throw new Error('Scripture lookup returned an empty result.');
  }

  return data;
}

export async function findScriptureByQuery(query: string): Promise<ScriptureSearchResponse> {
  const { url, headers } = await getScriptureRequestHeaders();
  const endpoint = `${url}/functions/v1/find_scripture`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Scripture search failed: ${res.status} ${body || res.statusText}`);
  }

  const data = (await res.json()) as ScriptureSearchResponse;
  return {
    results: Array.isArray(data.results) ? data.results : [],
  };
}

export function formatScriptureForInsertion(result: ScriptureResult) {
  return `${result.reference} (${result.translation})\n${result.text}`.trim();
}
