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
  shared: boolean;
  share_targets: unknown[] | null;
  group_note_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type NoteSharePermission = 'view' | 'comment' | 'edit';

export type NoteGroupShare = {
  id: string;
  note_id: string;
  group_id: string;
  group_name: string;
  permissions: NoteSharePermission[];
  created_at: string;
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
    .select('id, user_id, title, body, speaker, type, status, shared, share_targets, group_note_id, created_at, updated_at, deleted_at')
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
    .select('id, user_id, title, body, speaker, type, status, shared, share_targets, group_note_id, created_at, updated_at, deleted_at')
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
    shared: false,
    share_targets: null,
    group_note_id: null,
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
    shared: false,
    share_targets: null,
    group_note_id: null,
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

export async function listOwnedGroupShares(noteId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('note_shares')
    .select('id, note_id, shared_with, permissions, created_at, groups!inner(id, name)')
    .eq('note_id', noteId)
    .eq('shared_by', userId)
    .eq('shared_with_type', 'group');

  if (error) {
    throw new Error(error.message);
  }

  const grouped = new Map<string, NoteGroupShare>();

  for (const row of (data ?? []) as Array<{
    id: string;
    note_id: string;
    shared_with: string;
    permissions: NoteSharePermission;
    created_at: string;
    groups: { id: string; name: string } | { id: string; name: string }[] | null;
  }>) {
    const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    if (!group) continue;

    const existing = grouped.get(row.shared_with);
    if (existing) {
      if (!existing.permissions.includes(row.permissions)) {
        existing.permissions.push(row.permissions);
      }
      continue;
    }

    grouped.set(row.shared_with, {
      id: row.id,
      note_id: row.note_id,
      group_id: row.shared_with,
      group_name: group.name,
      permissions: [row.permissions],
      created_at: row.created_at,
    });
  }

  return [...grouped.values()].sort((a, b) => a.group_name.localeCompare(b.group_name));
}

export async function replaceOwnedGroupShares(input: {
  noteId: string;
  groups: Array<{ id: string; name: string }>;
  permission: NoteSharePermission;
}) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { error: deleteError } = await supabase
    .from('note_shares')
    .delete()
    .eq('note_id', input.noteId)
    .eq('shared_by', userId)
    .eq('shared_with_type', 'group');

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (input.groups.length > 0) {
    const { error: insertError } = await supabase.from('note_shares').insert(
      input.groups.map((group) => ({
        note_id: input.noteId,
        shared_by: userId,
        shared_with: group.id,
        shared_with_type: 'group',
        permissions: input.permission,
      }))
    );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const noteGroups = input.groups.map((group) => ({
    id: group.id,
    name: group.name,
    type: 'group',
    permissions: [input.permission],
  }));

  const { error: noteError } = await supabase
    .from('notes')
    .update({
      shared: input.groups.length > 0,
      share_targets: input.groups.length > 0 ? noteGroups : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.noteId)
    .eq('user_id', userId);

  if (noteError) {
    throw new Error(noteError.message);
  }
}
