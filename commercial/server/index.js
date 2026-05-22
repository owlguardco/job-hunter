/**
 * Job Hunter — Commercial Server
 *
 * Extends the open source server with:
 * - Clerk authentication
 * - Credit balance tracking
 * - Stripe pay-per-use billing
 * - Usage logging
 *
 * Open source server.js is unchanged.
 * This server imports from it and adds the commercial layer on top.
 */

// Load env — commercial/.env first, fall back to root .env
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const commercialEnv = path.join(__dirname, '../.env');
const rootEnv = path.join(__dirname, '../../.env');
dotenv.config({ path: fs.existsSync(commercialEnv) ? commercialEnv : rootEnv });

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const memory = require('./memory');
const { scanInbox, draftResponse } = require('./inbox');
const { Webhook } = require('svix');

const PORT = process.env.PORT || 3001;
const ROOT = path.join(__dirname, '../..');  // job-hunter root (commercial/server/ → root)
const COMMERCIAL_WEB = path.join(__dirname, '../web');

// ── DB client ─────────────────────────────────────────────
const db = new Client({ connectionString: process.env.DATABASE_URL });

// ── In-memory rate limiter (replace with Redis at scale) ─
const rateLimits = new Map();
function checkRateLimit(userId, endpoint, maxPerMinute = 20) {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const entry = rateLimits.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > 60000) { entry.count = 1; entry.windowStart = now; }
  else { entry.count++; }
  rateLimits.set(key, entry);
  return entry.count <= maxPerMinute;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimits.entries()) {
    if (now - v.windowStart > 120000) rateLimits.delete(k);
  }
}, 300000);
db.connect().then(() => {
  console.log('✓ Database connected');
  startCleanupScheduler();
});

// ── Scheduled cleanup ─────────────────────────────────────
function startCleanupScheduler() {
  // Run cleanup every hour
  setInterval(runCleanup, 60 * 60 * 1000);
  // Also run once on startup
  setTimeout(runCleanup, 30 * 1000);
}

