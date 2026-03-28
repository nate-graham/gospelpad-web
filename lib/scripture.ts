export type ScriptureResult = {
  reference: string;
  text: string;
  translation: string;
  reason?: string;
};

export type ScriptureSearchResponse = {
  results: ScriptureResult[];
};

export async function fetchScriptureByReference(reference: string): Promise<ScriptureResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  const endpoint = `${url}/functions/v1/fetch_scripture`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ verse_ref: reference }),
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  const endpoint = `${url}/functions/v1/find_scripture`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
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
