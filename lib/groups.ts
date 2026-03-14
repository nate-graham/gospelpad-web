import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type Group = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string | null;
  is_public: boolean;
  created_at: string;
};

export type UserGroup = {
  group: Group;
  role: 'admin' | 'member';
};

export type GroupMembership = {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
};

export type GroupMemberSummary = {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  username: string | null;
  display_name: string | null;
  name: string | null;
  avatar_url: string | null;
  is_owner: boolean;
};

export type GroupSharedNoteSummary = {
  id: string;
  title: string | null;
  body: string | null;
  speaker: string | null;
  type: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  permissions: 'view' | 'comment' | 'edit';
  shared_at: string;
  shared_by: string | null;
};

export type GroupNativeNoteSummary = {
  id: string;
  group_id: string;
  created_by: string | null;
  title: string | null;
  body: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupJoinResponse = {
  group: Group;
  status: 'joined' | 'pending';
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

function generateInviteCode(length = 9) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function listUserGroups() {
  const { supabase, userId } = await getAuthenticatedContext();

  const { data, error } = await supabase
    .from('group_members')
    .select('role, groups(*)')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  let results =
    data?.map((row: any) => ({
      group: row.groups as Group,
      role: row.role as 'admin' | 'member',
    })) ?? [];

  if (results.length === 0) {
    const { data: createdGroups, error: createdError } = await supabase
      .from('groups')
      .select('*')
      .eq('created_by', userId);

    if (!createdError && createdGroups && createdGroups.length > 0) {
      await supabase.from('group_members').upsert(
        createdGroups.map((group: Group) => ({
          group_id: group.id,
          user_id: userId,
          role: 'admin',
        })),
        { onConflict: 'group_id,user_id' }
      );

      results = createdGroups.map((group: Group) => ({ group, role: 'admin' }));
    }
  }

  return results as UserGroup[];
}

export async function createGroup(input: {
  name: string;
  description?: string;
  isPublic?: boolean;
}) {
  const { supabase, userId } = await getAuthenticatedContext();

  let created: Group | null = null;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from('groups')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        is_public: input.isPublic ?? false,
        invite_code: inviteCode,
        created_by: userId,
      })
      .select()
      .single();

    if (!error && data) {
      created = data as Group;
      break;
    }

    lastError = error?.message ?? 'Failed to create group.';
    if (!error?.message?.toLowerCase().includes('duplicate')) break;
  }

  if (!created) {
    throw new Error(lastError ?? 'Failed to create group.');
  }

  const { error: membershipError } = await supabase.from('group_members').insert({
    group_id: created.id,
    user_id: userId,
    role: 'admin',
  });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  return created;
}

export async function joinGroupByCode(code: string) {
  const { supabase } = await getAuthenticatedContext();
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    throw new Error('Invite code is required.');
  }

  const { data, error } = await supabase.rpc('join_group_by_invite', {
    invite: normalizedCode,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.id) {
    throw new Error('Invalid invite code.');
  }

  // If a public group was joined through the RPC, current reads should now be
  // allowed. For private groups we rely on the returned function payload.
  const group = {
    id: row.id,
    name: row.name,
    description: row.description,
    invite_code: row.invite_code,
    created_by: row.created_by,
    is_public: row.is_public,
    created_at: row.created_at,
  } satisfies Group;

  return {
    group,
    status: row.status === 'pending' ? 'pending' : 'joined',
  } satisfies GroupJoinResponse;
}

export async function getGroupById(groupId: string) {
  const { supabase } = await getAuthenticatedContext();

  const { data, error } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return (data as Group | null) ?? null;
}

export async function getCurrentMembership(groupId: string) {
  const { supabase, userId } = await getAuthenticatedContext();

  const { data, error } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, joined_at')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GroupMembership | null) ?? null;
}

