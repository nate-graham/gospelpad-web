import Link from 'next/link';
import { MarketingHero } from '@/components/marketing/marketing-hero';

export default function LandingPage() {
  return (
    <main style={{ padding: '1.25rem', minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
      <MarketingHero
        actions={
          <>
            <Link className="button button-primary" href="/auth/sign-in">
              Sign in
            </Link>
            <Link className="button button-secondary" href="/notes">
              Open web app
            </Link>
          </>
        }
      />
    </main>
  );
}