async function runCleanup() {
  try {
    // Delete expired sessions (inactive > 24 hours)
    const sessions = await db.query(
      "DELETE FROM sessions WHERE last_active < NOW() - INTERVAL '24 hours' RETURNING id"
    );

    // Delete old audit log entries (keep 90 days)
    const audit = await db.query(
      "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days' RETURNING id"
    );

    // Delete dismissed/replied inbox alerts older than 30 days
    const alerts = await db.query(
      "DELETE FROM inbox_alerts WHERE status IN ('dismissed','replied') AND updated_at < NOW() - INTERVAL '30 days' RETURNING id"
    );

    if (sessions.rowCount > 0 || audit.rowCount > 0 || alerts.rowCount > 0) {
      console.log(`Cleanup: ${sessions.rowCount} sessions, ${audit.rowCount} audit entries, ${alerts.rowCount} alerts deleted`);
    }
  } catch (err) {
    console.error('Cleanup error (non-fatal):', err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────
function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.APP_URL || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

async function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve(data); }
    });
    req.on('error', reject);
  });
}

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Clerk auth verification ───────────────────────────────
async function verifyClerkToken(token) {
  if (!token) return null;
  try {
    const res = await fetch('https://api.clerk.dev/v1/tokens/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sub || null; // returns Clerk user ID
  } catch {
    return null;
  }
}

async function requireAuth(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.replace('Bearer ', '');
  return verifyClerkToken(token);
}

// ── Credit operations ─────────────────────────────────────
async function getCredits(userId) {
  const result = await db.query(
    'SELECT balance, unlimited_until FROM credits WHERE user_id = $1',
    [userId]
  );
  if (!result.rows.length) return { balance: 0, unlimited: false };
  const row = result.rows[0];
  const unlimited = row.unlimited_until && new Date(row.unlimited_until) > new Date();
  return { balance: row.balance, unlimited };
}

async function deductCredit(userId, tool, inputTokens, outputTokens) {
  await db.query('BEGIN');
  try {
    // Check balance
    const credits = await getCredits(userId);
    if (!credits.unlimited && credits.balance < 1) {
      await db.query('ROLLBACK');
      return false;
    }

    // Deduct if not unlimited
    if (!credits.unlimited) {
      await db.query(
        'UPDATE credits SET balance = balance - 1, updated_at = NOW() WHERE user_id = $1',
        [userId]
      );
    }

    // Log usage
    await db.query(
      `INSERT INTO usage (user_id, tool, input_tokens, output_tokens, credits_charged)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tool, inputTokens, outputTokens, credits.unlimited ? 0 : 1]
    );

    await db.query('COMMIT');
    return true;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

async function ensureUser(userId, email) {
  await db.query(
    `INSERT INTO users (id, email) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = $2, updated_at = NOW()`,
    [userId, email]
  );
  // Ensure credits row exists
  await db.query(
    `INSERT INTO credits (user_id, balance) VALUES ($1, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

// ── Audit logging ────────────────────────────────────────
async function auditLog(userId, action, metadata = {}, req = null) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null;
    await db.query(
      'INSERT INTO audit_log (user_id, action, metadata, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, action, JSON.stringify(metadata), ip]
    );
  } catch (err) {
    // Audit log failures are never fatal
    console.error('Audit log error (non-fatal):', err.message);
  }
}

// ── Session context (in-session output threading) ───────────
const { randomUUID } = require('crypto');

async function getOrCreateSession(userId, sessionId) {
  if (sessionId) {
    const res = await db.query(
      `UPDATE sessions SET last_active = NOW()
       WHERE id = $1 AND user_id = $2
       AND last_active > NOW() - INTERVAL '2 hours'
       RETURNING *`,
      [sessionId, userId]
    );
    if (res.rows.length) return res.rows[0];
  }
  // Create new session
  const id = randomUUID();
  const res = await db.query(
    `INSERT INTO sessions (id, user_id) VALUES ($1, $2) RETURNING *`,
    [id, userId]
  );
  return res.rows[0];
}

async function saveSessionOutput(sessionId, tool, output) {
  await db.query(
    `UPDATE sessions
     SET outputs = outputs || jsonb_build_object($2::text, $3::text),
         last_active = NOW()
     WHERE id = $1`,
    [sessionId, tool, output]
  );
}

async function getSessionOutputs(sessionId) {
  if (!sessionId) return {};
  const res = await db.query(
    'SELECT outputs FROM sessions WHERE id = $1',
    [sessionId]
  );
  return res.rows[0]?.outputs || {};
}

// ── Profile operations ────────────────────────────────────
async function getProfile(userId) {
  const res = await db.query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [userId]
  );
  return res.rows[0] || null;
}

async function saveProfile(userId, data) {
  await db.query(
    `INSERT INTO profiles (user_id, resume, linkedin, target_role, target_location, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       resume = COALESCE($2, profiles.resume),
       linkedin = COALESCE($3, profiles.linkedin),
       target_role = COALESCE($4, profiles.target_role),
       target_location = COALESCE($5, profiles.target_location),
       updated_at = NOW()`,
    [userId, data.resume || null, data.linkedin || null,
     data.targetRole || null, data.targetLocation || null]
  );
}

// ── Input sanitization ───────────────────────────────────
// Strips prompt injection attempts from user-submitted content
// Outputs are plain text so XSS is not a concern — this is for
// preventing users from hijacking the agent instructions
function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return '';

  // Remove common prompt injection patterns
  const injectionPatterns = [
    /ignore (all |previous |above |prior )?(instructions?|prompts?|rules?|context)/gi,
    /forget (everything|all|previous|what i said)/gi,
    /you are now|act as if|pretend (to be|you are|you're)/gi,
    /system prompt|<\/?system>|<\/?instructions>/gi,
    /jailbreak|DAN mode|developer mode/gi,
  ];

  let sanitized = text;
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[removed]');
  }

  // Cap input length — prevents token stuffing attacks
  // Resume: 8000 chars (~2000 tokens), JD: 5000 chars (~1250 tokens)
  return sanitized.slice(0, 10000);
}

function sanitizeInputs(inputs) {
  const sanitized = {};
  for (const [key, val] of Object.entries(inputs || {})) {
    sanitized[key] = typeof val === 'string' ? sanitizeInput(val) : val;
  }
  return sanitized;
}

// ── Load agent prompt (from open source agents/) ──────────
function loadRules() {
  try { return fs.readFileSync(path.join(ROOT, 'rules/writing-rules.md'), 'utf8'); }
  catch { return ''; }
}

function loadAgent(name) {
  const p = path.join(ROOT, 'agents', `${name}.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function buildPrompt(toolType, inputs, memoryContext = '') {
  const rules = loadRules();
  const HARD_RULES = `HARD RULES — APPLY TO ALL OUTPUT:
- No em dashes (—) anywhere
- Never open with "Hi" or "Hello"
- No filler phrases: "proven track record", "results-driven", "passionate about", "strong communication skills", "team player", "detail-oriented", "thought leader"
- Never start a bullet with "Responsible for" or "Helped"
- Every resume bullet: Action verb + what you did + measurable result
- Sound like a person, not a press release
- Specific beats vague — use numbers wherever they exist

${rules}`;

  const agentMap = {
    linkedin: 'apply-linkedin-audit',
    resume: 'apply-resume',
    cover: 'apply-cover-letter',
    ats: 'apply-ats-scan',
    interview: 'interview-prep',
    mock: 'interview-mock',
    thankyou: 'offer-thankyou',
    negotiate: 'offer-negotiate',
    counter:         'offer-counteroffer',
    deadline:        'offer-deadline-manager',
    decode: 'apply-decode-jd',
    research: 'interview-research',
    compare: 'offer-compare',
    outreach: 'search-outreach',
    promote: 'career-promote',
    review: 'career-review',
    internal: 'career-internal',
    network:         'career-network-message',
    'linkedin-post': 'career-linkedin-content',
    salary:   'search-salary',
    company:  'search-company-research',
    referrals:       'search-referral-finder',
    company:         'search-company-research',
    'follow-up':     'search-follow-up',
    followup:        'search-follow-up',
    tracker:         'search-tracker-update',
    'follow-up':'search-follow-up',
    'bias-audit':    'apply-bias-audit',
    bias:            'apply-bias-audit',
    portfolio:       'apply-portfolio-brief',
    references:      'apply-reference-prep',
    rejection:       'apply-rejection-analysis',
    reality:         'apply-reality-check',
    portfolio:'apply-portfolio-brief',
    fit: 'apply-fit-score',
  };

  const agentName = agentMap[toolType];
  if (!agentName) return null;

  const agentContent = loadAgent(agentName);
  if (!agentContent) return null;

  // Strip file-reading/saving steps, keep task logic
  const lines = agentContent.split('\n');
  const taskLines = [];
  let inSetup = false, inSave = false, started = false;
  for (const line of lines) {
    if (line.match(/^### Step 1.*Load inputs/i)) { inSetup = true; started = true; continue; }
    if (line.match(/^### Step \d.*Save output/i)) { inSave = true; continue; }
    if (inSave && line.match(/^### Step \d/)) inSave = false;
    if (inSetup && line.match(/^### Step \d/)) inSetup = false;
    if (inSetup || inSave) continue;
    if (!started && line.startsWith('#')) started = true;
    if (started) taskLines.push(line);
  }

  let inputBlock = '';
  if (toolType === 'linkedin') {
    inputBlock = `LINKEDIN PROFILE:\n${inputs.profile || ''}\n\nTARGET JOB DESCRIPTION:\n${inputs.jd || ''}`;
  } else if (toolType === 'research') {
    inputBlock = `JOB DESCRIPTION:\n${inputs.jd || ''}\n\nINTERVIEWER:\n${inputs.interviewer || 'Not provided'}\n\nINTERVIEW TYPE:\n${inputs.interviewType || 'Not specified'}`;
  } else if (toolType === 'compare') {
    inputBlock = `OFFER A:\n${inputs.offerA || ''}\n\nOFFER B:\n${inputs.offerB || ''}`;
  } else if (toolType === 'thankyou') {
    inputBlock = `MY RESUME:\n${inputs.resume || ''}\n\nJOB DESCRIPTION:\n${inputs.jd || ''}\n\nINTERVIEW CONTEXT:\n${inputs.context || ''}`;
  } else if (['promote', 'review', 'negotiate'].includes(toolType)) {
    inputBlock = `MY BACKGROUND:\n${inputs.resume || ''}\n\nCONTEXT:\n${inputs.context || ''}`;
  } else if (toolType === 'outreach') {
    inputBlock = `MY RESUME:\n${inputs.resume || ''}\n\nTARGET:\n${inputs.target || ''}`;
  } else {
    inputBlock = `MY RESUME:\n${inputs.resume || ''}\n\nJOB DESCRIPTION:\n${inputs.jd || ''}`;
  }

  const memSection = memoryContext
    ? `\n\nUSER CONTEXT FROM PREVIOUS SESSIONS (use this to personalize output — do not repeat it back verbatim):\n${memoryContext}\n`
    : '';

  return `${HARD_RULES}${memSection}\n\n---\n\n${taskLines.join('\n').trim()}\n\n---\n\n${inputBlock}`;
}

// ── Stripe helpers ────────────────────────────────────────
async function createCheckoutSession(userId, email, packType) {
  const prices = {
    starter: { price: process.env.STRIPE_PRICE_STARTER, credits: 25, amount: 500 },
    pro:     { price: process.env.STRIPE_PRICE_PRO,     credits: 100, amount: 1500 },
    monthly: { price: process.env.STRIPE_PRICE_MONTHLY, credits: null, amount: 1900 },
  };

  const pack = prices[packType];
  if (!pack) throw new Error('Invalid pack type');

  const body = JSON.stringify({
    mode: packType === 'monthly' ? 'subscription' : 'payment',
    customer_email: email,
    line_items: [{ price: pack.price, quantity: 1 }],
    success_url: `${process.env.APP_URL}/dashboard?purchase=success&pack=${packType}`,
    cancel_url: `${process.env.APP_URL}/dashboard?purchase=cancelled`,
    metadata: { userId, packType, credits: pack.credits?.toString() || 'unlimited' },
  });

  const res = await stripeRequest('POST', '/v1/checkout/sessions', body);
  return res;
}

function stripeRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.stripe.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    // Convert JSON body to form-encoded for Stripe
    let formBody = '';
    if (body) {
      const parsed = JSON.parse(body);
      formBody = Object.entries(parsed)
        .flatMap(([k, v]) => {
          if (typeof v === 'object' && v !== null) {
            return Object.entries(v).map(([k2, v2]) => `${k}[${k2}]=${encodeURIComponent(v2)}`);
          }
          return [`${k}=${encodeURIComponent(v)}`];
        })
        .join('&');
      options.headers['Content-Length'] = Buffer.byteLength(formBody);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid Stripe response')); }
      });
    });
    req.on('error', reject);
    if (formBody) req.write(formBody);
    req.end();
  });
}

function verifyStripeWebhook(payload, signature, secret) {
  // Simple HMAC verification
  const crypto = require('crypto');
  const parts = signature.split(',');
  const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
  const v1 = parts.find(p => p.startsWith('v1=')).split('=')[1];

  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return expected === v1;
}

// ── MIME types ────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ── Request handler ───────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  const corsOrigin = process.env.NODE_ENV === 'production'
    ? (process.env.APP_URL || 'https://jobhunter.ai')
    : '*';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Health ──────────────────────────────────────────────
  if (url.pathname === '/api/health') {
    const agents = fs.readdirSync(path.join(ROOT, 'agents')).filter(f => f.endsWith('.md'));
    return json(res, 200, { status: 'ok', agents: agents.length, mode: 'commercial' });
  }

  // ── Clerk webhook — sync users ──────────────────────────
  if (url.pathname === '/webhooks/clerk' && req.method === 'POST') {
    try {
      // Full Svix signature verification
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('CLERK_WEBHOOK_SECRET not set — rejecting webhook');
        return json(res, 500, { error: 'Webhook secret not configured' });
      }

      const rawPayload = await rawBody(req);
      const svixHeaders = {
        'svix-id': req.headers['svix-id'],
        'svix-timestamp': req.headers['svix-timestamp'],
        'svix-signature': req.headers['svix-signature'],
      };

      if (!svixHeaders['svix-id'] || !svixHeaders['svix-timestamp'] || !svixHeaders['svix-signature']) {
        return json(res, 400, { error: 'Missing Svix headers' });
      }

      let payload;
      try {
        const wh = new Webhook(webhookSecret);
        payload = wh.verify(rawPayload.toString(), svixHeaders);
      } catch (err) {
        console.error('Clerk webhook verification failed:', err.message);
        return json(res, 400, { error: 'Invalid webhook signature' });
      }

      if (payload.type === 'user.created' || payload.type === 'user.updated') {
        const u = payload.data;
        const email = u.email_addresses?.[0]?.email_address || '';
        await ensureUser(u.id, email);
        console.log(`User synced: ${u.id}`);
      }
      return json(res, 200, { received: true });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  // ── Stripe webhook — fulfill purchases ──────────────────
  if (url.pathname === '/webhooks/stripe' && req.method === 'POST') {
    try {
      const rawPayload = await rawBody(req);
      const sig = req.headers['stripe-signature'];

      if (!verifyStripeWebhook(rawPayload.toString(), sig, process.env.STRIPE_WEBHOOK_SECRET)) {
        return json(res, 400, { error: 'Invalid signature' });
      }

      const event = JSON.parse(rawPayload.toString());

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, packType, credits } = session.metadata;

        // Record purchase
        await db.query(
          `INSERT INTO purchases (user_id, stripe_session_id, stripe_customer_id, pack_type, credits_added, amount_cents, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'complete')
           ON CONFLICT (stripe_session_id) DO NOTHING`,
          [userId, session.id, session.customer, packType,
           credits === 'unlimited' ? null : parseInt(credits),
           session.amount_total]
        );

        if (packType === 'monthly') {
          // Set unlimited until end of subscription period (30 days)
          const until = new Date();
          until.setDate(until.getDate() + 30);
          await db.query(
            `INSERT INTO credits (user_id, balance, unlimited_until)
             VALUES ($1, 0, $2)
             ON CONFLICT (user_id) DO UPDATE SET unlimited_until = $2, updated_at = NOW()`,
            [userId, until]
          );
        } else {
          // Add credits
          const creditsToAdd = parseInt(credits);
          await db.query(
            `INSERT INTO credits (user_id, balance)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET balance = credits.balance + $2, updated_at = NOW()`,
            [userId, creditsToAdd]
          );
        }

        console.log(`Purchase fulfilled: ${packType} for user ${userId}`);
        await auditLog(userId, 'purchase.completed', { packType, sessionId: session.id, amount: session.amount_total });
      }

      return json(res, 200, { received: true });
    } catch (err) {
      console.error('Stripe webhook error:', err);
      return json(res, 400, { error: err.message });
    }
  }

  // ── Auth required from here ─────────────────────────────
  const userId = await requireAuth(req);

  // ── GET /api/me — user info + credits ───────────────────
  if (url.pathname === '/api/me' && req.method === 'GET') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const credits = await getCredits(userId);
      const usage = await db.query(
        'SELECT COUNT(*) as total, MAX(created_at) as last_used FROM usage WHERE user_id = $1',
        [userId]
      );
      return json(res, 200, {
        userId,
        credits: credits.balance,
        unlimited: credits.unlimited,
        totalRuns: parseInt(usage.rows[0].total),
        lastUsed: usage.rows[0].last_used,
      });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── GET /api/usage — usage history ──────────────────────
  if (url.pathname === '/api/usage' && req.method === 'GET') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const result = await db.query(
        `SELECT tool, created_at, credits_charged
         FROM usage WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );
      return json(res, 200, { usage: result.rows });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/checkout — create Stripe session ──────────
  if (url.pathname === '/api/checkout' && req.method === 'POST') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const { packType, email } = await body(req);
      const session = await createCheckoutSession(userId, email, packType);
      return json(res, 200, { url: session.url });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── GET /api/profile — get saved profile ────────────────
  if (url.pathname === '/api/profile' && req.method === 'GET') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const profile = await getProfile(userId);
      return json(res, 200, { profile });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/profile — save profile ─────────────────────
  if (url.pathname === '/api/profile' && req.method === 'POST') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const data = await body(req);
      await saveProfile(userId, data);
      return json(res, 200, { saved: true });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── GET /api/memories — user's memory profile ──────────
  if (url.pathname === '/api/memories' && req.method === 'GET') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const memories = await memory.getAllMemories(userId);
      return json(res, 200, { memories });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── DELETE /api/memories — clear user memories ───────────
  if (url.pathname === '/api/memories' && req.method === 'DELETE') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      await memory.deleteAllMemories(userId);
      await auditLog(userId, 'memory.cleared', {}, req);
      return json(res, 200, { deleted: true });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── GET /api/inbox — get inbox alerts ───────────────────
  if (url.pathname === '/api/inbox' && req.method === 'GET') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const alerts = await db.query(
        `SELECT * FROM inbox_alerts
         WHERE user_id = $1 AND status IN ('pending', 'snoozed')
         ORDER BY
           CASE urgency WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
           received_at DESC
         LIMIT 50`,
        [userId]
      );
      const companies = await db.query(
        'SELECT * FROM tracked_companies WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return json(res, 200, { alerts: alerts.rows, companies: companies.rows });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/inbox/scan — trigger a Gmail scan ───────────
  if (url.pathname === '/api/inbox/scan' && req.method === 'POST') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const profile = await getProfile(userId);
      const userResume = profile?.resume || '';

      // Gmail search via Anthropic API with Gmail MCP
      // We use the API to run searches since Gmail MCP requires a live session
      // For the commercial server, we use a server-side Anthropic call with Gmail MCP
      const gmailSearchFn = async (query) => {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 2000,
              mcp_servers: [{ type: 'url', url: 'https://gmailmcp.googleapis.com/mcp/v1', name: 'gmail' }],
              messages: [{
                role: 'user',
                content: `Search Gmail with this exact query and return the results as JSON array with fields: id, threadId, subject, from, snippet, internalDate. Query: ${query}. Return ONLY valid JSON array, no other text.`
              }],
            }),
          });
          const data = await res.json();
          const text = data.content?.[0]?.text || '[]';
          try { return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]'); }
          catch { return []; }
        } catch { return []; }
      };

      const result = await scanInbox({
        userId, db,
        apiKey: process.env.ANTHROPIC_API_KEY,
        userResume,
        gmailSearchFn,
      });

      return json(res, 200, result);
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/inbox/companies — add tracked company ──────
  if (url.pathname === '/api/inbox/companies' && req.method === 'POST') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const { name, domain, role } = await body(req);
      if (!name) return json(res, 400, { error: 'Company name required' });

      // Auto-derive domain if not provided
      const derivedDomain = domain || name.toLowerCase()
        .replace(/[^a-z0-9]/g, '') + '.com';

      await db.query(
        `INSERT INTO tracked_companies (user_id, name, domain, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, name) DO UPDATE SET domain=$3, role=$4`,
        [userId, name, derivedDomain, role || null]
      );
      return json(res, 200, { added: true, name, domain: derivedDomain });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── PATCH /api/inbox/:id — update alert status ───────────
  if (url.pathname.match(/^\/api\/inbox\/\d+$/) && req.method === 'PATCH') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const alertId = url.pathname.split('/').pop();
      const { status } = await body(req);
      await db.query(
        `UPDATE inbox_alerts SET status=$1, replied_at=CASE WHEN $1='replied' THEN NOW() ELSE replied_at END, updated_at=NOW()
         WHERE id=$2 AND user_id=$3`,
        [status, alertId, userId]
      );
      return json(res, 200, { updated: true });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/inbox/reply — send reply via Gmail ──────────
  if (url.pathname === '/api/inbox/reply' && req.method === 'POST') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });
    try {
      const { alertId, draft, threadId } = await body(req);
      if (!draft) return json(res, 400, { error: 'Draft required' });

      // Use Anthropic API with Gmail MCP to send
      const sendRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          mcp_servers: [{ type: 'url', url: 'https://gmailmcp.googleapis.com/mcp/v1', name: 'gmail' }],
          messages: [{
            role: 'user',
            content: `Create a draft reply to Gmail thread ${threadId} with this exact body: "${draft}". Then send it. Confirm with "SENT" when done.`
          }],
        }),
      });

      const sendData = await sendRes.json();
      const confirmed = sendData.content?.[0]?.text?.includes('SENT');

      if (confirmed) {
        await db.query(
          `UPDATE inbox_alerts SET status='replied', replied_at=NOW(), updated_at=NOW()
           WHERE id=$1 AND user_id=$2`,
          [alertId, userId]
        );
      }

      return json(res, 200, { sent: confirmed, message: confirmed ? 'Email sent' : 'Check Gmail — may need manual send' });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // ── POST /api/run — run a tool ───────────────────────────
  if (url.pathname === '/api/run' && req.method === 'POST') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });

    // Rate limit: 20 tool runs per minute per user
    if (!checkRateLimit(userId, 'run', 20)) {
      return json(res, 429, {
        error: 'Too many requests — please wait a moment before running another tool.',
        code: 'RATE_LIMITED'
      });
    }

    try {
      // Check credits first
      const credits = await getCredits(userId);
      if (!credits.unlimited && credits.balance < 1) {
        return json(res, 402, {
          error: 'No credits remaining',
          code: 'INSUFFICIENT_CREDITS',
          message: 'Purchase more credits to continue.',
        });
      }

      const { type, inputs, interviewMode, sessionId } = await body(req);
      const toolType = (type === 'interview' && interviewMode === 'mock') ? 'mock' : type;

      // Load session context + profile
      const [session, profile, sessionOutputs] = await Promise.all([
        getOrCreateSession(userId, sessionId),
        getProfile(userId),
        getSessionOutputs(sessionId),
      ]);

      // Sanitize inputs before processing
      const sanitizedInputs = sanitizeInputs(inputs);
      const enrichedInputs = { ...sanitizedInputs };
      // Enrich inputs with session context + saved profile
      // Profile fills in missing resume/linkedin if user has saved one
      const enrichedInputs = { ...inputs };
      if (!enrichedInputs.resume && profile?.resume) enrichedInputs.resume = profile.resume;
      if (!enrichedInputs.profile && profile?.linkedin) enrichedInputs.profile = profile.linkedin;

      // In-session threading: if cover letter is run after resume tailor,
      // auto-inject the tailored resume output
      if (toolType === 'cover' && !enrichedInputs.resume && sessionOutputs.resume) {
        enrichedInputs.resume = sessionOutputs.resume;
      }
      if (toolType === 'interview' && !enrichedInputs.resume && sessionOutputs.resume) {
        enrichedInputs.resume = sessionOutputs.resume;
      }
      if (toolType === 'mock' && !enrichedInputs.resume && sessionOutputs.resume) {
        enrichedInputs.resume = sessionOutputs.resume;
      }
      if (toolType === 'research' && !enrichedInputs.jd && sessionOutputs.ats) {
        // JD was already used in ATS scan — carry it forward
        enrichedInputs.jd = inputs.jd || enrichedInputs.jd;
      }

      // Fetch relevant memories for this user + tool combo
      const memoryContext = await memory.getMemoryContext(userId, toolType, enrichedInputs);

      const prompt = buildPrompt(toolType, enrichedInputs, memoryContext);

      if (!prompt) {
        return json(res, 400, { error: `Unknown tool: ${type}` });
      }

      // Call Anthropic
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await anthropicRes.json();

      if (!anthropicRes.ok) {
        return json(res, anthropicRes.status, { error: data.error?.message || 'API error' });
      }

      const result = data.content?.[0]?.text || '';
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;

      // Deduct credit + log usage + save to session + save to memory + audit
      await Promise.all([
        deductCredit(userId, toolType, inputTokens, outputTokens),
        saveSessionOutput(session.id, toolType, result),
        memory.addMemory(userId, toolType, enrichedInputs, result),
        auditLog(userId, 'tool.run', { tool: toolType, inputTokens, outputTokens }, req),
      ]);

      // Return result with updated credit balance + session ID
      const updatedCredits = await getCredits(userId);

      return json(res, 200, {
        result,
        sessionId: session.id,
        creditsRemaining: updatedCredits.balance,
        unlimited: updatedCredits.unlimited,
      });

    } catch (err) {
      console.error('Run error:', err);
      return json(res, 500, { error: err.message });
    }
  }

  // ── Legal routes ────────────────────────────────────────
  const legalRoutes = {
    '/legal/privacy': 'docs/legal/privacy-policy.md',
    '/legal/terms':   'docs/legal/terms-of-service.md',
    '/legal/refunds': 'docs/legal/refund-policy.md',
  };

  if (legalRoutes[url.pathname]) {
    const mdPath = path.join(ROOT, legalRoutes[url.pathname]);
    if (fs.existsSync(mdPath)) {
      const md = fs.readFileSync(mdPath, 'utf8');
      // Serve as simple HTML page
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Hunter — Legal</title>
        <style>
          body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:2rem 1.5rem;
               background:#0e0c0a;color:#f0ece6;line-height:1.7}
          h1,h2,h3{color:#e8722a;margin-top:2rem} a{color:#e8722a}
          table{width:100%;border-collapse:collapse;font-size:14px}
          th,td{padding:8px 12px;border:1px solid #2a2520;text-align:left}
          code{background:#1e1b18;padding:2px 6px;border-radius:4px;font-size:13px}
          .back{display:inline-block;margin-bottom:2rem;color:#6b6058;text-decoration:none;font-size:13px}
          .back:hover{color:#e8722a}
        </style></head><body>
        <a href="/" class="back">← Back to Job Hunter</a>
        <div>${md.replace(/
/g,'<br>').replace(/#{3} (.+)/g,'<h3>$1</h3>').replace(/## (.+)/g,'<h2>$1</h2>').replace(/# (.+)/g,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2">$1</a>')}</div>
        </body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
  }

  // ── Serve commercial web UI ──────────────────────────────
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullPath = path.join(COMMERCIAL_WEB, filePath);

  // Fall back to open source web assets (logo, etc.)
  const osFallback = path.join(ROOT, 'web', filePath);

  const serveFrom = fs.existsSync(fullPath) ? fullPath
    : fs.existsSync(osFallback) ? osFallback
    : null;

  if (serveFrom) {
    const ext = path.extname(serveFrom);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(fs.readFileSync(serveFrom));
    return;
  }

  // SPA fallback — serve index.html for client-side routing
  const indexPath = path.join(COMMERCIAL_WEB, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(indexPath));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║     Job Hunter — Commercial Server           ║
╠══════════════════════════════════════════════╣
║  URL:       http://localhost:${PORT}             ║
║  Mode:      Pay-per-use (Stripe + Clerk)     ║
║  Agents:    ${fs.readdirSync(path.join(ROOT,'agents')).filter(f=>f.endsWith('.md')).length} loaded from agents/                ║
╚══════════════════════════════════════════════╝
`);
});
