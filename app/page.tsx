import Link from 'next/link';
import { MarketingHero } from '@/components/marketing/marketing-hero';

export default function LandingPage() {
  return (
    <main>
      <MarketingHero
        actions={
          <>
            <Link className="button button-primary" href="/auth/sign-up">
              Begin writing →
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
