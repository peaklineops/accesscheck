import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { scanUrl } from '@/lib/scanner';
import { getFixRecommendations } from '@/lib/ai-fixes';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as never });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment not completed', paid: false }, { status: 402 });
  }

  const scanUrl_str = session.metadata?.scan_url;
  const reportId = session.metadata?.report_id;

  if (!scanUrl_str || !reportId) {
    return NextResponse.json({ error: 'Session metadata missing' }, { status: 500 });
  }

  try {
    // Re-scan the page to get fresh issue data for AI fix generation
    const scanResult = await scanUrl(scanUrl_str);

    // Generate AI fix recommendations for all issues
    const fixRecommendations = await getFixRecommendations(scanResult.issues, scanUrl_str);

    return NextResponse.json({
      paid: true,
      reportId,
      fixRecommendations,
      ...scanResult,
      aiFixesIncluded: true,
    });
  } catch (err) {
    console.error('Verify payment scan error:', err);
    return NextResponse.json(
      { error: 'Could not generate fix recommendations. Please email support.' },
      { status: 500 }
    );
  }
}
