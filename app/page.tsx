import Link from 'next/link';
import { MarketingHero } from '@/components/marketing/marketing-hero';

export default function LandingPage() {
  return (
    <main className="landing-page" style={{ padding: '1.25rem', minHeight: '100vh', display: 'grid' }}>
      <MarketingHero
        actions={
          <>
            <Link className="button button-primary" href="/auth/sign-up">
              Enter sanctuary
            </Link>
            <Link className="button button-secondary" href="/auth/sign-in">
              Sign in
            </Link>
          </>
        }
      />
    </main>
  );
}
