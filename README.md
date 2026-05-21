<p align="center">
  <img src="web/logo.svg" alt="Job Hunter" width="600" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" /></a>
  <a href="docs/CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.0.0-green.svg" alt="Version 1.0.0" /></a>
  <a href="docs/CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
</p>

> I searched for six months and got nowhere. The turning point wasn't working harder — it was getting honest about what I was actually competitive for, and stopping the spray-and-pray. Then I built tools to sharpen every step of the process. Wrapped up the search in under two months. This is everything I learned, packaged so you don't have to figure it out the hard way.

---

## What is this?

Job Hunter is a free AI toolkit that helps you:

- **Know where you stand** — resume reality check tells you what tier you're actually in, what roles you'll win, and what's keeping you from moving up. Job fit scorer tells you if a specific role is worth applying to before you spend an hour on it.
- **Write better applications** — tailored resumes, cover letters that don't sound like a bot, ATS scanner so software doesn't filter you out before a human sees your name
- **Prep for interviews** — story bank, coached answers, live mock interview with real-time grading
- **Handle offers** — practice the negotiation conversation, compare two offers side by side
- **Grow your career** — promotion case builder, performance review prep, internal job applications

**It's free.** You bring an Anthropic API key (~$5 covers ~100 uses). Or use the [hosted version](#-just-want-to-use-it-no-setup) if you don't want to deal with any of that.

---

## Just want to use it? No setup.

