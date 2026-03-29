'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface ScanIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: { html: string; target: string; failureSummary: string }[];
}

interface FixRecommendation {
  issueId: string;
  plainEnglish: string;
  whyItMatters: string;
  howToFix: string;
  codeExample?: string;
  estimatedEffort: 'easy' | 'medium' | 'hard';
}

interface Report {
  id: string;
  url: string;
  scannedAt: string;
  pageTitle: string;
  score: number;
  summary: string;
  issueCount: { critical: number; serious: number; moderate: number; minor: number; total: number };
  issues: ScanIssue[];
  passedCount: number;
  wcagLevels: { wcag2a: number; wcag2aa: number; wcag21aa: number };
  aiFixesIncluded: boolean;
  fixRecommendations?: FixRecommendation[];
}

const impactColors: Record<string, string> = {
  critical: '#dc2626',
  serious: '#ea580c',
  moderate: '#d97706',
  minor: '#059669',
};

const impactBg: Record<string, string> = {
  critical: '#fef2f2',
  serious: '#fff7ed',
  moderate: '#fffbeb',
  minor: '#f0fdf4',
};

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <div style={{
      width: '120px', height: '120px', borderRadius: '50%',
      border: `8px solid ${color}`, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
    }}>
      <span style={{ fontSize: '2.5rem', fontWeight: '800', color }}>{score}</span>
      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>/ 100</span>
    </div>
  );
}

function IssueCard({ issue }: { issue: ScanIssue }) {
  const [expanded, setExpanded] = useState(false);
  const color = impactColors[issue.impact];
  const bg = impactBg[issue.impact];

  return (
    <div style={{ border: `1px solid ${color}30`, borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center',
          gap: '0.75rem', background: bg, border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          padding: '2px 8px', borderRadius: '4px', background: color, color: '#fff',
          fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', flexShrink: 0,
        }}>
          {issue.impact}
        </span>
        <span style={{ fontWeight: '600', flex: 1 }}>{issue.help}</span>
        <span style={{ color: '#94a3b8', fontSize: '1.2rem' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '1.25rem', background: '#fff' }}>
          <p style={{ marginBottom: '1rem', color: '#475569' }}>{issue.description}</p>

          {issue.nodes.slice(0, 3).map((node, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              <div style={{ color: '#64748b', marginBottom: '0.5rem' }}>Element: <strong>{node.target}</strong></div>
              <div style={{ color: '#dc2626', marginBottom: '0.5rem' }}>{node.failureSummary}</div>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#0f172a' }}>{node.html}</pre>
            </div>
          ))}

          <a href={issue.helpUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }}>
            WCAG reference →
          </a>
        </div>
      )}
    </div>
  );
}

