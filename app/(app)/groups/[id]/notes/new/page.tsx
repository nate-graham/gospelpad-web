import { GroupNoteForm } from '@/components/groups/group-note-form';

export default async function NewGroupNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GroupNoteForm groupId={id} mode="create" />;
}
