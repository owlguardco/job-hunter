# CLAUDE.md — Job Hunter Project Context

This file gives Claude Code context about the project when working in this repo.
Read this before making any changes.

---

## What this project is

Job Hunter is an AI-powered job search toolkit. It helps people find jobs, tailor
applications, prep for interviews, negotiate offers, and grow their careers.

**Three ways to use it:**
1. Web UI — `npm start` → http://localhost:3000 (open source, user brings own API key)
2. Terminal — `npm run [tool]` (19 commands)
3. Claude Code — `claude "follow agents/[agent].md"` (direct agent execution)

**Commercial version** — `npm run commercial` → http://localhost:3001
Adds Clerk auth, Stripe billing, Postgres usage tracking. Same agents, different server.

---

## Architecture

```
agents/          ← 19 prompt files — the core of the product
  apply-*        ← job application tools (resume, cover letter, ATS, LinkedIn)
  search-*       ← job search tools (jobs, salary, outreach)
  interview-*    ← interview prep (prep, mock, research)
  offer-*        ← offer handling (negotiate, compare, schedule, thank-you)
  career-*       ← career growth (promote, review, internal)

rules/
  writing-rules.md  ← injected into every agent prompt automatically

inputs/          ← user data (git-ignored)
outputs/         ← results (git-ignored)

server.js        ← open source server (no auth, users provide API key)
start.js         ← entry point — routes to open source or commercial server
commercial/
  server/index.js  ← commercial server (Clerk + Stripe + Postgres)
  web/index.html   ← commercial UI (landing, dashboard, purchase modal)
  db/schema.sql    ← users, credits, purchases, usage, profiles, sessions

web/
  index.html     ← open source UI (standalone HTML, direct API calls)

automation/      ← Hermes + OpenClaw pipeline configs
scripts/
  guide.js       ← interactive first-run guide (npm run guide)
  preflight.js   ← input validation before running agents
  job-search.py  ← JobSpy search (pip3.11 install jobspy)
```

---

## Key conventions

**Agent files:**
- All agents end with a `## ✅ What to do next` section
- File naming: `[category]-[action].md` (e.g. `apply-resume.md`, `interview-mock.md`)
- Never hardcode user data — always read from `inputs/` files
- Always write output to `outputs/` files
- Always load `rules/writing-rules.md` before generating content

**Writing rules (non-negotiable):**
- No em dashes (—) in any output
- Never open with "Hi" or "Hello"
- No filler phrases: "proven track record", "results-driven", "passionate about"
- Never start a bullet with "Responsible for" or "Helped"
- Every resume bullet: Action verb + what you did + measurable result

**Server conventions:**
- Open source server: pure Node stdlib, no external dependencies
- Commercial server: pg + dotenv only — keep dependency count low
- All routes prefixed with `/api/`
- Webhooks at `/webhooks/[service]`
- Static files served from `web/` (open source) or `commercial/web/` (commercial)

**Git conventions:**
- Commit format: `v[version] — [short description]\n\n[detailed bullet list]`
- All agent renames must update: package.json scripts, server.js agentMap, commercial/server/index.js agentMap, docs/ONBOARDING.md
- Version in package.json must match CHANGELOG.md top entry

---

## What NOT to do

- Don't add external npm dependencies to the open source server (server.js) — it uses stdlib only
- Don't put user data, API keys, or credentials in any committed file
- Don't modify `inputs/` or `outputs/` content — those are git-ignored for a reason
- Don't add authentication to the open source server — it's intentionally open
- Don't change the agent naming convention without updating all four references above
- Don't generate fake before/after examples — all examples must be sanitized real outputs

---

## Inbox monitor (commercial only)

**Option A — commercial server** (`commercial/server/inbox.js`):
- `inbox_alerts` and `tracked_companies` tables in Postgres
- `GET /api/inbox` — returns active alerts + tracked companies
- `POST /api/inbox/scan` — triggers Gmail scan via Anthropic API + Gmail MCP
- `POST /api/inbox/companies` — add a company to track
- `PATCH /api/inbox/:id` — update alert status (replied/dismissed/snoozed)
- `POST /api/inbox/reply` — send drafted reply via Gmail MCP

**Classification:** RECRUITER_OUTREACH | INTERVIEW_INVITE | OFFER | STATUS | REJECTION | AUTO_CONFIRM | FOLLOW_UP_NEEDED
**Urgency:** HIGH (respond now) | MEDIUM (review) | LOW (no action)
**Auto-draft:** HIGH urgency emails get AI-drafted responses using user's resume context

**Option B — open source** (`agents/search-inbox-scan.md`, `npm run inbox`):
- Claude Code agent using Gmail MCP directly
- Classifies and drafts responses, writes outputs/inbox-scan.md
- `npm run send-email` sends drafts via Gmail MCP

## Memory layer (commercial only)

**Mem0** (`mem0ai` npm package) is wired into the commercial server as a persistent
memory layer on top of the Postgres sessions table.

**How it works:**
- Before every tool run: `memory.getMemoryContext(userId, toolType, inputs)` searches
  Mem0 for relevant past memories and injects them into the prompt
- After every tool run: `memory.addMemory(userId, toolType, inputs, result)` extracts
  meaningful facts and stores them against the user's ID
- Memory is keyed by `user_id` + `app_id: 'job-hunter'`

**What gets stored:** target roles, companies researched, interview weak spots, offer
amounts, career focus (job search vs internal growth). Never full resume text.

**Graceful degradation:** if `MEM0_API_KEY` is not set, all memory calls are silently
skipped. The tool runs normally without memory context.

**Files:**
- `commercial/server/memory.js` — Mem0 wrapper, `addMemory`, `searchMemory`, `getMemoryContext`
- `commercial/server/index.js` — calls `getMemoryContext` before prompt, `addMemory` after run
- `commercial/web/index.html` — `/api/memories` GET shows memory panel, DELETE clears it

**API endpoints (commercial):**
- `GET /api/memories` — returns all memories for the authenticated user
- `DELETE /api/memories` — clears all memories (GDPR compliance)

## Current state (v1.0.0)

- 19 agents across 5 categories
- 21 npm run commands
- Open source server: stdlib only, serves web UI, proxies to Anthropic
- Commercial server: Clerk auth, Stripe pay-per-use, Postgres usage tracking
- In-session context threading (sessions table, outputs carry forward)
- Persistent profile storage (profiles table)
- Automation: Hermes + OpenClaw pipelines in automation/
- Legal: Privacy Policy, Terms of Service, Refund Policy in docs/legal/

---

## How to add a new agent

1. Create `agents/[category]-[action].md` following the existing format
2. Add a `## ✅ What to do next` section at the bottom
3. Add an npm script to `package.json`
4. Add to `agentMap` in `server.js`
5. Add to `agentMap` in `commercial/server/index.js`
6. Add to `agents/README.md` table
7. Add to `docs/ONBOARDING.md` tools table
8. Add a panel to `web/index.html` (open source UI)
9. Add a panel to `commercial/web/index.html` (commercial UI)
10. Update `CHANGELOG.md`

---

## How to run locally

```bash
# Open source
npm start                          # → http://localhost:3000

# Commercial
cp commercial/.env.example commercial/.env
# Fill in all env vars
npm run commercial                 # → http://localhost:3001

# Database migration (commercial only)
npm run db:migrate
```
