import { GroupSharedNoteView } from '@/components/groups/group-shared-note-view';

export default async function GroupSharedNotePage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = await params;
  return <GroupSharedNoteView groupId={id} noteId={noteId} />;
}
