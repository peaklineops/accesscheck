/**
 * AccessCheck — Core Scanner
 * Uses jsdom + axe-core to audit a URL for WCAG 2.1 violations.
 * Lightweight serverless-compatible approach — no Chromium binary needed.
 * Catches structural/semantic WCAG issues from HTML; JS-rendered content not evaluated.
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import axe from 'axe-core';

export interface ScanIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: {
    html: string;
    target: string;
    failureSummary: string;
  }[];
}

export interface ScanResult {
  url: string;
  scannedAt: string;
  pageTitle: string;
  score: number;
  issueCount: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    total: number;
  };
  issues: ScanIssue[];
  passedCount: number;
  wcagLevels: {
    'wcag2a': number;
    'wcag2aa': number;
    'wcag21aa': number;
  };
}

export async function scanUrl(url: string): Promise<ScanResult> {
  const parsedUrl = new URL(url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }

  // Fetch the page HTML
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'AccessCheck/1.0 (Accessibility Audit Bot; +https://accesscheck-app.netlify.app)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`net::ERR_HTTP_${res.status} Could not reach that URL.`);
  }

  const html = await res.text();

  // Parse HTML in jsdom — suppress noisy console output from page scripts
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, {
    url,
    virtualConsole,
    // 'outside-only': only scripts we programmatically inject will run, not page scripts
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    resources: 'usable',
  });

  const { window } = dom;
  const { document } = window;
  const pageTitle = document.title || '';

  // Inject axe-core into the jsdom context
  const axeScript = window.document.createElement('script');
  axeScript.textContent = axe.source;
  window.document.head.appendChild(axeScript);

  // Run axe-core
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const axeWindow = window as any;
  const axeResults = await axeWindow.axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
    },
  });

  window.close();

  // Transform results
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issues: ScanIssue[] = axeResults.violations.map((v: any) => ({
    id: v.id,
    impact: (v.impact ?? 'minor') as ScanIssue['impact'],
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    tags: v.tags,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodes: v.nodes.slice(0, 5).map((n: any) => ({
      html: n.html.slice(0, 300),
      target: Array.isArray(n.target) ? n.target.join(', ') : String(n.target),
      failureSummary: n.failureSummary ?? '',
    })),
  }));

  const issueCount = {
    critical: issues.filter(i => i.impact === 'critical').length,
    serious: issues.filter(i => i.impact === 'serious').length,
    moderate: issues.filter(i => i.impact === 'moderate').length,
    minor: issues.filter(i => i.impact === 'minor').length,
    total: issues.length,
  };

  const wcagLevels = {
    'wcag2a': issues.filter(i => i.tags.includes('wcag2a')).length,
    'wcag2aa': issues.filter(i => i.tags.includes('wcag2aa')).length,
    'wcag21aa': issues.filter(i => i.tags.includes('wcag21aa')).length,
  };

  const score = Math.max(
    0,
    Math.round(
      100
      - issueCount.critical * 20
      - issueCount.serious * 10
      - issueCount.moderate * 5
      - issueCount.minor * 2
    )
  );

  return {
    url,
    scannedAt: new Date().toISOString(),
    pageTitle,
    score,
    issueCount,
    issues,
    passedCount: axeResults.passes?.length ?? 0,
    wcagLevels,
  };
}
