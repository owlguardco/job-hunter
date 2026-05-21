# Commercial Deployment Guide

Step-by-step guide to deploying the hosted, pay-per-use version of Job Hunter.

Estimated time: 2-3 hours for a complete production setup.

---

## Overview

```
User signs up (Clerk)
  → Buys credits (Stripe Checkout)
    → Stripe webhook credits their account (PostgreSQL)
      → They run tools (commercial/server/index.js)
        → Server calls Anthropic with your key
          → Credits deducted, usage logged
            → You keep the margin
```

---

## Step 1 — Set up the database (Railway)

1. Go to [railway.app](https://railway.app) and create a new project
2. Add a **PostgreSQL** service
3. Copy the `DATABASE_URL` from the connect tab
4. Run the schema:

```bash
cd job-hunter/commercial
cp .env.example .env
# Add DATABASE_URL to .env
npm install
npm run db:migrate
```

Verify:
```bash
psql $DATABASE_URL -c "\dt"
# Should show: users, credits, purchases, usage
```

---

## Step 2 — Set up Clerk (auth)

1. Go to [clerk.com](https://clerk.com) and create an application
2. Name it "Job Hunter"
3. Enable **Email** and **Google** sign-in methods
4. Go to **API Keys** and copy:
   - `CLERK_PUBLISHABLE_KEY` → starts with `pk_live_`
   - `CLERK_SECRET_KEY` → starts with `sk_live_`
5. Add both to your `.env`

**Set up the webhook:**
1. In Clerk dashboard → Webhooks → Add endpoint
2. URL: `https://your-domain.com/webhooks/clerk`
3. Events: `user.created`, `user.updated`
4. Copy the signing secret (not needed for this implementation — we parse the payload directly)

**Add the publishable key to the web UI:**

Open `commercial/web/index.html` and add this meta tag inside `<head>`:
```html
<meta name="clerk-key" content="pk_live_YOUR_KEY_HERE" />
```

---

## Step 3 — Set up Stripe (payments)

1. Go to [stripe.com](https://stripe.com) and create an account
2. Go to **Products** → Create 3 products:

**Starter — $5 one-time**
- Name: Job Hunter Starter Pack
- Price: $5.00 USD, one-time
- Copy the Price ID → `STRIPE_PRICE_STARTER`

**Pro — $15 one-time**
- Name: Job Hunter Pro Pack
- Price: $15.00 USD, one-time
- Copy the Price ID → `STRIPE_PRICE_PRO`

**Monthly — $19/month**
- Name: Job Hunter Monthly
- Price: $19.00 USD, recurring monthly
- Copy the Price ID → `STRIPE_PRICE_MONTHLY`

3. Copy your **Secret Key** → `STRIPE_SECRET_KEY`

**Set up the webhook:**
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://your-domain.com/webhooks/stripe`
3. Events: `checkout.session.completed`
4. Copy the **Signing Secret** → `STRIPE_WEBHOOK_SECRET`

---

## Step 4 — Deploy to Railway

1. In your Railway project, add a new service → **Deploy from GitHub repo**
2. Connect `owlguardco/job-hunter` (or your fork)
3. Leave **Root Directory** blank — deploy from repo root
4. Leave **Start Command** blank — `railway.toml` handles it automatically

**Add environment variables in Railway:**
```
ANTHROPIC_API_KEY=sk-ant-...
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_MONTHLY=price_...
DATABASE_URL=postgresql://... (Railway auto-injects this if in same project)
APP_URL=https://your-domain.railway.app
PORT=3001
```

5. Deploy. Railway will build and start the server.
6. Note your Railway URL (e.g. `job-hunter-production.railway.app`)

---

## Step 5 — Custom domain (optional)

1. In Railway → your service → Settings → Domains → Add custom domain
2. Add your domain (e.g. `jobhunter.ai`)
3. Update your DNS CNAME to point to the Railway URL
4. Update `APP_URL` env var to your custom domain
5. Update Stripe webhook URL and Clerk webhook URL to your custom domain

---

## Step 6 — Verify end-to-end

Test the full flow:

```bash
# 1. Health check
curl https://your-domain.com/api/health

# 2. Sign up at your domain
# 3. Buy the Starter pack ($5)
# 4. Check Stripe Dashboard — payment should appear
# 5. Check Railway logs — "Purchase fulfilled: starter for user user_xxx"
# 6. Check your database
psql $DATABASE_URL -c "SELECT * FROM credits LIMIT 5;"
# Should show 25 credits for your user

# 7. Run a tool — ATS scan
# 8. Check usage table
psql $DATABASE_URL -c "SELECT * FROM usage LIMIT 5;"
# Should show the run with credits_charged = 1
```

---

## Monitoring

**Railway** gives you:
- Request logs (all API calls)
- Error logs
- Memory and CPU usage

**Useful queries:**

```sql
-- Revenue today
SELECT SUM(amount_cents)/100.0 as revenue_usd
FROM purchases
WHERE created_at > NOW() - INTERVAL '24 hours'
AND status = 'complete';

-- Active users (ran at least one tool this week)
SELECT COUNT(DISTINCT user_id) as active_users
FROM usage
WHERE created_at > NOW() - INTERVAL '7 days';

-- Most popular tools
SELECT tool, COUNT(*) as runs
FROM usage
GROUP BY tool
ORDER BY runs DESC;

-- Users running out of credits (upsell opportunity)
SELECT u.email, c.balance
FROM credits c
JOIN users u ON c.user_id = u.id
WHERE c.balance <= 3
AND c.unlimited_until IS NULL
ORDER BY c.balance ASC;
```

---

## Pricing strategy notes

Current pricing: $0.25/run (packed as $5/25, $15/100, $19/month)
Your cost: ~$0.003/run (Anthropic API)
Margin: ~98%

**When to adjust:**
- If you're seeing high monthly subscriber churn, the $19/month may be overpriced for casual users
- If pro packs sell faster than starter, consider a $25/200 "heavy" pack
- Monitor your Anthropic costs — token usage varies by tool (mock interview uses more than ATS scan)

---

## What's NOT included (intentional)

- Email notifications — Clerk handles auth emails; transactional email (usage reports, etc.) would need Resend or similar
- Admin dashboard — use Railway logs + direct SQL for now; build if you hit 100+ users
- Refunds — handled manually via Stripe dashboard until volume justifies automation
- Rate limiting — add if you see abuse; not needed at launch scale
