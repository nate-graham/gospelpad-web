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
    const payload = await res.json().catch(() => null);
    const serverError =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : null;

    if (res.status === 502) {
      if (translation === 'OEB-US') {
        throw new Error('Open English Bible (US) is temporarily unavailable. Try KJV or World English Bible instead.');
      }

      if (translation !== 'KJV') {
        throw new Error(`${translation} is temporarily unavailable right now. Try KJV instead.`);
      }

      throw new Error('This scripture is temporarily unavailable right now. Please try again in a moment.');
    }

    if (res.status === 403) {
      throw new Error(serverError ?? 'You are not authorized to access this translation.');
    }

    if (res.status === 400) {
      throw new Error(serverError ?? 'That scripture reference or translation is not available.');
    }

    throw new Error(serverError ?? `Scripture lookup failed: ${res.status} ${res.statusText}`);
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
