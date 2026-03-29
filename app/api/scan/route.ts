import { NextRequest, NextResponse } from 'next/server';
import { scanUrl } from '@/lib/scanner';
import { generateSummary } from '@/lib/ai-fixes';
import { v4 as uuidv4 } from 'uuid';

// Vercel: allow up to 60 seconds for scan (needs Pro plan or higher for >10s)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = await req.json();
    url = body.url?.trim();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: 'Missing required field: url' }, { status: 400 });
  }

  // Normalize URL — add https:// if missing protocol
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  try {
    // Run the scan
    const scanResult = await scanUrl(url);

    // Get AI summary (free tier gets summary, paid gets per-issue fixes)
    let summary = '';
    try {
      summary = await generateSummary(url, scanResult.score, scanResult.issueCount);
    } catch {
      // Non-fatal — continue without AI summary
    }

    const reportId = uuidv4();

    const report = {
      id: reportId,
      summary,
      ...scanResult,
      // Free tier: include all issues but no AI fix recommendations
      // AI fix recommendations are generated on-demand when user pays
      aiFixesIncluded: false,
    };

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed';

    // Known user errors
    if (message.includes('net::ERR_') || message.includes('Navigation timeout')) {
      return NextResponse.json(
        { error: `Could not reach that URL. Make sure the site is publicly accessible.` },
        { status: 422 }
      );
    }
    if (message.includes('Invalid URL') || message.includes('Only HTTP')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('Scan error:', err);
    return NextResponse.json(
      { error: 'Scan failed. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
