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

export async function listNotes() {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('notes')
    .select('id, user_id, title, body, speaker, type, status, created_at, updated_at, deleted_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('group_note_id', null)
    .order('updated_at', { ascending: false });

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

