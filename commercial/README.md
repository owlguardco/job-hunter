# Job Hunter — Commercial (Hosted) Version

This directory contains everything needed to run Job Hunter as a hosted,
pay-per-use service. The open source version in the root directory is unchanged.

## Architecture

```
Open source (root/)          Commercial (commercial/)
─────────────────────        ─────────────────────────
agents/*.md          →       Same agents, loaded by commercial server
rules/               →       Same rules engine
web/index.html       →       Replaced by commercial/web/ (auth + billing UI)
server.js            →       Extended by commercial/server/index.js
```

## Stack

| Layer | Tool | Why |
|---|---|---|
| Auth | Clerk | Drop-in, handles email + Google OAuth |
| Payments | Stripe | Pay-per-use metered billing |
| Database | PostgreSQL (Railway) | Usage tracking, user accounts |
| Server | Node.js (extends server.js) | Same stack as open source |
| Hosting | Railway | Already your infra |

## Pricing model

- **$0.25 per run** — each tool use costs one credit
- **Starter pack** — $5 for 25 runs (~$0.20/run)
- **Pro pack** — $15 for 100 runs (~$0.15/run)
- **Monthly** — $19/month unlimited (for heavy users)

Your cost per run: ~$0.003 (Anthropic API)
Your margin: ~98%

## Environment variables needed

```bash
# Anthropic (your key — users don't need their own)
ANTHROPIC_API_KEY=sk-ant-...

# Clerk (auth)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# Stripe (billing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...   # $5 for 25 runs
STRIPE_PRICE_PRO=price_...       # $15 for 100 runs
STRIPE_PRICE_MONTHLY=price_...   # $19/month unlimited

# Database
DATABASE_URL=postgresql://...

# App
PORT=3001
APP_URL=https://jobhunter.ai
```

## Single-repo deployment

Both the open source server and commercial server run from the same GitHub repo.
Railway, Render, Fly.io — one deployment, one config, controlled by an env var.

**Open source server** (users bring their own API key):
```bash
npm start                          # local
# Railway: START_COMMERCIAL not set
```

**Commercial server** (your key, Stripe + Clerk):
```bash
npm run commercial                 # local
# Railway: START_COMMERCIAL=true
```

Same `agents/`, `rules/`, and `web/` files power both.

### Railway setup (one service, one repo)

1. Connect `owlguardco/job-hunter` to a Railway service
2. Leave **Start Command** blank — `railway.toml` handles it
3. Add env vars:
   - `START_COMMERCIAL=true` ← this switches to the commercial server
   - All vars from `.env.example` below
4. Deploy

To run the open source version on Railway instead:
- Remove `START_COMMERCIAL` or set it to `false`

## Setup

See [../docs/commercial-setup.md](../docs/commercial-setup.md) for the full deployment guide.

Quick start:
```bash
cd commercial
npm install
npm run db:migrate
npm start
```
