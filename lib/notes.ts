import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { PrayerRequestStatus } from '@/lib/prayer-requests';

export const NOTE_TYPES = ['Church notes', 'Study', 'Journal', 'Dream', 'Prayer Requests'] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export type NoteRecord = {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  speaker: string | null;
  type: string | null;
  status: string | null;
  is_lucid_dream: boolean | null;
  dream_role: 'observing' | 'involved' | null;
  prayer_request_id: string | null;
  clips: Array<{ id: string; uri: string; duration: number; name: string }> | null;
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

export type ShareableProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  name: string | null;
};

export type NoteUserShare = {
  id: string;
  note_id: string;
  user_id: string;
  user_label: string;
  permissions: NoteSharePermission[];
  created_at: string;
};

export type ReceivedSharedNoteSummary = {
  note: NoteRecord;
  shared_by: string | null;
  shared_by_label: string;
  shared_at: string;
  permissions: NoteSharePermission[];
};

export type NoteInput = {
  title: string;
  body: string;
  speaker: string;
  type: NoteType;
  isLucidDream?: boolean;
  dreamRole?: 'observing' | 'involved';
  prayerStatus?: PrayerRequestStatus;
  prayerRequestId?: string | null;
  clips?: Array<{ id: string; uri: string; duration: number; name: string }>;
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
    .select('id, user_id, title, body, speaker, type, status, is_lucid_dream, dream_role, prayer_request_id, clips, shared, share_targets, group_note_id, created_at, updated_at, deleted_at')
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
    .select('id, user_id, title, body, speaker, type, status, is_lucid_dream, dream_role, prayer_request_id, clips, shared, share_targets, group_note_id, created_at, updated_at, deleted_at')
    .eq('id', noteId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as NoteRecord | null) ?? null;
}

