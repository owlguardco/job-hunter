/**
 * Job Hunter Commercial — Inbox Monitor
 *
 * Option A: Server-side Gmail polling with persistent alert storage.
 * Runs on demand (triggered by dashboard) or on a schedule.
 *
 * Flow:
 *   1. Load user's tracked companies from Postgres
 *   2. Search Gmail via Anthropic API (with Gmail MCP) for relevant emails
 *   3. Classify each email by type and urgency
 *   4. Draft responses using the user's resume context
 *   5. Store alerts in inbox_alerts table
 *   6. Return to dashboard for display
 *
 * Gmail access: routed through Anthropic API with Gmail MCP
 * (same pattern as the tool runner — uses the user's connected Gmail via Clerk OAuth)
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '../..');

function loadRules() {
  try { return fs.readFileSync(path.join(ROOT, 'rules/writing-rules.md'), 'utf8'); }
  catch { return ''; }
}

// ── Email classification ──────────────────────────────────
function classifyEmail(subject, snippet, fromEmail) {
  const text = `${subject} ${snippet}`.toLowerCase();
  const from = fromEmail.toLowerCase();

  // Rejection signals
  if (text.match(/unfortunately|not moving forward|decided to|other candidates|pursue other|not selected|not a fit/)) {
    return { classification: 'REJECTION', urgency: 'LOW' };
  }

  // Auto-confirm signals
  if (text.match(/thank you for applying|application received|we.?ve received your|confirmation|auto.?reply/i) ||
      from.match(/no.?reply|donotreply|noreply/)) {
    return { classification: 'AUTO_CONFIRM', urgency: 'LOW' };
  }

  // Offer / next steps
  if (text.match(/offer|pleased to|extend an offer|compensation|start date|onboarding/)) {
    return { classification: 'OFFER', urgency: 'HIGH' };
  }

  // Interview invite
  if (text.match(/interview|schedule|availability|calendar|zoom|meet|call|speak|chat|connect/)) {
    return { classification: 'INTERVIEW_INVITE', urgency: 'HIGH' };
  }

  // Recruiter outreach
  if (text.match(/opportunity|role|position|opening|background|profile|reaching out|came across/)) {
    return { classification: 'RECRUITER_OUTREACH', urgency: 'HIGH' };
  }

  // Application status
  if (text.match(/application|update|status|review|considering|shortlist/)) {
    return { classification: 'STATUS', urgency: 'MEDIUM' };
  }

  return { classification: 'STATUS', urgency: 'MEDIUM' };
}

// ── Build Gmail search queries ────────────────────────────
function buildSearchQueries(companies) {
  const queries = [];

  // Search by company domain
  for (const company of companies.slice(0, 10)) {
    if (company.domain) {
      queries.push(`from:*@${company.domain} newer_than:30d`);
    }
  }

  // Broad recruiter signals
  queries.push('from:(recruiter OR talent OR hiring OR careers) newer_than:14d');
  queries.push('subject:(interview OR opportunity OR application OR offer) newer_than:30d');

  return queries;
}

// ── Draft a response using Anthropic API ─────────────────
async function draftResponse(classification, emailData, userResume, apiKey) {
  const rules = loadRules();

  const prompts = {
    RECRUITER_OUTREACH: `Draft a reply to this recruiter email. Express genuine interest without sounding desperate. Propose 2-3 specific time slots in the next 48 hours. Under 100 words. Apply these rules: ${rules.substring(0, 500)}

Email from: ${emailData.fromName} at ${emailData.company}
Subject: ${emailData.subject}
Content: ${emailData.snippet}

My background: ${userResume ? userResume.substring(0, 500) : 'Senior professional with B2B sales background'}`,

    INTERVIEW_INVITE: `Draft a reply confirming availability for this interview request. Confirm the time or propose alternatives. Ask one clarifying question if format/attendees not mentioned. Under 80 words. No "Hi". No "Thank you for reaching out."

Email: ${emailData.snippet}`,

    OFFER: `Draft a brief acknowledgment of this offer email. Acknowledge receipt, ask for 24-48 hours to review. Do not negotiate in email. Under 60 words. Professional and warm.

Email: ${emailData.snippet}`,

    STATUS: `Draft a brief, professional reply to this application status update if a reply is warranted. If it's just informational, say NO_REPLY_NEEDED. Under 80 words.

Email: ${emailData.snippet}`,
  };

  const prompt = prompts[classification] || prompts.STATUS;
  if (!prompt || !apiKey) return null;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const draft = data.content?.[0]?.text || '';
    if (draft === 'NO_REPLY_NEEDED') return null;
    return draft;
  } catch (err) {
    console.error('Draft generation error:', err.message);
    return null;
  }
}

// ── Main scan function ────────────────────────────────────
// Called from the commercial server when user triggers a scan
// gmailSearchFn: function(query) that calls Gmail MCP — passed in from server
async function scanInbox({ userId, db, apiKey, userResume, gmailSearchFn }) {

  // 1. Load tracked companies
  const companiesResult = await db.query(
    'SELECT name, domain, role, stage FROM tracked_companies WHERE user_id = $1',
    [userId]
  );
  const companies = companiesResult.rows;

  if (companies.length === 0) {
    return { alerts: [], message: 'No tracked companies. Add companies to track in your dashboard.' };
  }

  // 2. Build search queries and fetch emails
  const queries = buildSearchQueries(companies);
  const allEmails = [];
  const seenIds = new Set();

  for (const query of queries) {
    try {
      const results = await gmailSearchFn(query);
      for (const email of (results || [])) {
        if (!seenIds.has(email.id)) {
          seenIds.add(email.id);
          allEmails.push(email);
        }
      }
    } catch (err) {
      console.error(`Gmail search error for query "${query}":`, err.message);
    }
  }

  // 3. Filter to emails from tracked company domains
  const companyDomains = new Set(companies.map(c => c.domain).filter(Boolean));
  const companyNames = companies.map(c => c.name.toLowerCase());

  const relevantEmails = allEmails.filter(email => {
    const fromDomain = email.from?.match(/@([^>]+)/)?.[1]?.toLowerCase();
    const fromText = email.from?.toLowerCase() || '';
    const subjectText = email.subject?.toLowerCase() || '';
    const snippetText = email.snippet?.toLowerCase() || '';

    return (
      (fromDomain && companyDomains.has(fromDomain)) ||
      companyNames.some(name => fromText.includes(name) || subjectText.includes(name)) ||
      subjectText.match(/interview|offer|application|opportunity/) ||
      snippetText.match(/interview|offer|opportunity|position|role/)
    );
  });

  // 4. Check existing alerts to avoid duplicates
  const existingIds = await db.query(
    'SELECT gmail_message_id FROM inbox_alerts WHERE user_id = $1',
    [userId]
  );
  const existingSet = new Set(existingIds.rows.map(r => r.gmail_message_id));

  const newEmails = relevantEmails.filter(e => !existingSet.has(e.id));

  // 5. Classify, draft, and store new alerts
  const newAlerts = [];

  for (const email of newEmails.slice(0, 20)) {
    const fromEmail = email.from?.match(/<([^>]+)>/)?.[1] || email.from || '';
    const fromName = email.from?.match(/^([^<]+)/)?.[1]?.trim() || fromEmail;

    // Match to company
    const fromDomain = fromEmail.match(/@([^>]+)/)?.[1]?.toLowerCase();
    const matchedCompany = companies.find(c =>
      (c.domain && fromDomain?.includes(c.domain)) ||
      email.subject?.toLowerCase().includes(c.name.toLowerCase())
    );

    const { classification, urgency } = classifyEmail(
      email.subject || '',
      email.snippet || '',
      fromEmail
    );

    // Check if 48hr old and no reply
    const receivedAt = new Date(email.internalDate ? parseInt(email.internalDate) : Date.now());
    const hoursOld = (Date.now() - receivedAt.getTime()) / (1000 * 60 * 60);
    const finalUrgency = (hoursOld > 48 && urgency !== 'LOW') ? 'HIGH' : urgency;
    const finalClassification = (hoursOld > 48 && classification !== 'REJECTION' && classification !== 'AUTO_CONFIRM')
      ? 'FOLLOW_UP_NEEDED'
      : classification;

    // Draft response for HIGH urgency
    let draft = null;
    if (finalUrgency === 'HIGH' && classification !== 'REJECTION' && classification !== 'AUTO_CONFIRM') {
      draft = await draftResponse(classification, {
        fromName,
        company: matchedCompany?.name || fromDomain || 'the company',
        subject: email.subject,
        snippet: email.snippet,
      }, userResume, apiKey);
    }

    // Store in DB
    try {
      const inserted = await db.query(
        `INSERT INTO inbox_alerts
         (user_id, gmail_thread_id, gmail_message_id, from_email, from_name,
          company, subject, received_at, snippet, classification, urgency, drafted_reply)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (gmail_message_id) DO NOTHING
         RETURNING *`,
        [userId, email.threadId, email.id, fromEmail, fromName,
         matchedCompany?.name || fromDomain || '',
         email.subject, receivedAt, email.snippet,
         finalClassification, finalUrgency, draft]
      );

      if (inserted.rows.length) {
        newAlerts.push(inserted.rows[0]);
      }
    } catch (err) {
      console.error('Alert insert error:', err.message);
    }
  }

  // 6. Return all active (non-dismissed) alerts sorted by urgency
  const allAlerts = await db.query(
    `SELECT * FROM inbox_alerts
     WHERE user_id = $1 AND status IN ('pending', 'snoozed')
     ORDER BY
       CASE urgency WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
       received_at DESC
     LIMIT 50`,
    [userId]
  );

  return {
    alerts: allAlerts.rows,
    newCount: newAlerts.length,
    message: `Found ${newAlerts.length} new emails. ${allAlerts.rows.filter(a => a.urgency === 'HIGH').length} need a response.`,
  };
}

module.exports = { scanInbox, classifyEmail, draftResponse };
