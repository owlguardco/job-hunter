# Job Hunter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.6.0-green.svg)](CHANGELOG.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> I searched for three months. Then I started using Claude Code to build my own tools — a LinkedIn content system, tailored resumes, research workflows — and wrapped up the search in under two months. This is everything I learned, packaged so you don't have to figure it out the hard way.

---

## Three Ways to Use It

Pick the one that fits how you work. All three use the same agent files under the hood.

---

### Way 1 — Web UI (no terminal required)

For anyone. Paste your inputs, click run, copy output.

**Option A — With local server (recommended)**
```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
npm start
```
Open **http://localhost:3000** in your browser.

**Option B — Standalone (no install)**
Download `web/index.html`, open it in any browser. Bring your own Anthropic API key.
Or use the hosted version: **https://owlguardco.github.io/job-hunter**

---

### Way 2 — Terminal

For power users who prefer the command line.

```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
cp .env.example .env        # add your ANTHROPIC_API_KEY
npm run check               # verify your inputs are filled in
npm run resume              # run any tool
```

See the [full command list](#all-tools) below.

---

### Way 3 — Claude Code

For developers. Run any agent file directly.

```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
claude "follow agents/resume-tailor.md"
claude "follow agents/pre-interview-research.md"
claude "follow agents/mock-interview.md"
```

No `.env` needed — Claude Code uses its own API connection.

---

## Setup (Ways 1 and 2)

**Requirements:** Node.js 18+, an Anthropic API key

```bash
# 1. Clone
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter

# 2. Add your API key
cp .env.example .env
# Open .env and replace the placeholder with your key from console.anthropic.com

# 3. Fill in your inputs
# Edit inputs/my-resume.md      — paste your resume
# Edit inputs/job-description.md — paste the job you're targeting

# 4. Start the server (Way 1) or run a command (Way 2)
npm start           # Web UI at http://localhost:3000
npm run resume      # Terminal
```

**First time?** Read [ONBOARDING.md](ONBOARDING.md) — a full walkthrough for each path.

---

## All Tools

| Command | What it does |
|---|---|
| `npm run linkedin` | Audit your LinkedIn profile against a target role |
| `npm run resume` | Tailor your resume to a specific JD |
| `npm run cover-letter` | Write a cover letter that sounds human |
| `npm run ats` | Scan for ATS issues before submitting |
| `npm run interview` | Build story bank + coached answers |
| `npm run mock` | Live mock interview with real-time grading |
| `npm run send-thankyou` | Send thank-you note via Gmail MCP |
| `npm run jobs` | Search Indeed/LinkedIn/Glassdoor, score against resume |
| `npm run salary` | Research market comp + negotiation playbook |
| `npm run negotiate` | Practice the offer negotiation conversation |
| `npm run decode` | Decode a JD — red flags, real pay, what they actually want |
| `npm run research` | Pre-interview brief — company, interviewer, questions |
| `npm run compare` | Compare two offers side by side |
| `npm run outreach` | Write cold messages to recruiters or hiring managers |
| `npm run promote` | Build your promotion case |
| `npm run review` | Prep for your performance review |
| `npm run internal` | Apply for an internal role |
| `npm run schedule` | Schedule interview with Calendar MCP |
| `npm run check` | Validate all inputs before running anything |

---

## Full Pipeline

```bash
# 1. Find matching jobs
npm run jobs
# → outputs/job-shortlist.md

# 2. Research comp before the screening call
npm run salary
# → outputs/salary-research.md

# 3. Decode the JD
npm run decode
# → outputs/jd-decoded.md

# 4. Fix your application
npm run ats          # scan for ATS issues
npm run resume       # tailor to the JD
npm run cover-letter # write the letter

# 5. Prep for the interview
npm run research     # one-page company + interviewer brief
npm run interview    # story bank + coached answers
npm run mock         # live simulation with grading

# 6. After the interview
npm run send-thankyou # send thank-you via Gmail MCP
npm run negotiate     # if an offer comes — practice the conversation
npm run compare       # if two offers come — side-by-side analysis
```

---

## Project Structure

```
job-hunter/
├── agents/              # 19 agent prompt files — one per tool
├── rules/
│   └── writing-rules.md # Tone rules injected into every agent
├── inputs/              # Your data goes here (git-ignored)
│   ├── my-resume.md
│   ├── job-description.md
│   ├── job-search-criteria.md
│   └── ...
├── outputs/             # Results land here (git-ignored)
├── scripts/
│   ├── preflight.js     # Input validation
│   └── job-search.py    # JobSpy search script
├── web/
│   └── index.html       # Standalone web UI
├── examples/            # Sanitized before/after examples
├── server.js            # Local server (npm start)
├── package.json
├── ONBOARDING.md        # First-run walkthrough
├── JOB-TRACKER.md       # Markdown pipeline tracker
└── .env.example
```

---

## The Rules Engine

Every agent loads `rules/writing-rules.md` before generating output. These rules exist because AI-generated job content has tells that kill credibility with recruiters. The short version: no em dashes, no "Hi", no "proven track record", no bullets that start with "Responsible for."

See the full list: [`rules/writing-rules.md`](rules/writing-rules.md)

---

## Advanced — LinkedIn Auto-Scrape

Skip the copy-paste step entirely. Scrape your LinkedIn profile by URL using a local MCP server.

```bash
# One-time setup
uvx linkedin-scraper-mcp@latest --login

# Add your URL to inputs/linkedin-url.txt, then:
npm run linkedin-scrape
```

Full setup guide in [ONBOARDING.md](ONBOARDING.md).

---

## Community & Security

- [ONBOARDING.md](ONBOARDING.md) — full setup guide for all three paths
- [SECURITY.md](SECURITY.md) — how to report a vulnerability
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — how we treat each other
- [CHANGELOG.md](CHANGELOG.md) — version history
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute

## License

MIT — use it, fork it, build on it.