export default function ReportPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const sessionId = searchParams.get('session_id');
  const [report, setReport] = useState<Report | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem(`report-${id}`)
      || localStorage.getItem(`pending-report-${id}`);

    if (stored) {
      const parsed = JSON.parse(stored);
      setReport(parsed);

      // If returning from Stripe with session_id, fetch unlocked AI fixes
      if (sessionId && !parsed.aiFixesIncluded) {
        setUnlocking(true);
        fetch(`/api/verify-payment?session_id=${sessionId}`)
          .then(res => res.json())
          .then(data => {
            if (data.paid && data.fixRecommendations) {
              const unlocked = { ...parsed, aiFixesIncluded: true, fixRecommendations: data.fixRecommendations };
              setReport(unlocked);
              sessionStorage.setItem(`report-${id}`, JSON.stringify(unlocked));
              localStorage.removeItem(`pending-report-${id}`);
            } else {
              setUnlockError(data.error || 'Could not verify payment. Please contact support.');
            }
          })
          .catch(() => setUnlockError('Network error verifying payment. Please contact support.'))
          .finally(() => setUnlocking(false));
      }
    } else {
      setNotFound(true);
    }
  }, [id, sessionId]);

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>Report not found</h1>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>This report has expired or the link is invalid.</p>
        <a href="/" style={{ background: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '8px' }}>
          Run a new scan
        </a>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <p style={{ color: '#64748b' }}>Loading report...</p>
      </div>
    );
  }

  const critical = report.issues.filter(i => i.impact === 'critical');
  const serious = report.issues.filter(i => i.impact === 'serious');
  const moderate = report.issues.filter(i => i.impact === 'moderate');
  const minor = report.issues.filter(i => i.impact === 'minor');

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' }}>
          Access<span style={{ color: '#2563eb' }}>Check</span>
        </a>
        <a href="/" style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
          New Scan
        </a>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {/* Score Summary */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', marginBottom: '1.5rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <ScoreCircle score={report.score} />
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>
            {report.pageTitle || report.url}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
            {report.url} — Scanned {new Date(report.scannedAt).toLocaleString()}
          </p>

          {report.summary && (
            <p style={{ color: '#475569', maxWidth: '600px', margin: '0 auto 1.5rem', lineHeight: '1.7' }}>
              {report.summary}
            </p>
          )}

          {/* Issue count badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Critical', count: report.issueCount.critical, color: '#dc2626', bg: '#fef2f2' },
              { label: 'Serious', count: report.issueCount.serious, color: '#ea580c', bg: '#fff7ed' },
              { label: 'Moderate', count: report.issueCount.moderate, color: '#d97706', bg: '#fffbeb' },
              { label: 'Minor', count: report.issueCount.minor, color: '#059669', bg: '#f0fdf4' },
              { label: 'Passed', count: report.passedCount, color: '#2563eb', bg: '#eff6ff' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: '8px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color }}>{count}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Unlocking status */}
        {unlocking && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: '#1d4ed8', fontWeight: '600' }}>Payment confirmed — generating AI fix guide…</p>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.25rem' }}>This takes about 15 seconds.</p>
          </div>
        )}
        {unlockError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ color: '#dc2626', fontWeight: '600' }}>Payment verification issue</p>
            <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.25rem' }}>{unlockError}</p>
          </div>
        )}

        {/* AI Fix Upsell (free tier) */}
        {!report.aiFixesIncluded && !unlocking && report.issueCount.total > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <strong>Get AI-powered fix instructions for every issue</strong>
              <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Plain-English explanations + code examples for all {report.issueCount.total} violations. Includes PDF report.
              </p>
            </div>
            <a
              href={`/checkout?report=${report.id}`}
              style={{ background: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}
            >
              Unlock Full Report — $9
            </a>
          </div>
        )}

        {/* AI Fix Recommendations (paid tier) */}
        {report.aiFixesIncluded && report.fixRecommendations && report.fixRecommendations.length > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#16a34a' }}>AI Fix Guide</h2>
              <button
                onClick={() => window.print()}
                style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
              >
                Download PDF
              </button>
            </div>
            {report.fixRecommendations.map(fix => (
              <div key={fix.issueId} style={{ background: '#fff', borderRadius: '8px', padding: '1.25rem', marginBottom: '1rem', border: '1px solid #d1fae5' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700',
                    background: fix.estimatedEffort === 'easy' ? '#d1fae5' : fix.estimatedEffort === 'medium' ? '#fef9c3' : '#fee2e2',
                    color: fix.estimatedEffort === 'easy' ? '#16a34a' : fix.estimatedEffort === 'medium' ? '#92400e' : '#dc2626',
                    flexShrink: 0,
                  }}>
                    {fix.estimatedEffort.toUpperCase()}
                  </span>
                  <strong style={{ flex: 1 }}>{fix.plainEnglish}</strong>
                </div>
                <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{fix.whyItMatters}</p>
                <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.875rem', fontSize: '0.875rem', color: '#1e293b', whiteSpace: 'pre-line' }}>
                  {fix.howToFix}
                </div>
                {fix.codeExample && (
                  <pre style={{ marginTop: '0.75rem', background: '#0f172a', color: '#e2e8f0', padding: '1rem', borderRadius: '6px', fontSize: '0.8rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {fix.codeExample}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Issues by impact */}
        {report.issueCount.total === 0 ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ color: '#16a34a', marginBottom: '0.5rem' }}>No violations found!</h2>
            <p style={{ color: '#475569' }}>This page passed all {report.passedCount} axe-core accessibility checks.</p>
          </div>
        ) : (
          <>
            {critical.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#dc2626', marginBottom: '1rem' }}>
                  Critical ({critical.length})
                </h2>
                {critical.map(issue => <IssueCard key={issue.id} issue={issue} />)}
              </section>
            )}
            {serious.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ea580c', marginBottom: '1rem' }}>
                  Serious ({serious.length})
                </h2>
                {serious.map(issue => <IssueCard key={issue.id} issue={issue} />)}
              </section>
            )}
            {moderate.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#d97706', marginBottom: '1rem' }}>
                  Moderate ({moderate.length})
                </h2>
                {moderate.map(issue => <IssueCard key={issue.id} issue={issue} />)}
              </section>
            )}
            {minor.length > 0 && (
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#059669', marginBottom: '1rem' }}>
                  Minor ({minor.length})
                </h2>
                {minor.map(issue => <IssueCard key={issue.id} issue={issue} />)}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
