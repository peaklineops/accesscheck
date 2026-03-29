/**
 * AccessCheck — AI Fix Recommendations
 * Uses Claude to translate axe-core violations into plain-English explanations
 * with step-by-step fix instructions.
 */

import type { ScanIssue } from './scanner';

export interface FixRecommendation {
  issueId: string;
  plainEnglish: string;
  whyItMatters: string;
  howToFix: string;
  codeExample?: string;
  estimatedEffort: 'easy' | 'medium' | 'hard';
}

export async function getFixRecommendations(
  issues: ScanIssue[],
  pageUrl: string
): Promise<FixRecommendation[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Only get AI fixes for the most impactful issues (top 10 to manage cost)
  const prioritized = [...issues]
    .sort((a, b) => {
      const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      return order[a.impact] - order[b.impact];
    })
    .slice(0, 10);

  if (prioritized.length === 0) return [];

  const issuesSummary = prioritized.map((issue, i) => ({
    index: i + 1,
    id: issue.id,
    impact: issue.impact,
    description: issue.description,
    help: issue.help,
    exampleHtml: issue.nodes[0]?.html ?? 'N/A',
    failureSummary: issue.nodes[0]?.failureSummary ?? 'N/A',
  }));

  const prompt = `You are an accessibility expert helping web developers fix WCAG 2.1 violations found on ${pageUrl}.

Here are ${prioritized.length} accessibility issues found on this page:

${JSON.stringify(issuesSummary, null, 2)}

For EACH issue, provide a fix recommendation. Return a JSON array with exactly ${prioritized.length} objects, one per issue, in the same order. Each object must have this exact structure:
{
  "issueId": "<the id field from the issue>",
  "plainEnglish": "What this issue means in plain, non-technical language (1 sentence)",
  "whyItMatters": "Who is affected and how (1-2 sentences about real users)",
  "howToFix": "Step-by-step instructions to fix this (2-4 numbered steps)",
  "codeExample": "A concrete before/after HTML code example if helpful (optional, null if not applicable)",
  "estimatedEffort": "easy|medium|hard"
}

Return ONLY the JSON array, no markdown, no explanation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.content[0].text.trim();

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as FixRecommendation[];
  }
  return JSON.parse(raw) as FixRecommendation[];
}

/**
 * Generate a plain-English executive summary for the scan report.
 */
export async function generateSummary(
  url: string,
  score: number,
  issueCount: { critical: number; serious: number; moderate: number; minor: number; total: number }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '';

  const prompt = `Write a 2-3 sentence executive summary for a website accessibility audit report.

Website: ${url}
Accessibility Score: ${score}/100
Issues found:
- Critical: ${issueCount.critical}
- Serious: ${issueCount.serious}
- Moderate: ${issueCount.moderate}
- Minor: ${issueCount.minor}
- Total: ${issueCount.total}

Write in plain English for a business owner (not a developer). Mention ADA/WCAG compliance risk if critical/serious issues exist. Be honest but constructive. Return only the summary text, no JSON, no formatting.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) return '';

  const data = await response.json();
  return data.content[0].text.trim();
}
