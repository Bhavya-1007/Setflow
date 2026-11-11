import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/account';
import { beginCheckout, stripeClient } from '@/lib/billing';
import { SetupError } from '@/lib/db.mjs';
import { apiFailure, checkOrigin } from '@/lib/http';

export const maxDuration = 60;

export async function POST(request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new SetupError('Stripe checkout is being connected. Please try again soon.');
    }
    const origin = request.headers.get('origin') || new URL(request.url).origin;
    const checkout = await beginCheckout(stripeClient(), user.id, origin);
    return NextResponse.json(checkout);
  } catch (error) {
    return apiFailure(error, 'Start checkout');
  }
}
