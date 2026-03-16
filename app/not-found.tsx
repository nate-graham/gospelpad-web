import Link from 'next/link';
import { AuthFrame } from '@/components/layout/auth-frame';

export default function NotFound() {
  return (
    <AuthFrame
      eyebrow="Not Found"
      title="That page is not part of GospelPad yet"
      description="Use the app navigation to move between the current web sections."
    >
      <div className="cta-row">
        <Link className="button button-primary" href="/">
          Back to home
        </Link>
        <Link className="button button-secondary" href="/notes">
          Open GospelPad
        </Link>
      </div>
    </AuthFrame>
  );
}
