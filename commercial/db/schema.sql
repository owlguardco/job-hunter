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

-- ── Profiles ──────────────────────────────────────────────
-- Persistent user profile — resume + target role saved once,
-- auto-injected into tool runs so users don't paste every time
CREATE TABLE IF NOT EXISTS profiles (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  resume          TEXT,           -- their base resume
  linkedin        TEXT,           -- their LinkedIn profile text
  target_role     TEXT,           -- what they're targeting
  target_location TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sessions ──────────────────────────────────────────────
-- In-session context threading — outputs from one tool
-- are automatically available as inputs to the next tool
-- within the same session (expires after 2 hours of inactivity)
CREATE TABLE IF NOT EXISTS sessions (
  id              VARCHAR(255) PRIMARY KEY,  -- UUID
  user_id         VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  outputs         JSONB DEFAULT '{}',        -- tool -> output text
  last_active     TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- ── Inbox Alerts ──────────────────────────────────────────
-- Stores flagged recruiter emails surfaced by the inbox scanner
CREATE TABLE IF NOT EXISTS inbox_alerts (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  gmail_thread_id VARCHAR(255),
  gmail_message_id VARCHAR(255) UNIQUE,
  from_email      VARCHAR(255),
  from_name       VARCHAR(255),
  company         VARCHAR(255),
  subject         TEXT,
  received_at     TIMESTAMPTZ,
  snippet         TEXT,
  classification  VARCHAR(50),   -- RECRUITER_OUTREACH | INTERVIEW_INVITE | OFFER | STATUS | REJECTION | AUTO_CONFIRM
  urgency         VARCHAR(10),   -- HIGH | MEDIUM | LOW
  drafted_reply   TEXT,          -- AI-drafted response
  status          VARCHAR(20) DEFAULT 'pending',  -- pending | replied | dismissed | snoozed
  replied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tracked Companies ─────────────────────────────────────
-- Companies the user is tracking for inbox monitoring
CREATE TABLE IF NOT EXISTS tracked_companies (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  domain      VARCHAR(255),
  role        VARCHAR(255),
  applied_at  TIMESTAMPTZ,
  stage       VARCHAR(50) DEFAULT 'applied',  -- applied | screening | interviewing | offer | closed
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inbox_alerts_user_id ON inbox_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_alerts_status ON inbox_alerts(status);
CREATE INDEX IF NOT EXISTS idx_inbox_alerts_urgency ON inbox_alerts(urgency);
CREATE INDEX IF NOT EXISTS idx_tracked_companies_user_id ON tracked_companies(user_id);
