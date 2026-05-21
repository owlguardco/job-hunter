# Advanced Automation — Hermes + OpenClaw

Connect Hermes and OpenClaw to run Job Hunter on autopilot.

New job postings scored every morning. JDs decoded before you wake up.
Results in your Discord. You review, decide, and act. The grunt work is automated.

---

## How it works

```
Hermes (scheduler)
  └── runs on schedule or manual trigger
      └── OpenClaw (executor)
            └── Claude Code
                  └── agents/*.md + automation/pipeline-*.md
                        └── outputs/ (results)
                              └── Discord notification
```

Hermes owns the schedule and notifications. OpenClaw runs the Claude Code
commands. The agent files do the actual work — same files used for manual runs.

---

## Prerequisites

**Required:**

| Tool | Version | Install |
|---|---|---|
| Claude Code | latest | `npm install -g @anthropic-ai/claude-code` |
| Hermes | latest | See [github.com/nkkko/hermes](https://github.com/nkkko/hermes) |
| Python 3.11+ | 3.11+ | `brew install python@3.11` |
| JobSpy | 0.31+ | `pip3.11 install jobspy` |

**Optional (for local LLM orchestration):**

| Tool | What for | Install |
|---|---|---|
| Ollama | Run local model for Hermes orchestration | [ollama.ai](https://ollama.ai) |
| Hermes 3 70B | Recommended model for orchestration | `ollama pull hermes3:70b` |

---

## Setup

### 1. Verify Job Hunter is working manually first

Before automating anything, make sure the manual tools work:

```bash
cd ~/job-hunter
npm run check
python3.11 scripts/job-search.py
```

Both should complete without errors. If not, fix those before continuing.

### 2. Install Hermes

Follow the Hermes installation guide at [github.com/nkkko/hermes](https://github.com/nkkko/hermes).

Verify:
```bash
hermes --version
```

### 3. Configure the Hermes profile

Copy the included profile into your Hermes profiles directory:

```bash
cp ~/job-hunter/automation/hermes-job-hunter.yaml ~/.hermes/profiles/job-hunter.yaml
```

Open `~/.hermes/profiles/job-hunter.yaml` and set:

```yaml
notifications:
  discord_webhook: "https://discord.com/api/webhooks/your-webhook-here"
```

To get a Discord webhook:
1. Open Discord → your server → channel settings
2. Integrations → Webhooks → New Webhook
3. Copy the URL and paste it above

### 4. Set the working directory

The profile defaults to `~/job-hunter`. If your repo is elsewhere, update:

```yaml
working_directory: /path/to/your/job-hunter
```

### 5. Set the model

If using Ollama locally:
```yaml
model:
  endpoint: http://127.0.0.1:11434/v1
  name: hermes3   # or whatever model you have
```

If using Claude API directly for orchestration, update the endpoint accordingly.
See Hermes docs for API key configuration.

### 6. Test a manual run

```bash
hermes run job-hunter daily-search
```

Watch the output. It should:
1. Run `python3.11 scripts/job-search.py`
2. Run Claude Code against `automation/pipeline-daily-search.md`
3. Send a Discord notification with the summary

If step 1 fails — check `pip3.11 install jobspy` and your search criteria.
If step 2 fails — check Claude Code is installed and authenticated (`claude login`).
If step 3 fails — check your Discord webhook URL.

### 7. Enable the schedule

```bash
hermes schedule job-hunter enable
```

Default schedule is 7am daily. Change it in the profile:

```yaml
pipelines:
  daily-search:
    schedule: "0 7 * * *"   # cron format
```

---

## Pipelines

### `daily-search` — runs on schedule

**What it does:**
1. Searches Indeed, LinkedIn, Glassdoor for roles matching your criteria
2. Scores every result against your resume (drops anything below 6/10)
3. Decodes the top 5 — red flags, salary estimate, fit assessment
4. Rewrites `outputs/job-shortlist.md` with scored, ranked results
5. Sends Discord notification with summary and top match

**Trigger:**
```bash
hermes run job-hunter daily-search
```

**Output:** `outputs/job-shortlist.md`, `outputs/pipeline-log.md`

---

### `interview-prep` — triggered manually

Run this when an interview is confirmed. Takes ~3 minutes.

**What it does:**
1. Pulls company news, interviewer background, competitive landscape
2. Builds story bank + 10 coached questions + mock interview script
3. Saves 4 output files
4. Sends Discord notification when ready

**Trigger:**
```bash
hermes run job-hunter interview-prep
```

**Before running:** Fill in `inputs/interview-context.md` with the
interviewer name, title, and interview type.

**Output:** `outputs/interview-brief.md`, `outputs/interview-prep.md`,
`outputs/interview-story-bank.md`, `outputs/mock-interview.md`

---

### `offer-analysis` — triggered manually

Run this when an offer comes in.

**What it does:**
1. Researches market comp for the role and location
2. Produces negotiation playbook with opening number, range, walk-away

**Trigger:**
```bash
hermes run job-hunter offer-analysis
```

**Output:** `outputs/salary-research.md`

---

## OpenClaw integration

If you're using OpenClaw to manage multiple Claude Code sessions, point it
at the automation pipeline files directly:

```bash
openclaw run --prompt automation/pipeline-daily-search.md --dir ~/job-hunter
```

Or register Job Hunter as an OpenClaw project:

```bash
openclaw project add job-hunter ~/job-hunter
openclaw run job-hunter pipeline-daily-search
```

See OpenClaw docs for session management, output routing, and multi-agent setup.

---

## Discord notifications

Every pipeline sends a Discord message when complete. Example output:

```
✅ daily-search complete
Found: 47 total | Scored above threshold: 12 | Top score: 9/10
Top match: Senior Account Executive — Veeva Systems (LinkedIn)
URL: https://linkedin.com/jobs/...

Full shortlist: outputs/job-shortlist.md
```

---

## What stays manual

Even with full automation enabled, these tools should always be run manually
and reviewed before use:

- `npm run resume` — tailored resume
- `npm run cover-letter` — cover letter
- `npm run interview` — story bank and coached answers
- `npm run mock` — live mock interview
- `npm run send-thankyou` — sending anything

Automating these creates generic output. The whole point of these tools is
that they produce something specific to you and the role. That requires your
attention.

---

## Troubleshooting

**Hermes can't find the profile**
```bash
ls ~/.hermes/profiles/
# Should show: job-hunter.yaml
```

**Claude Code not authenticated in Hermes context**
```bash
claude login
# Then retry the Hermes run
```

**JobSpy rate limited**
LinkedIn aggressively rate-limits scrapers. If LinkedIn results are empty,
Indeed and Glassdoor will still return results. Wait 1 hour and retry if needed.

**Discord notification not sending**
Test your webhook directly:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"content":"test"}' \
  YOUR_WEBHOOK_URL
```

**Hermes context length error**
Set context length in your profile:
```yaml
model:
  context_length: 131072
```

---

## Hermes-specific setup notes

Based on known Hermes configuration requirements:

- Discord token must be written directly to `~/.hermes/.env` as `DISCORD_BOT_TOKEN=[value]`
- Context length must be set to `131072` in both the model section AND `auxiliary: compression:` section
- `hermes profile create` does not accept `--model` — set via `hermes -p [profile] model` → "Custom endpoint"
- When Claude Code shows `/login` error inside a Hermes run, type `/login` directly in the prompt
