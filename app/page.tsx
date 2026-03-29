'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const styles = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' as const },
  header: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' },
  logoSpan: { color: '#2563eb' },
  hero: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' as const },
  badge: { display: 'inline-block', background: '#dbeafe', color: '#1d4ed8', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', marginBottom: '1.5rem' },
  h1: { fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', color: '#0f172a', marginBottom: '1rem', lineHeight: '1.2' },
  subtitle: { fontSize: '1.15rem', color: '#64748b', maxWidth: '520px', marginBottom: '2.5rem' },
  scanForm: { display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '580px', marginBottom: '1rem' },
  input: { flex: 1, padding: '0.875rem 1.25rem', fontSize: '1rem', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none', background: '#fff', transition: 'border-color 0.15s' },
  button: { padding: '0.875rem 1.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' as const, transition: 'background 0.15s' },
  buttonDisabled: { background: '#94a3b8', cursor: 'not-allowed' },
  hint: { fontSize: '0.85rem', color: '#94a3b8' },
  error: { color: '#dc2626', fontSize: '0.9rem', marginTop: '0.5rem' },
  features: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', maxWidth: '800px', margin: '4rem auto 2rem', padding: '0 2rem' },
  featureCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' as const },
  featureIcon: { fontSize: '2rem', marginBottom: '0.75rem' },
  featureTitle: { fontWeight: '600', marginBottom: '0.5rem' },
  featureDesc: { fontSize: '0.9rem', color: '#64748b' },
  pricing: { background: '#fff', borderTop: '1px solid #e2e8f0', padding: '3rem 2rem', textAlign: 'center' as const },
  pricingTitle: { fontSize: '1.5rem', fontWeight: '700', marginBottom: '2rem' },
  pricingGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', maxWidth: '700px', margin: '0 auto' },
  pricingCard: { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' as const },
  pricingCardFeatured: { border: '2px solid #2563eb', background: '#eff6ff' },
  pricingPrice: { fontSize: '2rem', fontWeight: '800', color: '#0f172a' },
  pricingPlan: { fontWeight: '600', marginBottom: '0.5rem' },
  pricingFeatures: { listStyle: 'none', marginTop: '1rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'left' as const },
  footer: { background: '#0f172a', color: '#94a3b8', padding: '1.5rem 2rem', textAlign: 'center' as const, fontSize: '0.85rem' },
  spinner: { display: 'inline-block', width: '1rem', height: '1rem', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginRight: '0.5rem' },
};

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Scan failed. Please try again.');
        setLoading(false);
        return;
      }

      // Store results in sessionStorage so report page can access them
      sessionStorage.setItem(`report-${data.id}`, JSON.stringify(data));
      router.push(`/report/${data.id}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          Access<span style={styles.logoSpan}>Check</span>
        </div>
        <nav>
          <a href="#pricing" style={{ color: '#64748b', fontSize: '0.9rem' }}>Pricing</a>
        </nav>
      </header>

      {/* Hero */}
      <main style={styles.hero}>
        <div style={styles.badge}>Free WCAG 2.1 Checker</div>
        <h1 style={styles.h1}>
          Is Your Website<br />ADA Compliant?
        </h1>
        <p style={styles.subtitle}>
          Paste any URL. Get a full accessibility report in 60 seconds.
          AI-powered fix instructions included — no developer expertise needed.
        </p>

        <form onSubmit={handleScan} style={styles.scanForm}>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            style={styles.input}
            aria-label="Website URL to scan"
            disabled={loading}
          />
          <button
            type="submit"
            style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
            disabled={loading}
          >
            {loading ? 'Scanning...' : 'Scan Free'}
          </button>
        </form>

        {error && <p style={styles.error} role="alert">{error}</p>}
        <p style={styles.hint}>No signup required. Results in ~30-60 seconds.</p>
      </main>

      {/* Features */}
      <section style={styles.features}>
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>⚡</div>
          <div style={styles.featureTitle}>60-Second Scan</div>
          <p style={styles.featureDesc}>Full axe-core powered WCAG 2.1 AA audit in under a minute.</p>
        </div>
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>🤖</div>
          <div style={styles.featureTitle}>AI Fix Guide</div>
          <p style={styles.featureDesc}>Every issue gets plain-English explanation and step-by-step fix instructions.</p>
        </div>
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>📄</div>
          <div style={styles.featureTitle}>PDF Report</div>
          <p style={styles.featureDesc}>Download a professional PDF report to share with clients or developers.</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={styles.pricing}>
        <h2 style={styles.pricingTitle}>Simple Pricing</h2>
        <div style={styles.pricingGrid}>
          <div style={styles.pricingCard}>
            <div style={styles.pricingPlan}>Free</div>
            <div style={styles.pricingPrice}>$0</div>
            <ul style={styles.pricingFeatures}>
              <li>✓ 1 page scan</li>
              <li>✓ Issue summary</li>
              <li>✓ WCAG violation list</li>
              <li>✗ AI fix guide</li>
              <li>✗ PDF export</li>
            </ul>
          </div>
          <div style={{ ...styles.pricingCard, ...styles.pricingCardFeatured }}>
            <div style={styles.pricingPlan}>Report</div>
            <div style={styles.pricingPrice}>$9</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>one-time</div>
            <ul style={styles.pricingFeatures}>
              <li>✓ Full violation report</li>
              <li>✓ AI fix guide</li>
              <li>✓ Code examples</li>
              <li>✓ PDF export</li>
              <li>✓ Shareable link</li>
            </ul>
          </div>
          <div style={styles.pricingCard}>
            <div style={styles.pricingPlan}>Agency</div>
            <div style={styles.pricingPrice}>$49</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>/month</div>
            <ul style={styles.pricingFeatures}>
              <li>✓ Unlimited scans</li>
              <li>✓ Multi-page crawl</li>
              <li>✓ White-label PDF</li>
              <li>✓ API access</li>
              <li>✓ Priority support</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section style={{ maxWidth: '780px', margin: '0 auto 3rem', padding: '0 2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', textAlign: 'center', marginBottom: '2rem' }}>
          Frequently Asked Questions
        </h2>
        {[
          {
            q: 'What is ADA website compliance?',
            a: 'The Americans with Disabilities Act (ADA) requires that websites be accessible to people with disabilities. Courts have increasingly ruled that websites must conform to WCAG 2.1 Level AA standards. Non-compliance can result in lawsuits and fines.',
          },
          {
            q: 'What is WCAG 2.1?',
            a: 'The Web Content Accessibility Guidelines (WCAG) 2.1 are internationally recognized standards for web accessibility published by the W3C. Level AA compliance is the most commonly required standard for ADA compliance and covers issues like color contrast, keyboard navigation, alt text, and screen reader support.',
          },
          {
            q: 'How does AccessCheck work?',
            a: 'AccessCheck uses axe-core — the industry-standard automated accessibility testing engine used by Microsoft, Google, and Deque. It scans your page\'s DOM for WCAG violations and grades them by severity (critical, serious, moderate, minor). The paid report adds AI-generated plain-English explanations and step-by-step fix instructions.',
          },
          {
            q: 'Will this scan make my site fully ADA compliant?',
            a: 'Automated testing catches approximately 30-40% of WCAG violations. It\'s an essential first step and identifies the most common, fixable issues. For full compliance certification, a manual audit by an accessibility expert is also recommended. AccessCheck gives you a fast, actionable starting point.',
          },
          {
            q: 'What does the $9 paid report include?',
            a: 'The full report includes AI-generated fix instructions for every violation — plain-English explanations, who is affected, numbered steps to fix each issue, before/after code examples, and effort estimates. It also includes a downloadable PDF you can share with your developer or use as documentation.',
          },
          {
            q: 'Can I scan any website?',
            a: 'Yes — any publicly accessible URL. You can scan your own site, a competitor\'s site, or a client\'s site. Sites behind a login or on private networks cannot be scanned.',
          },
        ].map(({ q, a }) => (
          <details key={q} style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 0' }}>
            <summary style={{ fontWeight: '600', cursor: 'pointer', fontSize: '1rem', color: '#0f172a' }}>{q}</summary>
            <p style={{ color: '#475569', marginTop: '0.75rem', lineHeight: '1.7', fontSize: '0.95rem' }}>{a}</p>
          </details>
        ))}
      </section>

      <footer style={styles.footer}>
        <p>AccessCheck — Automated WCAG 2.1 Compliance Testing</p>
        <p style={{ marginTop: '0.5rem' }}>
          <a href="mailto:peakline.ops@gmail.com" style={{ color: '#94a3b8' }}>Support</a>
        </p>
      </footer>

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'SoftwareApplication',
                name: 'AccessCheck',
                applicationCategory: 'WebApplication',
                description: 'Free ADA website checker and WCAG 2.1 compliance tool. Scan any URL for accessibility violations in 60 seconds.',
                url: 'https://accesscheck.app',
                offers: [
                  { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free Scan' },
                  { '@type': 'Offer', price: '9', priceCurrency: 'USD', name: 'Full AI Report' },
                  { '@type': 'Offer', price: '49', priceCurrency: 'USD', name: 'Agency Plan (monthly)' },
                ],
              },
              {
                '@type': 'FAQPage',
                mainEntity: [
                  { '@type': 'Question', name: 'What is ADA website compliance?', acceptedAnswer: { '@type': 'Answer', text: 'The Americans with Disabilities Act (ADA) requires websites to be accessible to people with disabilities. Courts have increasingly ruled that websites must conform to WCAG 2.1 Level AA standards.' } },
                  { '@type': 'Question', name: 'What is WCAG 2.1?', acceptedAnswer: { '@type': 'Answer', text: 'The Web Content Accessibility Guidelines (WCAG) 2.1 are internationally recognized web accessibility standards. Level AA is the most commonly required for ADA compliance.' } },
                  { '@type': 'Question', name: 'How does AccessCheck work?', acceptedAnswer: { '@type': 'Answer', text: 'AccessCheck uses axe-core to scan your page for WCAG violations, grading them by severity. The paid report adds AI-generated fix instructions.' } },
                ],
              },
            ],
          }),
        }}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: #2563eb !important; }
        button:hover:not(:disabled) { background: #1d4ed8 !important; }
        details summary::-webkit-details-marker { color: #2563eb; }
        @media (max-width: 640px) {
          .scan-form { flex-direction: column; }
          .features-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
