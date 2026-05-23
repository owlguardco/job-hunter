# Deployment Guide

Railway (backend) + Vercel (frontend) from one GitHub repo.
Estimated time: 45-60 minutes.

---

## Overview

```
GitHub repo (commercial branch)
  ├── Railway service → Node.js backend (API + Postgres)
  └── Vercel project → Static frontend (index.html + admin.html)
```

Users hit `jobhunter.ai` → Vercel (fast static) → API calls to Railway backend.

---

## Step 1 — Railway (backend)

### 1a. Create the service

1. Go to [railway.app](https://railway.app) → New Project
2. **Deploy from GitHub repo** → connect `owlguardco/job-hunter`
3. Select branch: **commercial**
4. Root directory: leave blank
5. Railway reads `railway.toml` automatically — start command is `node start.js`

### 1b. Add Postgres

In your Railway project → **New** → **Database** → **PostgreSQL**
Railway auto-injects `DATABASE_URL` into your service.

### 1c. Set environment variables

In Railway → your service → **Variables** tab, add every variable from
`commercial/.env.example`. The critical ones:

```
START_COMMERCIAL=true
ANTHROPIC_API_KEY=sk-ant-...
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_MONTHLY=price_...
MEM0_API_KEY=m0-...
NODE_ENV=production
APP_URL=https://jobhunter.ai
ADMIN_USER_ID=user_xxx  ← your Clerk user ID
```

### 1d. Run the database migration

In Railway → your service → **Deploy** tab → **New Deployment** first.
Then in **Shell** (or connect via `railway run`):

```bash
npm run db:migrate
```

### 1e. Note your Railway URL

It will be something like: `job-hunter-production.railway.app`
You'll need this for Vercel.

---

## Step 2 — Vercel (frontend)

### 2a. Create the project

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import from GitHub → `owlguardco/job-hunter`
3. Select branch: **commercial**
4. Framework preset: **Other**
5. Root directory: leave blank
6. Build command: leave blank (static files)
7. Output directory: `commercial/web`

Vercel reads `vercel.json` automatically.

### 2b. Set environment variables

```
API_URL=https://job-hunter-production.railway.app
```

### 2c. Add your domain

1. Vercel → your project → **Domains** → Add `jobhunter.ai`
2. Update your DNS CNAME to Vercel's provided value
3. Update `APP_URL` in Railway to `https://jobhunter.ai`

### 2d. Add Clerk publishable key to HTML

In `commercial/web/index.html` and `commercial/web/admin.html`, add inside `<head>`:

```html
<meta name="clerk-key" content="pk_live_YOUR_KEY_HERE" />
```

Commit and push to commercial branch — Vercel auto-deploys.

---

## Step 3 — Clerk setup

### 3a. Create application

1. [clerk.com](https://clerk.com) → Create Application → "Job Hunter"
2. Enable: **Email** + **Google** sign-in
3. Copy API keys to Railway env vars

### 3b. Add webhook

1. Clerk → Webhooks → Add endpoint
2. URL: `https://job-hunter-production.railway.app/webhooks/clerk`
3. Events: `user.created`, `user.updated`
4. Copy signing secret → `CLERK_WEBHOOK_SECRET` in Railway

### 3c. Grant yourself admin access

After signing up on your site, get your user ID:
1. Clerk Dashboard → Users → find yourself → copy the `user_xxx` ID
2. Set it in Railway: `ADMIN_USER_ID=user_xxx`
3. OR: In Clerk Dashboard → Users → your user → **Edit public metadata**:
```json
{ "role": "admin" }
```

The admin dashboard at `/admin` will then unlock for your account.

### 3d. Enable WebAuthn (Touch ID)

1. Clerk Dashboard → User & Authentication → Multi-factor
2. Enable **Passkeys** (WebAuthn)
3. On your next login, Clerk will prompt you to register Touch ID

---

## Step 4 — Stripe setup

### 4a. Create products

In Stripe → Products → Create:

**Starter Pack** — $5 one-time
- Name: Job Hunter Starter Pack
- Price: $5.00, one-time
- Copy Price ID → `STRIPE_PRICE_STARTER`

**Pro Pack** — $15 one-time
- Name: Job Hunter Pro Pack
- Price: $15.00, one-time
- Copy Price ID → `STRIPE_PRICE_PRO`

**Monthly** — $19/month
- Name: Job Hunter Monthly
- Price: $19.00, recurring
- Copy Price ID → `STRIPE_PRICE_MONTHLY`

### 4b. Add webhook

1. Stripe → Developers → Webhooks → Add endpoint
2. URL: `https://job-hunter-production.railway.app/webhooks/stripe`
3. Events: `checkout.session.completed`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

---

## Step 5 — LinkedIn (for admin posting)

To enable posting from the admin dashboard:

1. Go to [linkedin.com/developers](https://linkedin.com/developers)
2. Create an app → "Job Hunter"
3. Products → Request access to **Share on LinkedIn** (w/ OpenID Connect)
4. Auth → OAuth 2.0 settings → Add redirect URL for your domain
5. Generate an access token with scopes: `w_member_social`, `openid`, `profile`
6. Find your LinkedIn URN:
   ```
   curl -H "Authorization: Bearer YOUR_TOKEN" https://api.linkedin.com/v2/userinfo
   ```
   The `sub` field is your ID. Your URN is `urn:li:person:YOUR_ID`
7. Add to Railway:
   ```
   LINKEDIN_ACCESS_TOKEN=your_token
   LINKEDIN_AUTHOR_URN=urn:li:person:YOUR_ID
   ```

Note: LinkedIn access tokens expire. Set a reminder to refresh every 60 days.

---

## Step 6 — Verify end-to-end

```bash
# 1. Health check
curl https://job-hunter-production.railway.app/api/health

# 2. Sign up at jobhunter.ai
# 3. Buy the Starter pack — confirm in Stripe dashboard
# 4. Run a tool — confirm usage logged in Railway logs
# 5. Go to jobhunter.ai/admin — confirm admin dashboard loads
# 6. Generate a LinkedIn post draft

# 7. Webhook test (Stripe CLI)
stripe listen --forward-to https://job-hunter-production.railway.app/webhooks/stripe
```

---

## Maintenance

**LinkedIn token refresh (every 60 days):**
Generate a new token in LinkedIn Developer portal → update `LINKEDIN_ACCESS_TOKEN` in Railway

**Database backup:**
Railway → your Postgres service → Backups → Configure automated backups

**Monitor:**
- Railway logs for API errors
- Stripe dashboard for payment failures
- Clerk dashboard for auth issues
