# Changelog

All notable changes to Job Hunter are documented here.

---

## [1.2.1] — 2026-05-21 — Current

### Security hardening
- Clerk webhook: full Svix cryptographic signature verification (`wh.verify`)
- Input sanitization: strips prompt injection patterns, 10K char cap
- Rate limiting: 20 req/min per user on `/api/run`
- CORS: locked to `APP_URL` in production
- Audit log: `audit_log` table + `auditLog()` for tool runs, purchases, memory clears
- Session cleanup: automated hourly scheduler (sessions, audit entries, alerts)
- Python version check in preflight for `npm run jobs`
- LinkedIn scraper session security note in `SECURITY.md`

### Added
- `agents/apply-reality-check.md` (`npm run reality-check`) — market tier, what you're competitive for, gap analysis
- `agents/apply-fit-score.md` (`npm run fit`) — 1-10 score, Apply/Don't Apply/Apply With Caveats verdict
- `agents/search-inbox-scan.md` (`npm run inbox`) — Gmail scan, classify recruiter emails, draft responses
- `agents/search-send-email.md` (`npm run send-email`) — review and send drafted responses via Gmail
- Mem0 persistent memory layer (commercial) — cross-session user context
- Inbox monitor dashboard panel (commercial) — flagged emails, drafted responses, one-click send
- `commercial/server/inbox.js` — Gmail polling, classification, draft generation
- `commercial/server/memory.js` — Mem0 wrapper with graceful degradation
- `docs/AUDIT.md` — full security audit with pre-launch checklist

### Fixed
- `execSync` imported but unused in `server.js` — removed
- `server.js` agentMap missing `reality`, `fit`, `inbox`, `jobs`, `salary`, `schedule` — added all 21 tools
- Duplicate `type === 'ats'` check in `web/index.html` — removed
- Duplicate `type === 'interview'` check — merged into single clean block
- Missing preflight on 9 npm scripts — all scripts now validate inputs before running
- `agents/apply-linkedin-scrape.md` doubled input path — fixed
- `agents/search-send-email.md` missing next-steps section — added

---

## [1.1.0] — 2026-05-21

### Added
- `agents/apply-reality-check.md` — resume reality check
- `agents/apply-fit-score.md` — job fit scorer
- `npm run reality-check`, `npm run fit`

---

## [1.0.0] — 2026-05-21

### Added
- `CLAUDE.md` — project context for Claude Code sessions
- Persistent profile storage (commercial) — Postgres profiles table
- In-session context threading (commercial) — sessions table
- Legal docs: Privacy Policy, Terms of Service, Refund Policy

---

## [0.8.0] — 2026-05-21

### Added — Automation layer
- `automation/` — new folder following the same structure convention
- `automation/README.md` — entry point: what to automate vs keep manual
- `automation/hermes-job-hunter.yaml` — ready-to-use Hermes profile (daily-search, interview-prep, offer-analysis pipelines)
- `automation/pipeline-daily-search.md` — Claude Code prompt: search → decode top 5 → score → rewrite shortlist → log
- `automation/pipeline-interview-prep.md` — Claude Code prompt: research + full prep in one unattended run
- `docs/advanced-automation.md` — full setup guide for Hermes + OpenClaw integration
- `npm run daily-search` — runs full automated search pipeline directly
- `npm run interview-auto` — runs automated interview prep pipeline
- README: Automation section with quick-start commands

---

## [0.7.0] — 2026-05-21