Go to **[jobhunter.ai](https://jobhunter.ai)** — sign up, buy a few credits, and start using it immediately. No terminal, no API keys, no install.

$0.25 per run · $19/month unlimited · Same tools as the open source version

---

## I want to set it up myself

### Option 1 — Open in browser (easiest self-hosted)

1. Download [`web/index.html`](web/index.html) from this repo (right-click → Save As)
2. Open it in any browser
3. When prompted, enter your Anthropic API key

**Getting an Anthropic API key:**
1. Go to **[console.anthropic.com](https://console.anthropic.com)** → sign up free
2. Go to **Billing** → add $5
3. Go to **API Keys** → Create Key → copy it

That's it. Paste, click, copy your output.

---

### Option 2 — Run locally with Node.js

```bash
# 1. Get the code
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter

# 2. Add your API key
cp .env.example .env
# Open .env in any text editor and paste your key after ANTHROPIC_API_KEY=

# 3. Start
npm start
```

Open **http://localhost:3000** in your browser. Same web UI, but prompts now load
from the local agent files — any edits you make to `agents/` take effect immediately.

---

### Option 3 — Terminal commands (power users)

```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
cp .env.example .env    # add your ANTHROPIC_API_KEY

# Not sure where to start?
npm run guide           # asks where you are and tells you what to run

# Or jump straight in
npm run ats             # scan your resume before applying
npm run resume          # tailor resume to a specific job
npm run interview       # build your interview prep guide
npm run mock            # practice with live grading
```

**All commands:**

| Stage | Command | What it does |
|---|---|---|
| **Reality Check** | `npm run reality-check` | Honest assessment of where you stand — what roles you'll actually win |
| | `npm run fit` | Score how competitive you are for a specific role before applying |
| **Apply** | `npm run linkedin` | Audit your LinkedIn profile |
| | `npm run decode` | Decode a JD — red flags, real pay, subtext |
| | `npm run ats` | Scan resume for ATS issues before submitting |
| | `npm run resume` | Tailor resume to a specific role |
| | `npm run cover-letter` | Write a cover letter that sounds human |
| **Search** | `npm run jobs` | Search Indeed, LinkedIn, Glassdoor |
| | `npm run salary` | Research market comp |
| | `npm run outreach` | Cold message a recruiter |
| **Interview** | `npm run research` | One-page company + interviewer brief |
| | `npm run interview` | Story bank + coached answers |
| | `npm run mock` | Live mock interview with grading |
| **Offer** | `npm run negotiate` | Practice the negotiation conversation |
| | `npm run compare` | Compare two offers side by side |
| | `npm run send-thankyou` | Send thank-you via Gmail |
| **Career** | `npm run promote` | Build your promotion case |
| | `npm run review` | Prep for your performance review |
| | `npm run internal` | Apply for an internal role |

---

### Option 4 — Claude Code (developers)

```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
claude "follow agents/apply-resume.md"
```

Every file in `agents/` is a standalone prompt. No `.env` needed — Claude Code
uses its own API connection. See [CLAUDE.md](CLAUDE.md) for project conventions.

---

## The right order for a job application

```
reality-check ← do this once before anything else — know your actual market
fit           ← score this specific role before spending time on it
decode        ← understand the JD before doing anything else
ats           ← fix resume issues before tailoring
resume        ← tailor to this specific role
cover-letter  ← write the letter
```

If `fit` scores below 6 — stop. Find a better role with `npm run jobs`.
If `fit` scores 7 or above — continue down the pipeline.

## The right order for interview prep

```
research      ← pull the company brief the morning before
interview     ← build story bank + coached answers
mock          ← practice until you're scoring A's and B's
send-thankyou ← within 24 hours after the interview
```

---

## How it works

```
job-hunter/                        (main branch — open source only)
│
├── CLAUDE.md                      project context for Claude Code sessions
├── README.md · LICENSE · server.js · package.json
│
├── agents/                        21 prompt files — one per tool
│   ├── apply-*   (8)              reality-check, fit-score, resume, cover letter, ATS, LinkedIn, JD decode, LinkedIn scrape
│   ├── search-*  (3)              jobs, salary, outreach
│   ├── interview-* (3)            prep, mock, research
│   ├── offer-*   (4)              negotiate, compare, schedule, thank-you
│   └── career-*  (3)              promote, review, internal
│
├── inputs/                        paste your stuff here (git-ignored)
├── outputs/                       results land here (git-ignored)
├── rules/writing-rules.md         tone rules injected into every agent
├── web/index.html                 browser UI — works standalone or via server
├── scripts/                       guide.js · preflight.js · job-search.py
├── examples/                      sanitized before/after examples
├── automation/                    Hermes + OpenClaw pipeline configs
└── docs/                          ONBOARDING · CHANGELOG · CONTRIBUTING · SECURITY
```

```
job-hunter/                        (commercial branch — adds hosted layer)
│
├── everything above, plus:
│
├── COMMERCIAL.md                  open core license stance
├── start.js                       entry point (routes open source vs commercial)
├── railway.toml · Procfile        deployment configs
│
├── commercial/
│   ├── server/
│   │   ├── index.js               Clerk auth · Stripe billing · Postgres
│   │   └── memory.js              Mem0 persistent memory layer
│   ├── db/schema.sql              users · credits · purchases · usage · profiles · sessions
│   ├── web/index.html             commercial UI — landing · dashboard · purchase modal
│   └── .env.example
│
└── docs/
    ├── commercial-setup.md        Railway · Clerk · Stripe deployment guide
    └── legal/
        ├── privacy-policy.md
        ├── terms-of-service.md
        └── refund-policy.md
```

All three paths (browser, terminal, Claude Code) use the same `agents/` files.
Update a prompt once and it works everywhere.

---

## The rules engine

Every tool runs your output through [`rules/writing-rules.md`](rules/writing-rules.md)
before returning it. These rules exist because AI-generated job content has tells
that kill credibility with recruiters.

The short version: no em dashes, no "Hi", no "proven track record", no bullets
that start with "Responsible for." See the full list in the rules file.

---

## Automation (advanced)

Connect Hermes + OpenClaw to run Job Hunter on a schedule — new jobs scored
every morning, results in your Discord. See [docs/advanced-automation.md](docs/advanced-automation.md).

---

## Hosting it yourself commercially

Job Hunter is MIT licensed. The `commercial` branch contains a full
hosted version with Clerk auth, Stripe billing, Postgres, and Mem0 memory.

```bash
git checkout commercial
```

See [`COMMERCIAL.md`](https://github.com/owlguardco/job-hunter/blob/commercial/COMMERCIAL.md)
and [`docs/commercial-setup.md`](https://github.com/owlguardco/job-hunter/blob/commercial/docs/commercial-setup.md).

---

## Contributing

The most useful contributions:
- Writing rules from your own job search
- Sanitized before/after examples
- Agent prompt improvements with before/after evidence

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

---

## License

MIT — use it, fork it, build on it.
