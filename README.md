# Job Hunter

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.0-green.svg)](CHANGELOG.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> I searched for six months. Then I started using Claude Code to build my own tools — a LinkedIn content system, tailored resumes, research workflows — and wrapped up the search in under two months. This is everything I learned, packaged so you don't have to figure it out the hard way.

## What This Does

Job Hunter is a local CLI tool powered by Claude Code that helps you:

- **Audit your LinkedIn profile** — get a structured critique of your headline, about section, experience framing, and keyword gaps for your target role
- **Tailor your resume** — paste a job description and your base resume, get a version translated into the language of that specific role
- **Write cover letters** — same job description, same resume, outputs a letter that sounds like you wrote it — not a bot

## What Makes It Different

- **Runs locally** — your Anthropic API key, your machine, no data stored anywhere
- **Rules engine** — every output runs through a set of hard-won tone rules that kill AI tells before they hit the page (see `rules/writing-rules.md`)
- **Built on a real job search** — not demos. The prompts were refined across dozens of real applications that got screens.

## Quick Start

**Requirements:** Node.js 18+, an Anthropic API key, Claude Code installed

```bash
# 1. Clone the repo
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter

# 2. Add your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 3. Paste your LinkedIn profile into inputs/
# Edit inputs/my-linkedin.md with your profile text

# 4. Paste a job description
# Edit inputs/job-description.md

# 5. Run an agent
claude "follow agents/linkedin-analyzer.md"
claude "follow agents/resume-tailor.md"
claude "follow agents/cover-letter.md"
```

Outputs land in `outputs/` — git-ignored, stays on your machine.

## The Rules Engine

Every agent prompt loads `rules/writing-rules.md` before generating output. These rules exist because AI-generated job content has tells — patterns that signal to recruiters the writing wasn't done by a person. See the full list in [`rules/writing-rules.md`](rules/writing-rules.md).

The short version: no em dashes, no "Hi", no "proven track record", no bullets that start with "Responsible for."

## Examples

Sanitized before/after examples live in `examples/`:

- [`linkedin-audit-example.md`](examples/linkedin-audit-example.md) — what a profile audit looks like
- [`resume-tailored-example.md`](examples/resume-tailored-example.md) — before/after tailoring
- [`cover-letter-example.md`](examples/cover-letter-example.md) — sample output

## Project Structure

```
job-hunter/
├── agents/
│   ├── linkedin-analyzer.md    # LinkedIn profile audit
│   ├── resume-tailor.md        # Resume tailoring to a JD
│   ├── cover-letter.md         # Cover letter generation
│   └── interview-prep.md       # Interview question coaching
├── rules/
│   └── writing-rules.md        # Tone rules injected into every agent
├── inputs/
│   ├── my-linkedin.md          # Your LinkedIn profile
│   ├── my-resume.md            # Your base resume in markdown
│   └── job-description.md      # Target job description
├── scripts/
│   └── preflight.js            # Input validation before running agents
├── outputs/                    # Git-ignored — tailored docs land here
├── examples/                   # Sanitized before/after examples
├── ONBOARDING.md               # First-run walkthrough
├── JOB-TRACKER.md              # Markdown CRM for your pipeline
├── package.json                # npm run scripts
├── .env.example
└── .gitignore
```

## Full Pipeline

Job Hunter now covers the complete job search workflow end to end:

```bash
# 1. Find jobs matching your criteria
npm run jobs
# → outputs/job-shortlist.md — ranked postings scored against your resume

# 2. Research comp before the screening call
npm run salary
# → outputs/salary-research.md — range, anchor, negotiation playbook

# 3. Tailor your application
npm run ats          # scan for ATS issues first
npm run resume       # tailor resume to the JD
npm run cover-letter # write the cover letter

# 4. Prep for the interview
npm run interview    # story bank + coached answers
npm run mock         # live simulation with grading

# 5. After the interview
npm run schedule     # create calendar event with reminders (Google Calendar MCP)
npm run send-thankyou # send thank-you note via Gmail (Gmail MCP)
```

MCPs required for steps 5: Google Calendar and Gmail connected in Claude.ai settings.
Everything else runs locally with no additional setup beyond an Anthropic API key.

## Advanced — LinkedIn Auto-Scrape

Technical users can skip the copy-paste step and scrape their LinkedIn profile directly from a URL using a local MCP server.

```bash
# One-time setup
uvx linkedin-scraper-mcp@latest --login

# Add your URL to inputs/linkedin-url.txt, then:
npm run linkedin-scrape
```

Scrapes the profile, formats it, and runs the full audit automatically. See [ONBOARDING.md](ONBOARDING.md) for the full setup guide.

Uses [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server) running locally — credentials never leave your machine.

## Community & Security

- [SECURITY.md](SECURITY.md) — how to report a vulnerability responsibly
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — how we treat each other
- [CHANGELOG.md](CHANGELOG.md) — what's changed in each version

## Contributing

The most valuable contributions are:
- Additional writing rules from your own job search learnings
- Sanitized before/after examples (remove all real names, companies, contact info)
- Agent prompt improvements

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — use it, fork it, build on it.
