# Pipeline — Interview Prep

## What This Does

Automated pipeline. Triggered when an interview is confirmed.
Runs research + full prep in one shot, no prompts.

Called by Hermes — runs without confirmation.

---

## Instructions for Claude Code

### Step 1 — Load inputs

Read `inputs/my-resume.md`.
Read `inputs/job-description.md`.
Read `inputs/interview-context.md` — interviewer name, title, interview type.
Read `rules/writing-rules.md`.

If `inputs/job-description.md` is empty or template:
Write "job-description.md not filled in — update it before running interview prep." to `outputs/pipeline-log.md` and stop.

### Step 2 — Run research

Execute the full instructions from `agents/interview-research.md`.
Save output to `outputs/interview-brief.md`.

### Step 3 — Run interview prep

Execute the full instructions from `agents/interview-prep.md`.
This produces:
- `outputs/interview-prep.md`
- `outputs/interview-story-bank.md`
- `outputs/mock-interview.md`
- `outputs/thank-you-templates.md`

### Step 4 — Write pipeline log

Append to `outputs/pipeline-log.md`:

```
[timestamp] interview-prep complete
  Role: [role from JD]
  Company: [company from JD]
  Files: interview-brief.md, interview-prep.md, interview-story-bank.md
```

### Step 5 — Done

Output:
```
Interview prep complete — [role] at [company]. Files saved to outputs/.
```

No interactive prompts. Runs unattended.
