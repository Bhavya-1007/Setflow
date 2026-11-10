# SetFlow

SetFlow helps student and beginner DJs plan sets from their own tracks. DJs enter the event vibe and target length, then get an editable order, energy curve, and transition notes. Created by Bhavya Poddar.

## Run locally

Requires Node.js 20.9 or newer. Copy .env.example to .env.local and add the values for the services below.

~~~bash
npm ci
npm run db:setup
npm run dev
~~~

Open http://localhost:3000.

## Connect the existing Vercel project

1. Connect a Neon Postgres database under **Storage**. Connect both Production and Preview, with a separate database branch for previews. The integration supplies DATABASE_URL.
2. In **Settings → Environment Variables**, add OPENAI_API_KEY. SetFlow uses gpt-4.1-mini by default. OPENAI_MODEL can select another model that supports Structured Outputs.
3. In a Stripe sandbox, create **SetFlow Pro** with a **$10 USD monthly recurring** price. Add the sandbox secret key as STRIPE_SECRET_KEY and the recurring price ID as STRIPE_PRICE_ID.
4. In Stripe, add a webhook destination at the production site URL followed by **/api/billing/webhook**. Subscribe to checkout.session.completed, customer.subscription.created, customer.subscription.updated, and customer.subscription.deleted. Add its signing secret as STRIPE_WEBHOOK_SECRET. Use the matching sandbox for the key, price, and webhook.
5. Deploy the Week 2 branch with the default Next.js settings. The build applies the Neon schema and creates the course demo account when DATABASE_URL is present. Check the preview before promoting the update to production.

Keep actual values in Vercel or a local ignored environment file. The .env.example file documents the variable names.

## Check the Week 2 flows

- Sign up, log out, and log in again with the same account.
- In the Studio, load the sample tracks and generate a set. Change the order, save it, and reopen it under Saved sets.
- Start Stripe checkout from a free account. Complete a sandbox payment and confirm the account shows Pro and can export CSV.
- Log in through the regular form with the assignment’s course demo credentials. The account should show Demo · Pro.
- For Canvas, capture the production Neon users table after creating several accounts through signup. Include a fresh signup made just before submission. Show email, name, and creation time in the screenshot.
