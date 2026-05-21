# Automation

Connect OpenClaw and Hermes to run Job Hunter on autopilot.

Instead of running commands manually, the pipeline runs on a schedule —
new jobs scored every morning, JDs decoded before you wake up, results
delivered to Discord. You review, decide, and act. The grunt work is automated.

---

## What gets automated vs what stays manual

| Automated | Manual (always) |
|---|---|
| Job search — new postings scored nightly | Resume tailoring |
| JD decoding — every shortlisted posting | Cover letters |
| Salary research — per new role | Interview prep |
| Interview research — triggered by calendar event | Anything that sends (Gmail, Calendar) |

**Why the split:** The automated tools surface information. The manual tools
produce content that goes out under your name. Automating the second group
creates the exact generic output this tool is designed to prevent.

---

## Prerequisites

| Tool | What it does | Install |
|---|---|---|
| **Hermes** | Schedules and orchestrates agents, Discord notifications | [hermes docs](https://github.com/nkkko/hermes) |
| **OpenClaw** | Runs Claude Code commands locally | [OpenClaw docs](https://github.com/openclawai/openclaw) |
| **Claude Code** | Executes agent prompts | `npm install -g @anthropic-ai/claude-code` |
| **Ollama** (optional) | Local LLM for orchestration | [ollama.ai](https://ollama.ai) |

---

## Setup

See [`docs/advanced-automation.md`](../docs/advanced-automation.md) for the full walkthrough.

Quick version:

```bash
# 1. Copy the Hermes config into your Hermes profiles directory
cp automation/hermes-job-hunter.yaml ~/.hermes/profiles/job-hunter.yaml

# 2. Set your Discord webhook in the config
# Edit ~/.hermes/profiles/job-hunter.yaml → discord_webhook

# 3. Make sure your inputs are filled in
# inputs/my-resume.md
# inputs/job-search-criteria.md

# 4. Test a manual run
hermes run job-hunter daily-search

# 5. Enable the schedule
hermes schedule job-hunter enable
```

---

## Files in this folder

| File | What it is |
|---|---|
| `README.md` | This file |
| `hermes-job-hunter.yaml` | Ready-to-use Hermes profile for Job Hunter |
| `pipeline-daily-search.md` | Claude Code prompt — runs full search → decode → score pipeline |
| `pipeline-interview-prep.md` | Claude Code prompt — triggered when interview is scheduled |
