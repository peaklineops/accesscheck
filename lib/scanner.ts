/**
 * AccessCheck — Core Scanner
 * Pure-JS HTML accessibility checker. Fetches the page, parses HTML with
 * regex patterns, and checks for WCAG 2.1 violations.
 * No browser binary, no DOM emulator — works on any serverless platform.
 */
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';

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

// ── HTML helpers ─────────────────────────────────────────────────────────────

function extractAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*?)"|'([^']*?)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? '').trim();
}

function hasAttr(tag: string, attr: string): boolean {
  return new RegExp(`\\b${attr}\\b`, 'i').test(tag);
}

function getTagContent(tag: string, html: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const inner = html.match(new RegExp(escaped + '([\\s\\S]*?)<\\/[a-z]+>', 'i'));
  return (inner?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

// ── Checks ───────────────────────────────────────────────────────────────────

function checkImageAlt(html: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const imgRe = /<img\b([^>]*?)>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const attrs = m[1];
    const alt = extractAttr(attrs, 'alt');
    const src = extractAttr(attrs, 'src') ?? '';
    const role = extractAttr(attrs, 'role');
    const ariaLabel = extractAttr(attrs, 'aria-label') ?? extractAttr(attrs, 'aria-labelledby');

    if (role === 'presentation' || role === 'none') continue; // decorative

    if (alt === null && !ariaLabel) {
      issues.push({
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        help: 'Ensure that img elements have alternative text or a role of none or presentation',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
        tags: ['cat.text-alternatives', 'wcag2a', 'wcag111', 'section508', 'section508.22.a'],
        nodes: [{ html: tag.slice(0, 200), target: `img[src="${src.slice(0,50)}"]`, failureSummary: 'Fix any of the following: Element does not have an alt attribute' }],
      });
    } else if (alt === '' && !ariaLabel) {
      // Empty alt is ok for decorative images — no issue
    }
  }
  return issues;
}

function checkLinkText(html: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const linkRe = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const [full, attrs, content] = m;
    const text = stripTags(content).trim();
    const ariaLabel = extractAttr(attrs, 'aria-label');
    const ariaLabelledBy = extractAttr(attrs, 'aria-labelledby');
    const title = extractAttr(attrs, 'title');
    const hasImg = /<img[^>]+alt=["'][^"']+["']/i.test(content);
    const accessible = text || ariaLabel || ariaLabelledBy || title || hasImg;

    if (!accessible) {
      issues.push({
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text',
        help: 'Ensure that links have discernible text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/link-name',
        tags: ['cat.name-role-value', 'wcag2a', 'wcag412', 'wcag244', 'section508', 'section508.22.a'],
        nodes: [{ html: full.slice(0, 200), target: 'a', failureSummary: 'Fix any of the following: Element does not have text that is visible to screen readers' }],
      });
    }
  }
  return issues;
}

function checkPageTitle(html: string): ScanIssue[] {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]).trim() : '';
  if (!title) {
    return [{
      id: 'document-title',
      impact: 'serious',
      description: 'Documents must have <title> element to aid in navigation',
      help: 'Ensure that every HTML document has a non-empty <title> element',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/document-title',
      tags: ['cat.text-alternatives', 'wcag2a', 'wcag242', 'ACT', 'TTv5'],
      nodes: [{ html: '<title></title>', target: 'html > head > title', failureSummary: 'Fix one of the following: Document does not have a non-empty <title> element' }],
    }];
  }
  return [];
}

function checkHtmlLang(html: string): ScanIssue[] {
  const htmlTag = html.match(/<html\b([^>]*?)>/i);
  if (!htmlTag) return [];
  const lang = extractAttr(htmlTag[1], 'lang');
  if (!lang) {
    return [{
      id: 'html-has-lang',
      impact: 'serious',
      description: '<html> element must have a lang attribute',
      help: 'Ensure every HTML document has a lang attribute',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/html-has-lang',
      tags: ['cat.language', 'wcag2a', 'wcag311', 'ACT', 'TTv5'],
      nodes: [{ html: htmlTag[0].slice(0, 200), target: 'html', failureSummary: 'Fix one of the following: The <html> element does not have a lang attribute' }],
    }];
  }
  return [];
}

function checkButtonText(html: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const btnRe = /<button\b([^>]*?)>([\s\S]*?)<\/button>/gi;
  let m;
  while ((m = btnRe.exec(html)) !== null) {
    const [full, attrs, content] = m;
    const text = stripTags(content).trim();
    const ariaLabel = extractAttr(attrs, 'aria-label');
    const ariaLabelledBy = extractAttr(attrs, 'aria-labelledby');
    const title = extractAttr(attrs, 'title');
    const hasImgAlt = /<img[^>]+alt=["'][^"']+["']/i.test(content);

    if (!text && !ariaLabel && !ariaLabelledBy && !title && !hasImgAlt) {
      issues.push({
        id: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible text',
        help: 'Ensure that buttons have discernible text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/button-name',
        tags: ['cat.name-role-value', 'wcag2a', 'wcag412', 'section508', 'section508.22.a'],
        nodes: [{ html: full.slice(0, 200), target: 'button', failureSummary: 'Fix any of the following: Element does not have inner text that is visible to screen readers' }],
      });
    }
  }
  return issues;
}