### Changed — Structural cleanup
- All agent files renamed with category prefixes (`apply-*`, `search-*`, `interview-*`, `offer-*`, `career-*`)
- Reference docs moved to `docs/` (`CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `ONBOARDING`)
- `JOB-TRACKER.md` moved to `docs/templates/`
- Input files renamed to match agent prefixes (`search-outreach-target.md`, `apply-linkedin-url.txt`)
- Root directory now contains only: `README.md`, `server.js`, `package.json`, `.env.example`, `.gitignore`, `LICENSE`
- Version bumped to `0.7.0`

### Added — README files in every folder
- `agents/README.md` — full table of all 19 agents grouped by category
- `inputs/README.md` — which file goes with which tool
- `outputs/README.md` — what lands here, full output file reference
- `rules/README.md` — how the rules engine works, how to contribute
- `scripts/README.md` — preflight.js and job-search.py documentation
- `examples/README.md` — context for the seed examples, contribution guide

---

## [0.6.0] — 2026-05-21

### Added
- **`server.js`** — unified local server. Serves web UI, reads prompts from `agents/*.md` (single source of truth), proxies requests to Anthropic API
- **Three-way architecture** — web UI, terminal, and Claude Code all use the same agent files
- **Smart routing in web UI** — detects if local server is running and routes through it (agents load from .md files); falls back to direct Anthropic API call if not (standalone HTML mode still works)
- `npm start` — starts local server at http://localhost:3000

### Changed
- Web UI no longer has hardcoded prompts — all prompts now load from `agents/*.md` via the server
- README restructured with "Three Ways to Use It" as the primary entry point
- Version bump to 0.6.0

---

## [0.5.0] — 2026-05-21

### Added
- **Salary Negotiation Simulator** (`npm run negotiate`) — Claude plays the recruiter, you practice countering, grades each move A-D, debrief shows money left on table
- **Recruiter Cold Outreach** (`npm run outreach`) — 3 versions: LinkedIn (300 chars), email (under 100 words), referral message. Researches the target company first.
- **Job Description Decoder** (`npm run decode`) — reads between the lines: what they're really asking for, red flags decoded, salary estimate, manager personality assessment
- **Promotion Case Builder** (`npm run promote`) — builds the written case for promotion with talking points for the conversation; tells you if the case isn't ready yet
- **Performance Review Prep** (`npm run review`) — what to say, what to quantify, how to handle every rating scenario, what not to say
- **Pre-Interview Research** (`npm run research`) — one-page brief: company news, interviewer background, competitive landscape, Glassdoor signals, 5 questions grounded in research
- **Offer Comparison Tool** (`npm run compare`) — side-by-side total comp (Y1 and Y3), scores 7 dimensions, gives a direct recommendation
- **Internal Job Application** (`npm run internal`) — accounts for internal politics, existing relationships, and what's different about applying for a role at your current company
- `inputs/search-outreach-target.md` — template for outreach targets
- `inputs/interview-context.md` — template for interviewer details

---

## [0.4.0] — 2026-05-21

### Added
- **Job Search** (`npm run jobs`) — searches Indeed, LinkedIn, Glassdoor via JobSpy MCP, scores postings against resume, outputs ranked shortlist
- **Salary Research** (`npm run salary`) — researches market comp before screening calls, produces negotiation playbook with opening number, range, and walk-away number
- **Interview Scheduler** (`npm run schedule`) — creates Google Calendar events with prep checklist, thank-you reminder, and follow-up reminder via Google Calendar MCP
- **Send Thank-You** (`npm run send-thankyou`) — sends thank-you notes directly via Gmail MCP, no copy-paste
- `agents/job-search.md`
- `agents/salary-research.md`
- `agents/schedule-interview.md`
- `agents/send-thankyou.md`
- `inputs/job-search-criteria.md`

---

## [0.3.0] — 2026-05-21

### Added
- **ATS Scanner** — 5th tool. Scans resume against a job description, produces a match score (0-100), keyword gap analysis with exact placement instructions, formatting flags, content flags, rewritten summary, and a prioritized fix checklist (CRITICAL / HIGH IMPACT / QUICK WINS)
- **Mock Interview — Interactive Mode** (`agents/mock-interview.md`) — live simulation, one question at a time, grades each answer A/B/C/D, pushes back on vague answers, full debrief after 8 questions
- **Post-Interview Thank-You Notes** — 6th web UI tool. Generates 3 templates: strong interview, one concern came up, interviewing elsewhere
- **Story Bank** — interview prep now produces 8-10 STAR stories mapped to behavioral themes before the question set
- LinkedIn MCP scraper — advanced path for technical users (`agents/linkedin-scraper-setup.md`, `npm run linkedin-scrape`)
- Educational explainers on all 6 tools explaining the problem before asking for input
- `npm run mock` command for interactive mock interview via CLI

### Changed
- Interview Prep agent completely rewritten — now produces 4 output files: story bank, prep guide, mock script, thank-you templates
- Interview Prep web UI now has Prep Mode / Mock Mode toggle
- Guided API key setup modal replaces simple banner (3-step wizard with direct links to Anthropic console)

---

## [0.2.0] — 2026-05-21

### Added
- `package.json` with npm run scripts: `linkedin`, `resume`, `cover-letter`, `interview`, `check`
- `scripts/preflight.js` — validates inputs before running any agent. Exits with clear error if files are blank or still contain template placeholders
- `ONBOARDING.md` — 10-minute first-run walkthrough
- `agents/interview-prep.md` — interview question coaching with behavioral, role-specific, and curveball questions
- `JOB-TRACKER.md` — markdown CRM for tracking pipeline, contacts, offers, and weekly log
- `web/index.html` — single-file browser UI. Paste inputs, click run, copy output. No terminal required.
- GitHub Pages deployment workflow

---

## [0.1.0] — 2026-05-21

### Added
- `agents/linkedin-analyzer.md` — LinkedIn profile audit
- `agents/resume-tailor.md` — resume tailoring to a specific JD
- `agents/cover-letter.md` — cover letter generation
- `rules/writing-rules.md` — tone and style rules engine (no em dashes, no filler phrases, no "Hi", bullet formula)
- `inputs/` — template files for LinkedIn profile, resume, and job description
- `outputs/.gitkeep` — outputs directory, git-ignored
- `examples/` — sanitized before/after examples for all three tools
- MIT license, contributing guide, gitignore

---

## Format

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Version numbers follow [Semantic Versioning](https://semver.org/).
