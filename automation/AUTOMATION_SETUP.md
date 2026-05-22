# Automation Setup

How Job Hunter's automation is wired, and how to verify your setup is correct.
This is the reference; [`../docs/advanced-automation.md`](../docs/advanced-automation.md)
has the full step-by-step walkthrough.

## Architecture

Job Hunter automates on **Hermes** — not macOS launchd, not crontab.

```
Hermes (scheduler + Discord notifications)
  └── OpenClaw (executor)
        └── Claude Code → agents/*.md + automation/pipeline-*.md
              └── outputs/
```

There are **no launchd plists and no crontab entries** for Job Hunter.
Scheduling lives entirely in the Hermes profile (`automation/hermes-job-hunter.yaml`).
The `schedule: "0 7 * * *"` field in that file is **Hermes' own scheduler**
expressed in cron syntax — it is not a system crontab entry.

## Paths — all portable, nothing to migrate

Every script and automation file uses portable paths:

- `scripts/job-search.py` — relative `Path("inputs/...")` / `Path("outputs/...")`, run from the repo root
- `scripts/preflight.js`, `scripts/guide.js`, `server.js` — `path.join(__dirname, "..")`
- `automation/hermes-job-hunter.yaml` — `working_directory: ~/job-hunter`, relative commands

No `~/Desktop/` paths, no hardcoded usernames, no absolute `/Users/...` paths in
automation code. If you clone the repo somewhere other than `~/job-hunter`, the
only value to change is `working_directory` in your copied Hermes profile
(see advanced-automation.md, step 4).

## Environment variables

| Context | Mechanism | What to set |
|---|---|---|
| Node tools (`npm run *`, `server.js`) | repo-root `.env` | `ANTHROPIC_API_KEY` |
| Hermes runtime | `~/.hermes/.env` | `DISCORD_BOT_TOKEN` |
| Hermes profile | `~/.hermes/profiles/job-hunter.yaml` | `discord_webhook` |

No script sources `~/.zshrc` or `~/.bashrc` — nothing depends on an interactive
shell. The one requirement: `python3.11`, `claude`, and `hermes` must be on
`PATH` in the environment Hermes runs commands in. The shipped profile calls
them by bare name (correct for a distributable template — do not hardcode
`/opt/homebrew/bin/...`). If your Hermes runs with a minimal PATH, point it at a
login shell or set `PATH` in the Hermes environment.

## What needs manual setup

Not in version control — must be configured per machine:

- `.env` — copy from `.env.example`, set `ANTHROPIC_API_KEY` (console.anthropic.com)
- `~/.hermes/profiles/job-hunter.yaml` — copy from `automation/hermes-job-hunter.yaml`, set `discord_webhook`
- `~/.hermes/.env` — set `DISCORD_BOT_TOKEN`
- `inputs/my-resume.md`, `inputs/job-search-criteria.md` — your data (keep local; do not commit personal info)
- JobSpy — `pip3.11 install jobspy`

## Verify

```bash
cd ~/job-hunter
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" && echo "package.json OK"
npm run check                        # preflight — inputs + API key
python3.11 scripts/job-search.py     # job search runs standalone
hermes run job-hunter daily-search   # full pipeline, manual trigger
```

If `package.json` ever fails the first check, look for unresolved merge
conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) — that breaks every
`npm run` command at once.
