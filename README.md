# Job Hunter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.6.0-green.svg)](docs/CHANGELOG.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)

> I searched for three months. Then I started using Claude Code to build my own tools — a LinkedIn content system, tailored resumes, research workflows — and wrapped up the search in under two months. This is everything I learned, packaged so you don't have to figure it out the hard way.

---

## Pick your path

| I want to... | Use this |
|---|---|
| Point and click, no terminal | [Web UI](#-web-ui--anyone) |
| Use the command line | [Terminal](#-terminal--power-users) |
| Use Claude Code directly | [Claude Code](#-claude-code--developers) |

---

## 🖥️ Web UI — Anyone

No terminal. No install. Just a browser.

**Hosted (zero setup):**
Open **https://owlguardco.github.io/job-hunter** → enter your Anthropic API key → paste and go.

**Local (if you have Node.js):**
```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm start              # → http://localhost:3000
```

---

## ⌨️ Terminal — Power Users

```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm run check          # verify inputs are filled in
npm run resume         # run any tool
```

### All commands

**Apply for a job**
| Command | What it does |
|---|---|
| `npm run linkedin` | Audit your LinkedIn profile |
| `npm run resume` | Tailor resume to a specific JD |
| `npm run cover-letter` | Write a cover letter that sounds human |
| `npm run ats` | Scan for ATS issues before submitting |
| `npm run decode` | Decode a JD — red flags, real pay, subtext |

**Find jobs**
| Command | What it does |
|---|---|
| `npm run jobs` | Search Indeed/LinkedIn/Glassdoor |
| `npm run salary` | Research market comp |
| `npm run outreach` | Cold message a recruiter or hiring manager |

**Prep for interviews**
| Command | What it does |
|---|---|
| `npm run research` | One-page company + interviewer brief |
| `npm run interview` | Story bank + coached answers |
| `npm run mock` | Live mock interview with real-time grading |

**Handle offers**
| Command | What it does |
|---|---|
| `npm run negotiate` | Practice the offer negotiation conversation |
| `npm run compare` | Compare two offers side by side |
| `npm run schedule` | Create calendar event with reminders |
| `npm run send-thankyou` | Send thank-you note via Gmail |

**Grow your career**
| Command | What it does |
|---|---|
| `npm run promote` | Build your promotion case |
| `npm run review` | Prep for your performance review |
| `npm run internal` | Apply for an internal role |

---

## 🤖 Claude Code — Developers

No `.env` needed — Claude Code uses its own connection.

```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
claude "follow agents/apply-resume.md"
```

Every file in `agents/` is a standalone prompt. Run any of them directly.

```bash
# Apply
claude "follow agents/apply-resume.md"
claude "follow agents/apply-cover-letter.md"
claude "follow agents/apply-ats-scan.md"
claude "follow agents/apply-decode-jd.md"
claude "follow agents/apply-linkedin-audit.md"

# Search
claude "follow agents/search-jobs.md"
claude "follow agents/search-salary.md"
claude "follow agents/search-outreach.md"

# Interview
claude "follow agents/interview-research.md"
claude "follow agents/interview-prep.md"
claude "follow agents/interview-mock.md"

# Offer
claude "follow agents/offer-negotiate.md"
claude "follow agents/offer-compare.md"
claude "follow agents/offer-schedule.md"
claude "follow agents/offer-thankyou.md"

# Career
claude "follow agents/career-promote.md"
claude "follow agents/career-review.md"
claude "follow agents/career-internal.md"
```

---

## How it works

```
job-hunter/
│
├── agents/          ← 19 prompt files, one per tool
│   ├── apply-*      ← job application tools
│   ├── search-*     ← job search tools
│   ├── interview-*  ← interview prep tools
│   ├── offer-*      ← offer and post-interview tools
│   └── career-*     ← promotion and career growth tools
│
├── inputs/          ← paste your stuff here
│   ├── my-resume.md
│   ├── job-description.md
│   └── ...
│
├── outputs/         ← results land here (never pushed to git)
│
├── rules/
│   └── writing-rules.md   ← tone rules injected into every agent
│
├── web/
│   └── index.html   ← the web UI (works standalone or via server)
│
├── server.js        ← local server (npm start)
├── package.json     ← all npm run commands
│
└── docs/
    ├── ONBOARDING.md      ← detailed setup for all three paths
    ├── CHANGELOG.md
    ├── CONTRIBUTING.md
    ├── SECURITY.md
    └── templates/
        └── JOB-TRACKER.md ← markdown CRM for your pipeline
```

All three paths (web, terminal, Claude Code) read from the same `agents/` files. Change a prompt once, it updates everywhere.

---

## What makes it different

- **Runs locally** — your API key, your machine, nothing stored anywhere
- **Rules engine** — every output runs through [`rules/writing-rules.md`](rules/writing-rules.md), a set of hard-won rules that remove AI tells before output is generated (no em dashes, no "proven track record", no "Hi")
- **Built on a real search** — not demos. Prompts were refined across dozens of real applications that got screens.

---

## Getting your API key

1. Go to **https://console.anthropic.com** → create a free account
2. Go to **Billing** → add $5 (each use costs ~2-5 cents, $5 covers ~100 uses)
3. Go to **API Keys** → Create Key → copy it
4. Paste into `.env` (terminal/server) or the key field in the web UI

Your key stays on your machine. It's never sent anywhere except Anthropic's API.

---

## First time? Read the full guide

**[docs/ONBOARDING.md](docs/ONBOARDING.md)** — walks through all three paths step by step, includes an inputs/outputs reference, troubleshooting, and the advanced LinkedIn scraper setup.

---

## ⚡ Automation — Hermes + OpenClaw

For advanced users who want Job Hunter running on autopilot.

Connect Hermes and OpenClaw to automate the search pipeline — new postings
scored every morning, JDs decoded before you wake up, results delivered
to Discord.

```bash
# Copy the included Hermes profile
cp automation/hermes-job-hunter.yaml ~/.hermes/profiles/job-hunter.yaml

# Test a manual run
hermes run job-hunter daily-search

# Enable the daily schedule
hermes schedule job-hunter enable
```

**What gets automated:** job search, JD decoding, salary research, interview prep trigger.
**What stays manual:** resume tailoring, cover letters, anything that sends.

Full setup guide: [docs/advanced-automation.md](docs/advanced-automation.md)

---

## Contributing

The most useful contributions:
- Writing rules you learned from your own job search
- Sanitized before/after examples (replace all real names with placeholders)
- Agent prompt improvements with before/after evidence

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## License

MIT — use it, fork it, build on it.
