import { createHash } from 'node:crypto';
import Stripe from 'stripe';

import { SetupError, transaction } from './db.mjs';
import { ApiError } from './http';

export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    throw new SetupError('Stripe checkout is being connected. Please try again soon.');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 1 });
}

export function checkoutIsTest() {
  return process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || process.env.STRIPE_SECRET_KEY?.startsWith('rk_test_');
}

function isSetFlowSubscription(subscription, userId) {
  return subscription.metadata?.setflow_user_id === userId &&
    subscription.items.data.some((item) => item.price.id === process.env.STRIPE_PRICE_ID);
}

async function refreshSubscription(client, stripe, user) {
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripe_customer_id,
    status: 'all',
    limit: 50,
  });
  const subscription = subscriptions.data.find((item) =>
    ['active', 'trialing'].includes(item.status) && isSetFlowSubscription(item, user.id)
  );
  await client.query(
    'UPDATE users SET stripe_subscription_id = $1, subscription_status = $2 WHERE id = $3',
    [subscription?.id ?? null, subscription?.status ?? null, user.id]
  );
  return Boolean(subscription);
}

export async function syncCustomer(stripe, customerId) {
  return transaction(async (client) => {
    const { rows: [user] } = await client.query(
      'SELECT * FROM users WHERE stripe_customer_id = $1 FOR UPDATE',
      [customerId]
    );
    if (!user) return false;
    return refreshSubscription(client, stripe, user);
  });
}

export async function beginCheckout(stripe, userId, origin) {
  return transaction(async (client) => {
    const { rows: [user] } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user) throw new ApiError(401, 'Log in to continue.');
    if (user.is_demo) return { active: true };

    if (user.stripe_customer_id) {
      if (await refreshSubscription(client, stripe, user)) return { active: true };
    } else {
      const customer = await stripe.customers.create(
        { email: user.email, name: user.name, metadata: { setflow_user_id: user.id } },
        { idempotencyKey: 'setflow-customer-' + user.id }
      );
      user.stripe_customer_id = customer.id;
      await client.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customer.id, user.id]);
    }

    if (user.stripe_checkout_id) {
      const previous = await stripe.checkout.sessions.retrieve(user.stripe_checkout_id);
      if (previous.status === 'open' && previous.url) return { url: previous.url };
      if (previous.status === 'complete' && previous.payment_status === 'unpaid') {
        throw new ApiError(409, 'Stripe is still confirming your payment.');
      }
    }

    const checkoutParams = {
      mode: 'subscription',
      customer: user.stripe_customer_id,
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { setflow_user_id: user.id },
      subscription_data: { metadata: { setflow_user_id: user.id } },
      success_url: origin + '/billing/return?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/studio?billing=cancelled',
    };
    // Stripe can replay a key only when the Checkout Session parameters match.
    const idempotencyKey = 'setflow-checkout-' + createHash('sha256')
      .update(JSON.stringify({ previousCheckoutId: user.stripe_checkout_id, checkoutParams }))
      .digest('hex');
    const session = await stripe.checkout.sessions.create(checkoutParams, { idempotencyKey });

    if (!session.url) throw new ApiError(502, 'Stripe couldn’t open checkout. Please try again.');
    await client.query('UPDATE users SET stripe_checkout_id = $1 WHERE id = $2', [session.id, user.id]);
    return { url: session.url };
  });
}