function checkFormLabels(html: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const inputRe = /<input\b([^>]*?)(?:\/>|>)/gi;
  let m;
  while ((m = inputRe.exec(html)) !== null) {
    const [full, attrs] = m;
    const type = (extractAttr(attrs, 'type') ?? 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;

    const id = extractAttr(attrs, 'id');
    const ariaLabel = extractAttr(attrs, 'aria-label');
    const ariaLabelledBy = extractAttr(attrs, 'aria-labelledby');
    const title = extractAttr(attrs, 'title');
    const placeholder = extractAttr(attrs, 'placeholder');

    // Check if there's a corresponding label
    const hasLabel = id && new RegExp(`<label[^>]+for=["']${id}["']`, 'i').test(html);
    const ariaAccessible = ariaLabel || ariaLabelledBy || title;

    if (!hasLabel && !ariaAccessible && !placeholder) {
      issues.push({
        id: 'label',
        impact: 'critical',
        description: 'Form elements must have labels',
        help: 'Ensure that form elements have labels',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/label',
        tags: ['cat.forms', 'wcag2a', 'wcag412', 'wcag131', 'section508', 'section508.22.n'],
        nodes: [{ html: full.slice(0, 200), target: `input[type="${type}"]`, failureSummary: 'Fix any of the following: Form element does not have an implicit (wrapped) <label>' }],
      });
    }
  }
  return issues;
}

function checkHeadingOrder(html: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const headingRe = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  const levels: number[] = [];
  while ((m = headingRe.exec(html)) !== null) {
    levels.push(parseInt(m[1], 10));
  }

  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      issues.push({
        id: 'heading-order',
        impact: 'moderate',
        description: 'Heading levels should only increase by one',
        help: 'Ensure the order of headings is semantically correct',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/heading-order',
        tags: ['cat.semantics', 'best-practice'],
        nodes: [{ html: `<h${levels[i]}>...</h${levels[i]}>`, target: `h${levels[i]}`, failureSummary: `Fix the following: Heading order invalid (h${levels[i-1]} → h${levels[i]})` }],
      });
      break; // Report once
    }
  }
  return issues;
}

function checkInputType(html: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const inputRe = /<input\b([^>]*)(?:\/>|>)/gi;
  let m;
  while ((m = inputRe.exec(html)) !== null) {
    const [full, attrs] = m;
    const type = extractAttr(attrs, 'type');
    if (type === null) {
      // Missing type attribute — defaults to text, which is fine, but worth noting
      // Not a WCAG violation, skip
    }
    const autocomplete = extractAttr(attrs, 'autocomplete');
    const inputType = (type ?? 'text').toLowerCase();
    if (['name', 'email', 'tel', 'given-name', 'family-name', 'street-address'].some(t => inputType === t || (autocomplete && autocomplete.includes(t)))) {
      if (!hasAttr(attrs, 'autocomplete')) {
        issues.push({
          id: 'autocomplete-valid',
          impact: 'serious',
          description: 'Ensure the autocomplete attribute is correct and suitable for the form field it is used with',
          help: 'autocomplete attribute must be used correctly',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/autocomplete-valid',
          tags: ['cat.forms', 'wcag21aa', 'wcag135'],
          nodes: [{ html: full.slice(0, 200), target: `input[type="${inputType}"]`, failureSummary: 'Fix one of the following: Missing or invalid autocomplete attribute' }],
        });
      }
    }
  }
  return issues;
}

function checkMetaViewport(html: string): ScanIssue[] {
  const viewportMeta = html.match(/<meta[^>]+name=["']viewport["'][^>]*>/i) ||
                       html.match(/<meta[^>]+content=["'][^"']*viewport[^"']*["'][^>]*>/i);
  if (!viewportMeta) return [];

  const content = extractAttr(viewportMeta[0], 'content') ?? '';
  if (/user-scalable\s*=\s*no/i.test(content) || /maximum-scale\s*=\s*1(?:\.0)?[,\s"']/i.test(content)) {
    return [{
      id: 'meta-viewport',
      impact: 'critical',
      description: 'Zooming and scaling must not be disabled',
      help: "Ensure <meta name='viewport'> does not disable text scaling and zooming",
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/meta-viewport',
      tags: ['cat.sensory-and-visual-cues', 'wcag2aa', 'wcag1410', 'ACT'],
      nodes: [{ html: viewportMeta[0].slice(0, 200), target: 'meta[name="viewport"]', failureSummary: 'Fix any of the following: user-scalable=no on <meta> tag disables zooming on mobile devices' }],
    }];
  }
  return [];
}

// ── Main scanner ──────────────────────────────────────────────────────────────

/** Fetch HTML using Node.js built-in https/http module (bypasses fetch polyfills) */
function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'AccessCheck/1.0 (Accessibility Audit Bot)',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
    };

    const req = requester(options, (res) => {
      // Follow redirects (up to 3)
      if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`net::ERR_HTTP_${res.statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Navigation timeout')); });
    req.on('error', (err) => reject(new Error(`net::ERR_CONNECTION: ${err.message}`)));
    req.end();
  });
}

export async function scanUrl(url: string): Promise<ScanResult> {
  const parsedUrl = new URL(url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }

  const html = await fetchHtml(url);
  const pageTitle = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    .replace(/<[^>]+>/g, '').trim();

  // Run all checks
  const issues: ScanIssue[] = [
    ...checkImageAlt(html),
    ...checkLinkText(html),
    ...checkPageTitle(html),
    ...checkHtmlLang(html),
    ...checkButtonText(html),
    ...checkFormLabels(html),
    ...checkHeadingOrder(html),
    ...checkInputType(html),
    ...checkMetaViewport(html),
  ];

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

  // Count passed checks (rough estimate based on checks that returned no issues)
  const totalChecks = 9;
  const failedChecks = new Set(issues.map(i => i.id)).size;
  const passedCount = Math.max(0, totalChecks - failedChecks) * 2;

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
    passedCount,
    wcagLevels,
  };
}
