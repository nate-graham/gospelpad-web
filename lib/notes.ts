import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export const NOTE_TYPES = ['Church notes', 'Study', 'Journal', 'Dream'] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export type NoteRecord = {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  speaker: string | null;
  type: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type NoteInput = {
  title: string;
  body: string;
  speaker: string;
  type: NoteType;
};

export type NoteListQuery = {
  search?: string;
  type?: NoteType | 'all';
  status?: 'all' | 'with-status' | 'no-status';
  scope?: 'personal' | 'group' | 'all';
  sort?: 'updated-desc' | 'updated-asc' | 'created-desc' | 'created-asc' | 'title-asc';
};

async function getAuthenticatedUserId() {
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

  return { supabase, userId: user.id };
}

export async function listNotes(query: NoteListQuery = {}) {
  const { supabase, userId } = await getAuthenticatedUserId();

  let request = supabase
    .from('notes')
    .select('id, user_id, title, body, speaker, type, status, created_at, updated_at, deleted_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (query.scope !== 'all') {
    if (query.scope === 'group') {
      request = request.not('group_note_id', 'is', null);
    } else {
      request = request.is('group_note_id', null);
    }
  }

  if (query.type && query.type !== 'all') {
    request = request.eq('type', query.type);
  }

  if (query.status === 'with-status') {
    request = request.not('status', 'is', null);
  } else if (query.status === 'no-status') {
    request = request.is('status', null);
  }

  const search = query.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, '\\$&');
    request = request.or(
      `title.ilike.%${escaped}%,body.ilike.%${escaped}%,speaker.ilike.%${escaped}%`
    );
  }

  switch (query.sort) {
    case 'updated-asc':
      request = request.order('updated_at', { ascending: true });
      break;
    case 'created-desc':
      request = request.order('created_at', { ascending: false });
      break;
    case 'created-asc':
      request = request.order('created_at', { ascending: true });
      break;
    case 'title-asc':
      request = request.order('title', { ascending: true, nullsFirst: false });
      break;
    case 'updated-desc':
    default:
      request = request.order('updated_at', { ascending: false });
      break;
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as NoteRecord[];
}

export async function getNoteById(noteId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('notes')
    .select('id, user_id, title, body, speaker, type, status, created_at, updated_at, deleted_at')
    .eq('id', noteId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as NoteRecord | null) ?? null;
}

export async function createNote(input: NoteInput) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const payload = {
    user_id: userId,
    title: input.title.trim() || 'Untitled',
    body: input.body,
    speaker: input.speaker.trim() || null,
    type: input.type,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const { data, error } = await supabase
    .from('notes')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

export async function updateNote(noteId: string, input: NoteInput) {
  const { supabase } = await getAuthenticatedUserId();

  const { error } = await supabase
    .from('notes')
    .update({
      title: input.title.trim() || 'Untitled',
      body: input.body,
      speaker: input.speaker.trim() || null,
      type: input.type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function softDeleteNote(noteId: string) {
  const { supabase } = await getAuthenticatedUserId();

  const { error } = await supabase
    .from('notes')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function duplicateNote(note: Pick<NoteRecord, 'title' | 'body' | 'speaker' | 'type'>) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const baseTitle = note.title?.trim() || 'Untitled';
  const payload = {
    user_id: userId,
    title: `${baseTitle} (copy)`,
    body: note.body ?? '',
    speaker: note.speaker?.trim() || null,
    type: NOTE_TYPES.includes((note.type ?? '') as NoteType)
      ? note.type
      : DEFAULT_DUPLICATE_TYPE,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  const { data, error } = await supabase
    .from('notes')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

const DEFAULT_DUPLICATE_TYPE: NoteType = 'Church notes';