export async function getAccessibleSharedNoteById(noteId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('notes')
    .select('id, user_id, title, body, speaker, type, status, is_lucid_dream, dream_role, prayer_request_id, clips, shared, share_targets, group_note_id, created_at, updated_at, deleted_at')
    .eq('id', noteId)
    .neq('user_id', userId)
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
    status: input.type === 'Prayer Requests' ? input.prayerStatus ?? 'Ongoing' : null,
    is_lucid_dream: input.type === 'Dream' ? Boolean(input.isLucidDream) : null,
    dream_role: input.type === 'Dream' ? input.dreamRole ?? 'observing' : null,
    prayer_request_id: input.type === 'Prayer Requests' ? input.prayerRequestId ?? null : null,
    clips: input.clips ?? null,
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
      status: input.type === 'Prayer Requests' ? input.prayerStatus ?? 'Ongoing' : null,
      is_lucid_dream: input.type === 'Dream' ? Boolean(input.isLucidDream) : null,
      dream_role: input.type === 'Dream' ? input.dreamRole ?? 'observing' : null,
      prayer_request_id: input.type === 'Prayer Requests' ? input.prayerRequestId ?? null : null,
      clips: input.clips ?? null,
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

export async function duplicateNote(note: Pick<NoteRecord, 'title' | 'body' | 'speaker' | 'type' | 'status' | 'is_lucid_dream' | 'dream_role' | 'clips'>) {
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
    status: note.type === 'Prayer Requests' ? note.status ?? 'Ongoing' : null,
    is_lucid_dream: note.type === 'Dream' ? Boolean(note.is_lucid_dream) : null,
    dream_role: note.type === 'Dream' ? note.dream_role ?? 'observing' : null,
    prayer_request_id: null,
    clips: note.clips ?? null,
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

async function getProfileSummaryMap(targetUserIds: string[]) {
  const { supabase } = await getAuthenticatedUserId();
  if (targetUserIds.length === 0) {
    return new Map<string, ShareableProfile>();
  }

  const { data, error } = await supabase.rpc('get_note_share_profile_summaries', {
    target_user_ids: targetUserIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, ShareableProfile>();
  for (const row of (data ?? []) as ShareableProfile[]) {
    map.set(row.id, row);
  }
  return map;
}

function getProfileLabel(profile: ShareableProfile | null | undefined, fallback = 'User') {
  return profile?.display_name?.trim() || profile?.username?.trim() || profile?.name?.trim() || fallback;
}

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

export async function listOwnedUserShares(noteId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('note_shares')
    .select('id, note_id, shared_with, permissions, created_at')
    .eq('note_id', noteId)
    .eq('shared_by', userId)
    .eq('shared_with_type', 'user');

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    note_id: string;
    shared_with: string;
    permissions: NoteSharePermission;
    created_at: string;
  }>;

  const profileMap = await getProfileSummaryMap([...new Set(rows.map((row) => row.shared_with))]);
  const grouped = new Map<string, NoteUserShare>();

  for (const row of rows) {
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
      user_id: row.shared_with,
      user_label: getProfileLabel(profileMap.get(row.shared_with)),
      permissions: [row.permissions],
      created_at: row.created_at,
    });
  }

  return [...grouped.values()].sort((a, b) => a.user_label.localeCompare(b.user_label));
}

export async function searchShareableProfiles(query: string) {
  const { supabase } = await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc('search_note_share_profiles', {
    query: query.trim(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ShareableProfile[];
}

export async function listReceivedSharedNotes() {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('note_shares')
    .select('note_id, shared_by, permissions, created_at')
    .eq('shared_with_type', 'user')
    .eq('shared_with', userId);

  if (error) {
    throw new Error(error.message);
  }

  const shareRows = (data ?? []) as Array<{
    note_id: string;
    shared_by: string | null;
    permissions: NoteSharePermission;
    created_at: string;
  }>;

  const noteIds = [...new Set(shareRows.map((row) => row.note_id))];
  if (noteIds.length === 0) {
    return [] as ReceivedSharedNoteSummary[];
  }

  const { data: notesData, error: notesError } = await supabase
    .from('notes')
    .select('id, user_id, title, body, speaker, type, status, is_lucid_dream, dream_role, prayer_request_id, clips, shared, share_targets, group_note_id, created_at, updated_at, deleted_at')
    .in('id', noteIds)
    .is('deleted_at', null);

  if (notesError) {
    throw new Error(notesError.message);
  }

  const notesById = new Map<string, NoteRecord>();
  for (const row of (notesData ?? []) as NoteRecord[]) {
    notesById.set(row.id, row);
  }

  const senderIds = [...new Set(shareRows.map((row) => row.shared_by).filter(Boolean) as string[])];
  const senderMap = await getProfileSummaryMap(senderIds);
  const grouped = new Map<string, ReceivedSharedNoteSummary>();

  for (const row of shareRows) {
    const note = notesById.get(row.note_id);
    if (!note) continue;

    const existing = grouped.get(row.note_id);
    if (existing) {
      if (!existing.permissions.includes(row.permissions)) {
        existing.permissions.push(row.permissions);
      }
      if (new Date(row.created_at).getTime() > new Date(existing.shared_at).getTime()) {
        existing.shared_at = row.created_at;
      }
      continue;
    }

    grouped.set(row.note_id, {
      note,
      shared_by: row.shared_by,
      shared_by_label: getProfileLabel(row.shared_by ? senderMap.get(row.shared_by) : null, 'User'),
      shared_at: row.created_at,
      permissions: [row.permissions],
    });
  }

  return [...grouped.values()].sort((a, b) => (
    new Date(b.shared_at).getTime() - new Date(a.shared_at).getTime()
  ));
}

export async function replaceOwnedShares(input: {
  noteId: string;
  groups: Array<{ id: string; name: string }>;
  users: ShareableProfile[];
  permission: NoteSharePermission;
}) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { error: deleteError } = await supabase
    .from('note_shares')
    .delete()
    .eq('note_id', input.noteId)
    .eq('shared_by', userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const shareRows = [
    ...input.groups.map((group) => ({
      note_id: input.noteId,
      shared_by: userId,
      shared_with: group.id,
      shared_with_type: 'group' as const,
      permissions: input.permission,
    })),
    ...input.users.map((user) => ({
      note_id: input.noteId,
      shared_by: userId,
      shared_with: user.id,
      shared_with_type: 'user' as const,
      permissions: input.permission,
    })),
  ];

  if (shareRows.length > 0) {
    const { error: insertError } = await supabase.from('note_shares').insert(
      shareRows
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
  const noteUsers = input.users.map((user) => ({
    id: user.id,
    name: getProfileLabel(user),
    type: 'user',
    permissions: [input.permission],
  }));
  const shareTargets = [...noteGroups, ...noteUsers];

  const { error: noteError } = await supabase
    .from('notes')
    .update({
      shared: shareTargets.length > 0,
      share_targets: shareTargets.length > 0 ? shareTargets : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.noteId)
    .eq('user_id', userId);

  if (noteError) {
    throw new Error(noteError.message);
  }
}

export async function replaceOwnedGroupShares(input: {
  noteId: string;
  groups: Array<{ id: string; name: string }>;
  permission: NoteSharePermission;
}) {
  return replaceOwnedShares({
    noteId: input.noteId,
    groups: input.groups,
    users: [],
    permission: input.permission,
  });
}

export async function removeOwnedGroupShare(noteId: string, groupId: string) {
  const { supabase, userId } = await getAuthenticatedUserId();

  const { error: deleteError } = await supabase
    .from('note_shares')
    .delete()
    .eq('note_id', noteId)
    .eq('shared_by', userId)
    .eq('shared_with_type', 'group')
    .eq('shared_with', groupId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const [remainingGroupShares, remainingUserShares] = await Promise.all([
    listOwnedGroupShares(noteId),
    listOwnedUserShares(noteId),
  ]);
  const shareTargets = [
    ...remainingGroupShares.map((share) => ({
      id: share.group_id,
      name: share.group_name,
      type: 'group',
      permissions: share.permissions,
    })),
    ...remainingUserShares.map((share) => ({
      id: share.user_id,
      name: share.user_label,
      type: 'user',
      permissions: share.permissions,
    })),
  ];

  const { error: noteError } = await supabase
    .from('notes')
    .update({
      shared: shareTargets.length > 0,
      share_targets: shareTargets.length > 0 ? shareTargets : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .eq('user_id', userId);

  if (noteError) {
    throw new Error(noteError.message);
  }
}

export async function getReceivedSharedNote(noteId: string) {
  const [note, receivedShares] = await Promise.all([
    getAccessibleSharedNoteById(noteId),
    listReceivedSharedNotes(),
  ]);

  if (!note) {
    return null;
  }

  const share = receivedShares.find((entry) => entry.note.id === noteId);
  if (!share) {
    return null;
  }

  return {
    ...share,
    note,
  } satisfies ReceivedSharedNoteSummary;
}
