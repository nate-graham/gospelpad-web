import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type SharedNoteComment = {
  id: string;
  note_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

async function getAuthenticatedContext() {
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

export async function listSharedNoteComments(noteId: string) {
  const { supabase } = await getAuthenticatedContext();

  const { data, error } = await supabase
    .from('note_comments')
    .select('id, note_id, user_id, body, created_at, updated_at')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SharedNoteComment[];
}

export async function addSharedNoteComment(noteId: string, body: string) {
  const { supabase, userId } = await getAuthenticatedContext();
  const trimmed = body.trim();

  if (!trimmed) {
    throw new Error('Comment cannot be empty.');
  }

  const { data, error } = await supabase
    .from('note_comments')
    .insert({
      note_id: noteId,
      user_id: userId,
      body: trimmed,
    })
    .select('id, note_id, user_id, body, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SharedNoteComment;
}
