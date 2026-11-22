import { BereaStudyView } from '@/components/berea/berea-study-view';

export default async function BereaStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BereaStudyView key={id} noteId={id} />;
}