export async function listGroupMembers(groupId: string): Promise<GroupMemberSummary[]> {
  const { supabase } = await getAuthenticatedContext();

  const { data, error } = await supabase.rpc('get_group_member_summaries', {
    target_group_id: groupId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Omit<GroupMemberSummary, 'role'> & { role: string }>).map(
    (member): GroupMemberSummary => ({
      ...member,
      role: member.role === 'admin' ? 'admin' : 'member',
    })
  );
}

type GroupShareRow = {
  note_id: string;
  permissions: 'view' | 'comment' | 'edit';
  shared_by: string | null;
  created_at: string;
};

export async function listGroupSharedNotes(groupId: string) {
  const { supabase } = await getAuthenticatedContext();

  const { data: shareRows, error: shareError } = await supabase
    .from('note_shares')
    .select('note_id, permissions, shared_by, created_at')
    .eq('shared_with_type', 'group')
    .eq('shared_with', groupId)
    .order('created_at', { ascending: false });

  if (shareError) {
    throw new Error(shareError.message);
  }

  const shares = (shareRows ?? []) as GroupShareRow[];

  if (shares.length === 0) {
    return [] as GroupSharedNoteSummary[];
  }

  const noteIds = Array.from(new Set(shares.map((share) => share.note_id)));
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, title, body, speaker, type, status, created_at, updated_at, deleted_at')
    .in('id', noteIds)
    .is('deleted_at', null);

  if (notesError) {
    throw new Error(notesError.message);
  }

  const noteMap = new Map(
    ((notes ?? []) as Array<GroupSharedNoteSummary & { deleted_at?: string | null }>).map((note) => [note.id, note])
  );

  return shares
    .map((share) => {
      const note = noteMap.get(share.note_id);
      if (!note) return null;

      return {
        id: note.id,
        title: note.title,
        body: note.body,
        speaker: note.speaker,
        type: note.type,
        status: note.status,
        created_at: note.created_at,
        updated_at: note.updated_at,
        permissions: share.permissions,
        shared_at: share.created_at,
        shared_by: share.shared_by,
      } satisfies GroupSharedNoteSummary;
    })
    .filter((note): note is GroupSharedNoteSummary => note !== null);
}

export async function listGroupNativeNotes(groupId: string) {
  const { supabase } = await getAuthenticatedContext();

  const { data, error } = await supabase
    .from('group_notes')
    .select('id, group_id, created_by, title, body, created_at, updated_at')
    .eq('group_id', groupId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GroupNativeNoteSummary[];
}

export async function getGroupNativeNoteById(groupId: string, noteId: string) {
  const { supabase } = await getAuthenticatedContext();

  const { data, error } = await supabase
    .from('group_notes')
    .select('id, group_id, created_by, title, body, created_at, updated_at')
    .eq('group_id', groupId)
    .eq('id', noteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as GroupNativeNoteSummary | null) ?? null;
}

export async function getGroupSharedNoteById(groupId: string, noteId: string) {
  const { supabase } = await getAuthenticatedContext();

  const { data: shareRow, error: shareError } = await supabase
    .from('note_shares')
    .select('note_id, permissions, shared_by, created_at')
    .eq('shared_with_type', 'group')
    .eq('shared_with', groupId)
    .eq('note_id', noteId)
    .limit(1)
    .maybeSingle();

  if (shareError) {
    throw new Error(shareError.message);
  }

  if (!shareRow) {
    return null;
  }

  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('id, title, body, speaker, type, status, created_at, updated_at, deleted_at')
    .eq('id', noteId)
    .is('deleted_at', null)
    .maybeSingle();

  if (noteError) {
    throw new Error(noteError.message);
  }

  if (!note) {
    return null;
  }

  return {
    id: note.id,
    title: note.title,
    body: note.body,
    speaker: note.speaker,
    type: note.type,
    status: note.status,
    created_at: note.created_at,
    updated_at: note.updated_at,
    permissions: shareRow.permissions,
    shared_at: shareRow.created_at,
    shared_by: shareRow.shared_by,
  } satisfies GroupSharedNoteSummary;
}
