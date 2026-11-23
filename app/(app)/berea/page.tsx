import { BereaGate } from '@/components/berea/berea-gate';
import { BereaLibraryView } from '@/components/berea/berea-library-view';

export default function BereaPage() {
  return (
    <BereaGate>
      <BereaLibraryView />
    </BereaGate>
  );
}
