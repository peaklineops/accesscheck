export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 });
  }

  let body: { reportId: string; url: string; issueCount: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { reportId, url, issueCount } = body;
  if (!reportId || !url) {
    return NextResponse.json({ error: 'Missing reportId or url' }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as never });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://accesscheck.app';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 900, // $9.00
            product_data: {
              name: 'AccessCheck Full Report',
              description: `AI-powered fix guide for ${issueCount} accessibility violation${issueCount !== 1 ? 's' : ''} found on ${url}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        report_id: reportId,
        scan_url: url.slice(0, 400), // Stripe metadata values max 500 chars
      },
      success_url: `${appUrl}/report/${reportId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/report/${reportId}`,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
