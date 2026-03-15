import { GroupNoteForm } from '@/components/groups/group-note-form';
import { getGroupNativeNoteById } from '@/lib/groups';

export default async function EditGroupNotePage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = await params;
  const note = await getGroupNativeNoteById(id, noteId);

  return <GroupNoteForm groupId={id} mode="edit" note={note} />;
}
