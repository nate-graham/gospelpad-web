import Link from 'next/link';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By downloading, accessing, or using Gospel Pad, you agree to these Terms of Service. If you do not agree, do not use the service. These Terms apply to all users, including free and paid subscribers.',
  },
  {
    title: '2. Description of the Service',
    body: 'Gospel Pad is a digital note-taking and scripture study service for sermon notes, Bible study, prayer requests, journaling, and group collaboration. Optional AI-assisted features may change, be added, or removed over time.',
  },
  {
    title: '3. Eligibility',
    body: 'You must be at least 13 years old to use Gospel Pad. If you are under 18, you confirm that you have parental or guardian consent.',
  },
  {
    title: '4. Accounts and Security',
    body: 'You are responsible for maintaining the confidentiality of your account, the activity under your account, and ensuring your information is accurate. We may suspend or terminate accounts that violate these Terms.',
  },
  {
    title: '5. User Content and Ownership',
    body: 'You retain ownership of the content you create, including notes, prayer requests, journal entries, voice recordings, and group content. You grant Gospel Pad a limited license to store, process, and display your content solely to operate and improve the service.',
  },
  {
    title: '6. Group and Shared Content',
    body: 'If you participate in groups, content you share may be visible to other members. You are responsible for what you choose to share.',
  },
  {
    title: '7. AI-Powered Features',
    body: 'Certain features use artificial intelligence to assist with transcription, search, or content suggestions. AI output may be inaccurate or incomplete, does not provide theological, legal, or professional advice, and should be reviewed by you.',
  },
  {
    title: '8. Scripture and Bible Translations',
    body: 'Gospel Pad may display scripture from public-domain and licensed third-party translations. Availability may vary by plan and region, and we do not guarantee any specific translation will always be available.',
  },
  {
    title: '9. Paid Features and Subscriptions',
    body: 'Gospel Pad may offer paid subscriptions or one-time purchases that unlock additional features, including additional Bible translations, AI tools, or expanded group features. Payments are processed through the relevant billing provider, subscriptions may renew automatically unless cancelled, and refunds are subject to applicable platform or provider policies.',
  },
  {
    title: '10. Acceptable Use',
    body: 'You agree not to use the service for unlawful purposes, upload harmful or abusive content, attempt to exploit or reverse-engineer the service, or interfere with the app’s security or infrastructure.',
  },
  {
    title: '11. Termination',
    body: 'We may suspend or terminate access if these Terms are violated. You may stop using Gospel Pad at any time.',
  },
  {
    title: '12. Disclaimer',
    body: 'The service is provided as is and as available. We make no warranties regarding AI output accuracy, scripture translation availability, or uninterrupted service.',
  },
  {
    title: '13. Limitation of Liability',
    body: 'To the maximum extent permitted by law, Gospel Pad is not liable for indirect, incidental, or consequential damages arising from use of the service.',
  },
  {
    title: '14. Governing Law',
    body: 'These Terms are governed by the laws of England and Wales, without regard to conflict of law principles.',
  },
  {
    title: '15. Contact',
    body: 'For questions regarding these Terms: support@gospelpad.com',
  },
] as const;

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', padding: '1rem', display: 'grid', justifyItems: 'center' }}>
      <div className="page-section shell-page" style={{ width: 'min(100%, 960px)', paddingBottom: '2rem' }}>
        <header className="page-header">
          <div className="cta-row">
            <Link className="button button-secondary" href="/settings">
              Back to settings
            </Link>
          </div>
          <span className="eyebrow">Terms of Service</span>
          <h1>Terms of Service</h1>
          <p className="page-description">
            Gospel Pad - Terms of Service
            <br />
            Last updated: January 11th 2026
          </p>
        </header>

        <section className="panel" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
          {sections.map((section) => (
            <section key={section.title} style={{ display: 'grid', gap: '0.45rem' }}>
              <strong style={{ fontSize: '1rem' }}>{section.title}</strong>
              <span style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{section.body}</span>
            </section>
          ))}
        </section>
      </div>
    </main>
  );
}
