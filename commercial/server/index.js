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

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PORT = process.env.PORT || 3001;
const ROOT = path.join(__dirname, '../..');  // job-hunter root
const COMMERCIAL_WEB = path.join(__dirname, '../web');

// ── DB client ─────────────────────────────────────────────
const db = new Client({ connectionString: process.env.DATABASE_URL });
db.connect().then(() => console.log('✓ Database connected'));

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

// ── Load agent prompt (from open source agents/) ──────────
function loadRules() {
  try { return fs.readFileSync(path.join(ROOT, 'rules/writing-rules.md'), 'utf8'); }
  catch { return ''; }
}

function loadAgent(name) {
  const p = path.join(ROOT, 'agents', `${name}.md`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function buildPrompt(toolType, inputs) {
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
    decode: 'apply-decode-jd',
    research: 'interview-research',
    compare: 'offer-compare',
    outreach: 'search-outreach',
    promote: 'career-promote',
    review: 'career-review',
    internal: 'career-internal',
    salary: 'search-salary',
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

  return `${HARD_RULES}\n\n---\n\n${taskLines.join('\n').trim()}\n\n---\n\n${inputBlock}`;
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

  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || '*');
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
      const payload = await body(req);
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

  // ── POST /api/run — run a tool ───────────────────────────
  if (url.pathname === '/api/run' && req.method === 'POST') {
    if (!userId) return json(res, 401, { error: 'Not authenticated' });

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

      const { type, inputs, interviewMode } = await body(req);
      const toolType = (type === 'interview' && interviewMode === 'mock') ? 'mock' : type;
      const prompt = buildPrompt(toolType, inputs);

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

      // Deduct credit + log usage
      await deductCredit(userId, toolType, inputTokens, outputTokens);

      // Return result with updated credit balance
      const updatedCredits = await getCredits(userId);

      return json(res, 200, {
        result,
        creditsRemaining: updatedCredits.balance,
        unlimited: updatedCredits.unlimited,
      });

    } catch (err) {
      console.error('Run error:', err);
      return json(res, 500, { error: err.message });
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
