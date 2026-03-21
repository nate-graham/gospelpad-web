import { EditSharedNoteView } from '@/components/notes/edit-shared-note-view';

export default async function EditSharedNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditSharedNoteView noteId={id} />;
}
