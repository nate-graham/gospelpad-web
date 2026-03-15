import { ReceivedSharedNoteView } from '@/components/notes/received-shared-note-view';

export default async function ReceivedSharedNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceivedSharedNoteView noteId={id} />;
}
