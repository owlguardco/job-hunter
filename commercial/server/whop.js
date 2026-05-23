/**
 * Job Hunter — Whop Integration
 *
 * Handles Whop webhook events to fulfill purchases and
 * manage membership status.
 *
 * Key events:
 *   membership.went_valid   — purchase confirmed, grant credits
 *   membership.went_invalid — subscription cancelled/failed, revoke unlimited
 *   payment.succeeded       — one-time payment confirmed
 */

const { Webhook } = require('svix');

// ── Plan → credits mapping ────────────────────────────────
// Fill in your actual Whop Plan IDs from the dashboard
// Format: plan_xxxxxxxxxxxx
const PLAN_CREDITS = {
  [process.env.WHOP_PLAN_STARTER]:  { credits: 25,   type: 'one-time',  amount: 500  },
  [process.env.WHOP_PLAN_PRO]:      { credits: 100,  type: 'one-time',  amount: 1500 },
  [process.env.WHOP_PLAN_MONTHLY]:  { credits: null, type: 'monthly',   amount: 1900 },
};

// ── Verify Whop webhook signature ────────────────────────
// Whop uses Standard Webhooks spec — same as Clerk (Svix)
function verifyWhopWebhook(payload, headers, secret) {
  try {
    const wh = new Webhook(secret);
    return wh.verify(payload, headers);
  } catch (err) {
    console.error('Whop webhook verification failed:', err.message);
    return null;
  }
}

// ── Main webhook handler ──────────────────────────────────
async function handleWhopWebhook(rawPayload, headers, db) {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    console.error('WHOP_WEBHOOK_SECRET not set');
    return { status: 500, body: { error: 'Webhook secret not configured' } };
  }

  // Verify signature
  const svixHeaders = {
    'svix-id':        headers['svix-id'],
    'svix-timestamp': headers['svix-timestamp'],
    'svix-signature': headers['svix-signature'],
  };

  if (!svixHeaders['svix-id']) {
    return { status: 400, body: { error: 'Missing Svix headers' } };
  }

  const payload = verifyWhopWebhook(rawPayload.toString(), svixHeaders, secret);
  if (!payload) {
    return { status: 400, body: { error: 'Invalid webhook signature' } };
  }

  const { event, data } = payload;
  console.log(`Whop webhook: ${event}`, data?.id);

  // ── membership.went_valid — grant access ───────────────
  if (event === 'membership.went_valid') {
    const membership = data;
    const userId = membership.user?.id || membership.discord?.id;
    const email = membership.user?.email;
    const planId = membership.plan?.id;
    const plan = PLAN_CREDITS[planId];

    if (!email) {
      console.error('Whop webhook: no email in membership data');
      return { status: 200, body: { received: true } }; // don't retry
    }

    try {
      // Ensure user exists in our DB (create if first-time Whop buyer)
      await db.query(
        `INSERT INTO users (id, email) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [userId || email, email]
      );

      // Get internal user ID
      const userResult = await db.query(
        'SELECT id FROM users WHERE email = $1', [email]
      );
      const internalUserId = userResult.rows[0]?.id;
      if (!internalUserId) throw new Error('User not found after upsert');

      // Ensure credits row exists
      await db.query(
        `INSERT INTO credits (user_id, balance) VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [internalUserId]
      );

      if (plan?.type === 'monthly') {
        // Set unlimited for 31 days
        const until = new Date();
        until.setDate(until.getDate() + 31);
        await db.query(
          `UPDATE credits SET unlimited_until = $2, updated_at = NOW()
           WHERE user_id = $1`,
          [internalUserId, until]
        );
        console.log(`Whop: granted monthly unlimited to ${email} until ${until.toISOString()}`);
      } else if (plan?.credits) {
        // Add one-time credits
        await db.query(
          `UPDATE credits SET balance = balance + $2, updated_at = NOW()
           WHERE user_id = $1`,
          [internalUserId, plan.credits]
        );
        console.log(`Whop: added ${plan.credits} credits to ${email}`);
      } else {
        // Unknown plan — grant a default of 25 credits
        await db.query(
          `UPDATE credits SET balance = balance + 25, updated_at = NOW()
           WHERE user_id = $1`,
          [internalUserId]
        );
        console.log(`Whop: unknown plan ${planId}, granted 25 default credits to ${email}`);
      }

      // Log purchase
      await db.query(
        `INSERT INTO purchases
         (user_id, stripe_session_id, pack_type, credits_added, amount_cents, status)
         VALUES ($1, $2, $3, $4, $5, 'complete')
         ON CONFLICT (stripe_session_id) DO NOTHING`,
        [internalUserId, `whop_${membership.id}`, plan?.type || 'whop',
         plan?.credits || 25, plan?.amount || 0]
      );

    } catch (err) {
      console.error('Whop fulfillment error:', err.message);
      return { status: 500, body: { error: err.message } };
    }
  }

  // ── membership.went_invalid — revoke monthly ──────────
  if (event === 'membership.went_invalid') {
    const membership = data;
    const email = membership.user?.email;
    const planId = membership.plan?.id;
    const plan = PLAN_CREDITS[planId];

    if (email && plan?.type === 'monthly') {
      try {
        // Clear unlimited_until for monthly cancellations
        await db.query(
          `UPDATE credits SET unlimited_until = NULL, updated_at = NOW()
           WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
          [email]
        );
        console.log(`Whop: revoked monthly unlimited from ${email}`);
      } catch (err) {
        console.error('Whop revoke error:', err.message);
      }
    }
  }

  return { status: 200, body: { received: true } };
}

module.exports = { handleWhopWebhook };
