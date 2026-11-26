import { stripFormatting } from '@/lib/note-format';

export type PublicNotePreview = {
  title: string;
  body: string;
  speaker: string | null;
  type: string | null;
  created_at: string | null;
};

/** Fetch a publicly shared note on the server (for link previews). */
export async function fetchPublicNotePreview(token: string): Promise<PublicNotePreview | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^[A-Za-z0-9_-]{4,128}$/.test(token)) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_public_shared_note`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_token: token }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.deleted_at) return null;
    return {
      title: (row.title ?? '').trim() || 'Untitled note',
      body: row.body ?? '',
      speaker: row.speaker?.trim() || null,
      type: row.type ?? null,
      created_at: row.created_at ?? null,
    };
  } catch {
    return null;
  }
}

export function previewExcerpt(body: string, max = 200) {
  const text = stripFormatting(body)
    .replace(/\[[A-Z0-9-]{2,10}\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 120 ? cut.lastIndexOf(' ') : max).trim()}…`;
}

export function previewTypeLabel(type: string | null) {
  if (!type) return 'Note';
  if (type === 'Church notes') return 'Sermon notes';
  if (type === 'Prayer Requests') return 'Prayer request';
  return type;
}
