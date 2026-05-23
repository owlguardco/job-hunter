/**
 * Job Hunter — Admin Routes
 *
 * Protected by Clerk role check. Only users with metadata.role === 'admin'
 * can access these endpoints. Checked server-side on every request.
 *
 * Routes:
 *   GET  /api/admin/stats          — revenue, users, usage overview
 *   GET  /api/admin/users          — user list with credits and usage
 *   GET  /api/admin/revenue        — purchase history
 *   POST /api/admin/linkedin/post  — post to LinkedIn as admin
 *   GET  /api/admin/linkedin/drafts — get saved LinkedIn drafts
 *   POST /api/admin/linkedin/draft  — save a LinkedIn draft
 *   POST /api/admin/user/credit    — manually add credits to a user
 */

const path = require('path');
const fs = require('fs');
const https = require('https');

// ── Admin auth check ──────────────────────────────────────
async function requireAdmin(userId, clerkSecretKey) {
  if (!userId) return false;
  try {
    const res = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${clerkSecretKey}` }
    });
    if (!res.ok) return false;
    const user = await res.json();
    return user.public_metadata?.role === 'admin';
  } catch {
    return false;
  }
}

// ── LinkedIn posting via OAuth ────────────────────────────
// Uses LinkedIn's UGC (User Generated Content) API
async function postToLinkedIn({ accessToken, authorUrn, text, link }) {
  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: link ? 'ARTICLE' : 'NONE',
        media: link ? [{
          status: 'READY',
          originalUrl: link,
          title: { text: 'Job Hunter — Free & Open Source Job Search Toolkit' },
          description: { text: 'Beat the barriers recruiters put up. 44 tools covering every stage of the job search.' }
        }] : undefined
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };

  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: 'api.linkedin.com',
      path: '/v2/ugcPosts',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'X-Restli-Protocol-Version': '2.0.0',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve({ success: true, postId: res.headers['x-restli-id'] });
        } else {
          resolve({ success: false, error: data, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── Admin route handler ───────────────────────────────────
async function handleAdminRoute(url, req, db, userId, body, json) {
  const CLERK_SECRET = process.env.CLERK_SECRET_KEY;

  // Check admin on every request
  const isAdmin = await requireAdmin(userId, CLERK_SECRET);
  if (!isAdmin) {
    return json(null, 403, { error: 'Admin access required' });
  }

  // ── GET /api/admin/stats ─────────────────────────────────
  if (url.pathname === '/api/admin/stats' && req.method === 'GET') {
    const [users, revenue, usage, activeToday] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM users'),
      db.query(`SELECT
        SUM(amount_cents)/100.0 as total_revenue,
        COUNT(*) as total_purchases,
        SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN amount_cents ELSE 0 END)/100.0 as revenue_30d
        FROM purchases WHERE status = 'complete'`),
      db.query(`SELECT
        COUNT(*) as total_runs,
        COUNT(DISTINCT user_id) as unique_users,
        tool, COUNT(*) as count
        FROM usage
        GROUP BY tool ORDER BY count DESC`),
      db.query(`SELECT COUNT(DISTINCT user_id) as active
        FROM usage WHERE created_at > NOW() - INTERVAL '24 hours'`),
    ]);

    // Tool popularity breakdown
    const toolStats = {};
    usage.rows.forEach(r => { toolStats[r.tool] = parseInt(r.count); });

    return json(null, 200, {
      users: parseInt(users.rows[0].total),
      revenue: {
        total: parseFloat(revenue.rows[0].total_revenue || 0),
        purchases: parseInt(revenue.rows[0].total_purchases || 0),
        last30Days: parseFloat(revenue.rows[0].revenue_30d || 0),
      },
      usage: {
        totalRuns: usage.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
        uniqueUsers: parseInt(usage.rows[0]?.unique_users || 0),
        byTool: toolStats,
        activeToday: parseInt(activeToday.rows[0]?.active || 0),
      }
    });
  }

  // ── GET /api/admin/users ──────────────────────────────────
  if (url.pathname === '/api/admin/users' && req.method === 'GET') {
    const result = await db.query(`
      SELECT u.id, u.email, u.created_at,
        c.balance, c.unlimited_until,
        COUNT(us.id) as total_runs,
        MAX(us.created_at) as last_run,
        COALESCE(SUM(p.amount_cents),0)/100.0 as total_spent
      FROM users u
      LEFT JOIN credits c ON c.user_id = u.id
      LEFT JOIN usage us ON us.user_id = u.id
      LEFT JOIN purchases p ON p.user_id = u.id AND p.status = 'complete'
      GROUP BY u.id, u.email, u.created_at, c.balance, c.unlimited_until
      ORDER BY u.created_at DESC
      LIMIT 100
    `);
    return json(null, 200, { users: result.rows });
  }

  // ── GET /api/admin/revenue ────────────────────────────────
  if (url.pathname === '/api/admin/revenue' && req.method === 'GET') {
    const result = await db.query(`
      SELECT p.*, u.email
      FROM purchases p
      LEFT JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);
    return json(null, 200, { purchases: result.rows });
  }

  // ── POST /api/admin/user/credit ───────────────────────────
  if (url.pathname === '/api/admin/user/credit' && req.method === 'POST') {
    const { targetUserId, credits } = body;
    if (!targetUserId || !credits) {
      return json(null, 400, { error: 'targetUserId and credits required' });
    }
    await db.query(
      `INSERT INTO credits (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = credits.balance + $2, updated_at = NOW()`,
      [targetUserId, parseInt(credits)]
    );
    return json(null, 200, { added: true, credits: parseInt(credits) });
  }

  // ── GET /api/admin/linkedin/drafts ────────────────────────
  if (url.pathname === '/api/admin/linkedin/drafts' && req.method === 'GET') {
    const result = await db.query(
      `SELECT * FROM linkedin_drafts ORDER BY created_at DESC LIMIT 20`
    ).catch(() => ({ rows: [] })); // table may not exist yet
    return json(null, 200, { drafts: result.rows });
  }

  // ── POST /api/admin/linkedin/draft ───────────────────────
  if (url.pathname === '/api/admin/linkedin/draft' && req.method === 'POST') {
    const { text, style, link } = body;
    await db.query(
      `INSERT INTO linkedin_drafts (text, style, link, created_by) VALUES ($1, $2, $3, $4)`,
      [text, style || 'contribution', link || 'https://jobhunter.ai', userId]
    ).catch(() => {}); // create table if needed
    return json(null, 200, { saved: true });
  }

  // ── POST /api/admin/linkedin/post ────────────────────────
  if (url.pathname === '/api/admin/linkedin/post' && req.method === 'POST') {
    const { text, link } = body;

    const linkedInToken = process.env.LINKEDIN_ACCESS_TOKEN;
    const linkedInUrn = process.env.LINKEDIN_AUTHOR_URN; // urn:li:person:xxx

    if (!linkedInToken || !linkedInUrn) {
      return json(null, 400, {
        error: 'LinkedIn not connected. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN in Railway env vars.',
        setup: 'Get token at: https://www.linkedin.com/developers/apps'
      });
    }

    const result = await postToLinkedIn({
      accessToken: linkedInToken,
      authorUrn: linkedInUrn,
      text,
      link: link || 'https://jobhunter.ai'
    });

    if (result.success) {
      // Log it
      await db.query(
        `INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, 'linkedin.post', $2)`,
        [userId, JSON.stringify({ postId: result.postId, textLength: text.length })]
      ).catch(() => {});
    }

    return json(null, result.success ? 200 : 400, result);
  }

  return null; // not an admin route
}

module.exports = { handleAdminRoute, requireAdmin };
