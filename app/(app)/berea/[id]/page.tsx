import { BereaGate } from '@/components/berea/berea-gate';
import { BereaStudyView } from '@/components/berea/berea-study-view';

export default async function BereaStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <BereaGate noteId={id}>
      <BereaStudyView key={id} noteId={id} />
    </BereaGate>
  );
}
