/**
 * Job Hunter — Local Server
 * 
 * Three ways to use Job Hunter:
 *   1. npm start         → web UI at http://localhost:3000
 *   2. npm run [tool]    → terminal / Claude Code
 *   3. claude "follow agents/[agent].md" → Claude Code direct
 * 
 * This server is the single source of truth for all prompts.
 * The web UI reads agent .md files through this server.
 * Terminal commands use the same agent files directly.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ── Load rules file once ──────────────────────────────────
function loadRules() {
  try {
    return fs.readFileSync(path.join(ROOT, 'rules/writing-rules.md'), 'utf8');
  } catch {
    return '';
  }
}

// ── Load agent file ───────────────────────────────────────
function loadAgent(name) {
  const agentPath = path.join(ROOT, 'agents', `${name}.md`);
  if (!fs.existsSync(agentPath)) return null;
  return fs.readFileSync(agentPath, 'utf8');
}

// ── Agent → web prompt mapping ────────────────────────────
// Maps web tool names to agent files + extracts the core prompt
// for browser use (strips Claude Code instructions, keeps the
// actual task definition)
function buildWebPrompt(toolType, inputs) {
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
    // Apply
    reality:  'apply-reality-check',
    fit:      'apply-fit-score',
    linkedin: 'apply-linkedin-audit',
    resume:   'apply-resume',
    cover:    'apply-cover-letter',
    ats:      'apply-ats-scan',
    decode:   'apply-decode-jd',
    // Search
    jobs:     'search-jobs',
    salary:   'search-salary',
    outreach: 'search-outreach',
    inbox:    'search-inbox-scan',
    // Interview
    interview: 'interview-prep',
    mock:      'interview-mock',
    research:  'interview-research',
    // Offer
    negotiate: 'offer-negotiate',
    compare:   'offer-compare',
    schedule:  'offer-schedule',
    thankyou:  'offer-thankyou',
    // Career
    promote:  'career-promote',
    review:   'career-review',
    internal: 'career-internal',
    network:  'career-network-message',
    // New tools
    referrals:  'search-referral-finder',
    'follow-up':'search-follow-up',
    company:    'search-company-research',
    counter:    'offer-counteroffer',
    debrief:    'interview-debrief',
    questions:  'interview-question-bank',
    portfolio:  'apply-portfolio-brief',
  };

  const agentName = agentMap[toolType];
  if (!agentName) return null;

  // Build input block based on tool type
  let inputBlock = '';

  if (toolType === 'linkedin') {
    inputBlock = `LINKEDIN PROFILE:\n${inputs.profile || ''}\n\nTARGET JOB DESCRIPTION:\n${inputs.jd || ''}`;
  } else if (toolType === 'research') {
    inputBlock = `JOB DESCRIPTION / COMPANY CONTEXT:\n${inputs.jd || ''}\n\nINTERVIEWER NAME/TITLE (if known):\n${inputs.interviewer || 'Not provided'}\n\nINTERVIEW TYPE:\n${inputs.interviewType || 'Not specified'}`;
  } else if (toolType === 'compare') {
    inputBlock = `OFFER A:\n${inputs.offerA || ''}\n\nOFFER B:\n${inputs.offerB || ''}`;
  } else if (toolType === 'thankyou') {
    inputBlock = `MY RESUME:\n${inputs.resume || ''}\n\nJOB DESCRIPTION:\n${inputs.jd || ''}\n\nINTERVIEW CONTEXT:\n${inputs.context || 'No specific context provided'}`;
  } else if (['promote', 'review', 'negotiate'].includes(toolType)) {
    inputBlock = `MY BACKGROUND:\n${inputs.resume || ''}\n\nCONTEXT:\n${inputs.context || ''}`;
  } else if (toolType === 'outreach') {
    inputBlock = `MY RESUME:\n${inputs.resume || ''}\n\nTARGET COMPANY/CONTACT:\n${inputs.target || ''}`;
  } else {
    // Default: resume + JD
    inputBlock = `MY RESUME:\n${inputs.resume || ''}\n\nJOB DESCRIPTION:\n${inputs.jd || ''}`;
  }

  // Read the agent file and extract the task definition
  // (everything after the first "## Instructions for Claude Code" heading)
  const agentContent = loadAgent(agentName);
  if (!agentContent) return null;

  // Strip Claude Code-specific setup steps (file reading, saving output)
  // Keep the actual task/evaluation logic
  const lines = agentContent.split('\n');
  const taskLines = [];
  let inSetup = false;
  let inSave = false;
  let started = false;

  for (const line of lines) {
    // Skip file-reading steps
    if (line.match(/^### Step 1.*Load inputs/i)) { inSetup = true; started = true; continue; }
    if (line.match(/^### Step \d.*Save output/i)) { inSave = true; continue; }
    if (inSave && line.match(/^### Step \d/)) { inSave = false; }
    if (inSetup && line.match(/^### Step \d/)) { inSetup = false; }
    if (inSetup || inSave) continue;
    if (!started && line.startsWith('#')) { started = true; }
    if (started) taskLines.push(line);
  }

  const coreTask = taskLines.join('\n').trim();

  return `${HARD_RULES}

---

${coreTask}

---

${inputBlock}`;
}

// ── MIME types ────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.md': 'text/plain',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// ── Request handler ───────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── API: list all agents ────────────────────────────────
  if (url.pathname === '/api/agents' && req.method === 'GET') {
    const agentsDir = path.join(ROOT, 'agents');
    const agents = fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        id: f.replace('.md', ''),
        name: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        file: f
      }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agents));
    return;
  }

  // ── API: get agent content ──────────────────────────────
  if (url.pathname.startsWith('/api/agent/') && req.method === 'GET') {
    const name = url.pathname.replace('/api/agent/', '');
    const content = loadAgent(name);
    if (!content) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Agent not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ name, content }));
    return;
  }

  // ── API: run tool (proxies to Anthropic) ────────────────
  if (url.pathname === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { type, inputs, apiKey, interviewMode } = JSON.parse(body);

        // Use mock agent if mock mode
        const toolType = (type === 'interview' && interviewMode === 'mock') ? 'mock' : type;
        const prompt = buildWebPrompt(toolType, inputs);

        if (!prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unknown tool type: ${type}` }));
          return;
        }

        if (!apiKey) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API key required' }));
          return;
        }

        // Call Anthropic API
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const data = await anthropicRes.json();

        if (!anthropicRes.ok) {
          res.writeHead(anthropicRes.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: data.error?.message || 'API error' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: data.content?.[0]?.text || '' }));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── API: health check ───────────────────────────────────
  if (url.pathname === '/api/health') {
    const agents = fs.readdirSync(path.join(ROOT, 'agents')).filter(f => f.endsWith('.md'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      agents: agents.length,
      version: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
    }));
    return;
  }

  // ── Serve static web files ──────────────────────────────
  let filePath = url.pathname === '/' ? '/web/index.html' : url.pathname;

  // Also serve web/* directly
  if (!filePath.startsWith('/web/')) {
    filePath = '/web' + filePath;
  }

  const fullPath = path.join(ROOT, filePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(fs.readFileSync(fullPath));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║          Job Hunter — Server Ready        ║
╠═══════════════════════════════════════════╣
║                                           ║
║  Web UI:    http://localhost:${PORT}          ║
║  Health:    http://localhost:${PORT}/api/health║
║  Agents:    http://localhost:${PORT}/api/agents║
║                                           ║
║  All prompts load from agents/*.md        ║
║  Single source of truth.                  ║
║                                           ║
╚═══════════════════════════════════════════╝
`);
});
