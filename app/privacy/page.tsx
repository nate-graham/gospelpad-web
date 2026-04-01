import Link from 'next/link';

const sections = [
  {
    title: '1. Overview',
    body: 'This Privacy Policy explains how Gospel Pad collects, uses, and protects your information.',
  },
  {
    title: '2. Information We Collect',
    body: 'Information you provide may include your email address, display name, notes, prayers, journal entries, voice recordings, and group content. We may also collect device information, app usage metrics, crash data, and diagnostic information. Voice and text data may be temporarily processed by third-party AI providers for transcription or assistance.',
  },
  {
    title: '3. How We Use Your Data',
    body: 'We use your information to provide and operate the service, sync and store your content, enable AI features, improve reliability and performance, and communicate important service updates.',
  },
  {
    title: '4. Bible Translation Licensing',
    body: 'Some scripture translations are public domain or licensed from third-party providers. Licensed translations are only available to eligible users under applicable usage agreements and may be added or removed based on licensing terms.',
  },
  {
    title: '5. Data Sharing',
    body: 'We do not sell personal data. We may share limited data with cloud infrastructure providers, AI service providers, and analytics services where needed to operate the service, subject to appropriate data-protection standards.',
  },
  {
    title: '6. Data Security',
    body: 'We use reasonable administrative, technical, and organisational safeguards to protect your data. No system can guarantee absolute security.',
  },
  {
    title: '7. Data Retention and Deletion',
    body: 'We retain data only as long as necessary to operate the service. You may request account and data deletion by contacting support@gospelpad.com.',
  },
  {
    title: '8. Your Rights (UK / EU / GDPR)',
    body: 'You may have rights to access your data, correct inaccurate data, request deletion, and withdraw consent where applicable.',
  },
  {
    title: '9. Children’s Privacy',
    body: 'Gospel Pad is not intended for children under 13. We do not knowingly collect data from children under 13.',
  },
  {
    title: '10. International Data Transfers',
    body: 'Your data may be processed outside your country of residence. By using the service, you consent to this processing.',
  },
  {
    title: '11. Changes to This Policy',
    body: 'We may update this Privacy Policy periodically. Continued use of the service indicates acceptance of those updates.',
  },
  {
    title: '12. Contact',
    body: 'Privacy enquiries: support@gospelpad.com',
  },
] as const;

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', padding: '1rem', display: 'grid', justifyItems: 'center' }}>
      <div className="page-section shell-page" style={{ width: 'min(100%, 960px)', paddingBottom: '2rem' }}>
        <header className="page-header">
          <div className="cta-row">
            <Link className="button button-secondary" href="/settings">
              Back to settings
            </Link>
          </div>
          <span className="eyebrow">Privacy Policy</span>
          <h1>Privacy Policy</h1>
          <p className="page-description">
            Gospel Pad - Privacy Policy
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
