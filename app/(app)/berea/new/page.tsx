import { BereaGate } from '@/components/berea/berea-gate';
import { BereaStudyView } from '@/components/berea/berea-study-view';

export default async function NewBereaStudyPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; from?: string }>;
}) {
  const { ref, from } = await searchParams;
  const reference = typeof ref === 'string' ? ref.slice(0, 120) : undefined;
  const fromNoteId = typeof from === 'string' && /^[0-9a-f-]{8,64}$/i.test(from) ? from : undefined;
  return (
    <BereaGate>
      <BereaStudyView key={`${reference ?? ''}-${fromNoteId ?? ''}`} initialReference={reference} fromNoteId={fromNoteId} />
    </BereaGate>
  );
}
