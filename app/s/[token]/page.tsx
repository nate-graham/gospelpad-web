import { PublicSharedNoteView } from '@/components/notes/public-shared-note-view';

export default async function PublicSharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicSharedNoteView shareToken={token} />;
}
