'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CheckoutInner() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('report');
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!reportId) {
      setErrorMsg('No report specified.');
      setStatus('error');
      return;
    }

    const stored = sessionStorage.getItem(`report-${reportId}`);
    if (!stored) {
      setErrorMsg('Report not found. Please run a new scan first.');
      setStatus('error');
      return;
    }

    const report = JSON.parse(stored);

    // Create Stripe Checkout Session via our API
    fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId: report.id,
        url: report.url,
        issueCount: report.issueCount.total,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.checkoutUrl) {
          // Also save report to localStorage for retrieval after Stripe redirect
          localStorage.setItem(`pending-report-${reportId}`, stored);
          window.location.href = data.checkoutUrl;
        } else {
          setErrorMsg(data.error || 'Failed to create checkout session.');
          setStatus('error');
        }
      })
      .catch(() => {
        setErrorMsg('Network error. Please try again.');
        setStatus('error');
      });
  }, [reportId]);

  if (status === 'error') {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ marginBottom: '1rem', color: '#dc2626' }}>Checkout Error</h1>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>{errorMsg}</p>
        <a href="/" style={{ background: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
          Run a new scan
        </a>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
      <h1 style={{ marginBottom: '0.5rem', color: '#0f172a' }}>Redirecting to secure checkout…</h1>
      <p style={{ color: '#64748b' }}>You&apos;ll be redirected to Stripe. Your report will be waiting when you return.</p>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#f8fafc' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem' }}>
        <a href="/" style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' }}>
          Access<span style={{ color: '#2563eb' }}>Check</span>
        </a>
      </header>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Suspense fallback={<div style={{ textAlign: 'center', color: '#64748b' }}>Loading…</div>}>
          <CheckoutInner />
        </Suspense>
      </main>
    </div>
  );
}
