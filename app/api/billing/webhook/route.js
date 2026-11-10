import { NextResponse } from 'next/server';
import { stripeClient, syncCustomer } from '@/lib/billing';
import { SetupError } from '@/lib/db.mjs';
import { ApiError, apiFailure } from '@/lib/http';

export const maxDuration = 60;
const events = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

export async function POST(request) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new SetupError('Stripe webhook is being connected.');
    const signature = request.headers.get('stripe-signature');
    if (!signature) throw new ApiError(400, 'Missing Stripe signature.');
    const stripe = stripeClient();
    const payload = await request.text();
    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new ApiError(400, 'Invalid Stripe signature.');
    }
    if (events.has(event.type)) {
      const customer = event.data.object.customer;
      if (typeof customer === 'string') await syncCustomer(stripe, customer);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return apiFailure(error, 'Stripe event');
  }
}
