# Changelog

All notable changes to Job Hunter are documented here.

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
