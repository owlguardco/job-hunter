# Onboarding — Pick Your Path

Three ways to use Job Hunter. Pick the one that fits you.

---

## Path 1 — Web UI (no terminal, no install)

**For:** Anyone. Works on any computer. No coding required.

### Option A — Hosted (easiest)

Go to **https://owlguardco.github.io/job-hunter**

You'll need an Anthropic API key. Here's how to get one:

1. Go to **https://console.anthropic.com** and create a free account
2. Go to **Billing** and add $5 — each use costs about 2-5 cents ($5 covers ~100 uses)
3. Go to **API Keys**, click **Create Key**, copy it
4. Paste it into the key field on the site — it stays in your browser only

That's it. Paste your resume, paste a job description, click run.

### Option B — Local server (if you have Node.js)

```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter
cp .env.example .env
# Open .env, add your ANTHROPIC_API_KEY
npm start
```

Open **http://localhost:3000**

Same UI as the hosted version, but prompts load from the local agent files — so any changes you make to `agents/*.md` show up immediately.

---

## Path 2 — Terminal

**For:** People comfortable with the command line.

### Setup

```bash
# 1. Clone
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter

# 2. API key
cp .env.example .env
# Open .env and add: ANTHROPIC_API_KEY=sk-ant-your-key-here

# 3. Install Claude Code (if not already installed)
npm install -g @anthropic-ai/claude-code

# 4. Fill in your inputs
# Open inputs/my-resume.md — paste your resume
# Open inputs/job-description.md — paste the job posting

# 5. Verify everything is ready
npm run check

# 6. Run
npm run resume
```

### The right order for a job application

```bash
npm run decode       # understand the JD before doing anything else
npm run ats          # fix ATS issues before tailoring
npm run resume       # tailor to the specific role
npm run cover-letter # write the cover letter
```

### The right order for interview prep

```bash
npm run research     # one-page brief on the company + interviewer
npm run interview    # story bank + coached answers
npm run mock         # live simulation — practice until you're scoring A's
npm run send-thankyou # after the interview
```

### All commands

| Command | What it does |
|---|---|
| `npm run linkedin` | LinkedIn profile audit |
| `npm run resume` | Tailor resume to JD |
| `npm run cover-letter` | Write cover letter |
| `npm run ats` | ATS scanner |
| `npm run interview` | Story bank + coached answers |
| `npm run mock` | Live mock interview with grading |
| `npm run research` | Pre-interview brief |
| `npm run negotiate` | Practice offer negotiation |
| `npm run decode` | Decode a JD |
| `npm run compare` | Compare two offers |
| `npm run outreach` | Cold outreach messages |
| `npm run promote` | Build promotion case |
| `npm run review` | Performance review prep |
| `npm run internal` | Internal job application |
| `npm run jobs` | Search job boards |
| `npm run salary` | Research market comp |
| `npm run schedule` | Schedule interview (Google Calendar MCP) |
| `npm run send-thankyou` | Send thank-you (Gmail MCP) |
| `npm run check` | Validate all inputs |

---

## Path 3 — Claude Code

**For:** Developers. Most flexible — run any agent directly, modify prompts on the fly.

### Setup

```bash
git clone https://github.com/owlguardco/job-hunter.git
cd job-hunter

# Install Claude Code if not already installed
npm install -g @anthropic-ai/claude-code
claude login

# Fill in your inputs
# inputs/my-resume.md
# inputs/job-description.md
```

No `.env` needed — Claude Code uses its own API connection.

### Running agents

```bash
claude "follow agents/apply-resume.md"
claude "follow agents/interview-mock.md"
claude "follow agents/interview-research.md"
```

Any file in `agents/` works. Claude Code reads the file and executes the instructions.

### With --dangerously-skip-permissions (for automated runs)

```bash
claude --dangerously-skip-permissions < agents/apply-resume.md
```

Use this when you want the agent to run without any confirmation prompts.

### Modifying agents

Every agent is a plain markdown file in `agents/`. Open any of them and edit the instructions — changes take effect immediately on the next run. This is how you customize the tool for your specific situation.

---

## Inputs reference

| File | Used by | What to put in it |
|---|---|---|
| `inputs/my-resume.md` | Most tools | Your full resume, plain text |
| `inputs/my-linkedin.md` | LinkedIn audit | Your LinkedIn profile text |
| `inputs/job-description.md` | Most tools | The job posting you're targeting |
| `inputs/job-search-criteria.md` | `npm run jobs` | Roles, location, filters |
| `inputs/linkedin-url.txt` | `npm run linkedin-scrape` | Your LinkedIn profile URL |
| `inputs/cold-outreach-target.md` | `npm run outreach` | Target company and contact |
| `inputs/interview-context.md` | `npm run research` | Interviewer name and details |

All input files are git-ignored — they never leave your machine.

---

## Outputs reference

All outputs land in `outputs/` — git-ignored, stays local.

| File | Created by |
|---|---|
| `outputs/linkedin-audit.md` | `npm run linkedin` |
| `outputs/resume-tailored.md` | `npm run resume` |
| `outputs/resume-gaps.md` | `npm run resume` |
| `outputs/cover-letter.md` | `npm run cover-letter` |
| `outputs/ats-scan.md` | `npm run ats` |
| `outputs/interview-prep.md` | `npm run interview` |
| `outputs/interview-story-bank.md` | `npm run interview` |
| `outputs/mock-interview.md` | `npm run interview` |
| `outputs/thank-you-templates.md` | `npm run interview` |
| `outputs/interview-brief.md` | `npm run research` |
| `outputs/salary-research.md` | `npm run salary` |
| `outputs/jd-decoded.md` | `npm run decode` |
| `outputs/job-shortlist.md` | `npm run jobs` |
| `outputs/offer-comparison.md` | `npm run compare` |
| `outputs/cold-outreach.md` | `npm run outreach` |
| `outputs/promotion-case.md` | `npm run promote` |
| `outputs/review-prep.md` | `npm run review` |
| `outputs/internal-application.md` | `npm run internal` |

---

## Advanced — LinkedIn Auto-Scrape

Skip the copy-paste step. Scrape your LinkedIn profile from a URL.

**Extra requirements:** Python 3.8+, `uv`, Chrome

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# One-time login
uvx linkedin-scraper-mcp@latest --login
# Log in through the Chrome window that opens

# Add your URL
echo "https://www.linkedin.com/in/yourname/" > inputs/linkedin-url.txt

# Run
npm run linkedin-scrape
```

If your session expires:
```bash
uvx linkedin-scraper-mcp@latest --login
```

---

## Troubleshooting

**`ANTHROPIC_API_KEY not set`**
```bash
cp .env.example .env
# Add your key to .env
```

**`npm run check` fails with blank file errors**
Fill in the input files in `inputs/` before running any tool.

**`npm run jobs` — JobSpy not installed**
```bash
pip3.11 install jobspy
```

**Claude Code shows `/login` error**
```bash
/login
```
Type that directly in the Claude Code prompt.

**Questions or issues**
Open an issue: https://github.com/owlguardco/job-hunter/issues
