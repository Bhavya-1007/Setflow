import { NextResponse } from 'next/server';
import { currentUser, hasVerifiedEmail } from '@/lib/account';
import { stripeClient, syncCustomer } from '@/lib/billing';

export const maxDuration = 60;

export async function GET(request) {
  const url = new URL(request.url);
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', url));
  if (!hasVerifiedEmail(user)) return NextResponse.redirect(new URL('/verify-email', url));
  const sessionId = url.searchParams.get('session_id');
  const destination = new URL('/studio?billing=pending', url);
  if (!sessionId?.startsWith('cs_') || !user.stripe_customer_id) {
    return NextResponse.redirect(destination);
  }
  try {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id === user.id && session.customer === user.stripe_customer_id &&
        session.status === 'complete' && session.payment_status === 'paid') {
      const active = await syncCustomer(stripe, user.stripe_customer_id);
      if (active) destination.searchParams.set('billing', 'confirmed');
    }
  } catch (error) {
    console.error('Checkout confirmation pending', { type: error.name, code: error.code });
  }
  return NextResponse.redirect(destination);
}
