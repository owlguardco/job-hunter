-- Job Hunter Commercial — Database Schema
-- Run via: psql $DATABASE_URL < commercial/db/schema.sql
-- Or: npm run db:migrate

-- ── Users ─────────────────────────────────────────────────
-- Synced from Clerk webhooks — Clerk is the source of truth for auth
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(255) PRIMARY KEY,  -- Clerk user ID (user_xxx)
  email         VARCHAR(255) UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Credits ───────────────────────────────────────────────
-- Each user has a credit balance. One credit = one tool run.
-- Monthly subscribers get unlimited_until set to future date.
CREATE TABLE IF NOT EXISTS credits (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  balance         INTEGER NOT NULL DEFAULT 0,
  unlimited_until TIMESTAMPTZ,  -- set for monthly subscribers
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── Purchases ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id                  SERIAL PRIMARY KEY,
  user_id             VARCHAR(255) REFERENCES users(id),
  stripe_session_id   VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id  VARCHAR(255),
  pack_type           VARCHAR(50) NOT NULL,  -- starter | pro | monthly
  credits_added       INTEGER,               -- null for monthly
  amount_cents        INTEGER NOT NULL,
  status              VARCHAR(50) DEFAULT 'pending',  -- pending | complete | refunded
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usage ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(255) REFERENCES users(id),
  tool            VARCHAR(100) NOT NULL,  -- resume, ats, interview, etc.
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  credits_charged INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage(created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
