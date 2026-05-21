# Pipeline — Daily Search

## What This Does

Automated pipeline. Runs after `scripts/job-search.py` has already pulled
raw results into `outputs/job-shortlist.md`.

This prompt decodes the top postings, scores each against the resume,
rewrites the shortlist with actionable output, and saves it.

Called by Hermes — runs without prompts or confirmation.

---

## Instructions for Claude Code

### Step 1 — Load inputs

Read `outputs/job-shortlist.md` — raw search results from job-search.py.
Read `inputs/my-resume.md` — used for scoring.
Read `inputs/job-search-criteria.md` — used to understand what the user is targeting.
Read `rules/writing-rules.md`.

If `outputs/job-shortlist.md` is empty or missing:
Write "No results found — check inputs/job-search-criteria.md and retry." to `outputs/pipeline-log.md` and stop.

### Step 2 — Score every posting

For each job in the shortlist score it 1-10 against the resume:

- **Title match** (1-3 pts) — does the role align with the user's background and target?
- **Keyword overlap** (1-3 pts) — how many requirements in the posting appear in the resume?
- **Seniority match** (1-2 pts) — is the level appropriate?
- **Industry match** (1-2 pts) — does the company fit the user's background?

Discard any posting scoring below 6.

### Step 3 — Decode the top 5

For the top 5 postings by score, run a quick decode (condensed version of `apply-decode-jd.md`):

For each of the top 5:
- What they're actually looking for (2 sentences)
- Any red flags in the language
- Estimated salary range
- Fit assessment: strong / moderate / stretch

### Step 4 — Rewrite the shortlist

Rewrite `outputs/job-shortlist.md` with:

```
DAILY SEARCH RESULTS
Date: [today]
Total found: [n] | After scoring: [n]
─────────────────────────────────────

## TOP PICKS

### 1. [Role] — [Company] — SCORE: [n]/10
Location: [location] | Source: [site] | Posted: [date]
Salary: [estimate]
URL: [url]

WHY IT FITS: [1-2 specific sentences from resume match]
RED FLAGS: [any or "None detected"]
FIT: Strong / Moderate / Stretch

To apply:
  npm run decode    ← full JD analysis
  npm run resume    ← tailor resume
  npm run ats       ← check ATS before submitting

[repeat for top 5]

─────────────────────────────────────
## REMAINING MATCHES ([n] total)
[brief list: Role — Company — Score — URL]
```

### Step 5 — Write pipeline log

Append to `outputs/pipeline-log.md`:

```
[timestamp] daily-search complete
  Found: [n] total | Scored: [n] above threshold | Top score: [n]/10
  Top match: [role] at [company]
```

### Step 6 — Done

Output one line to terminal:
```
Daily search complete — [n] matches. Top: [role] at [company] ([score]/10)
```

No interactive prompts. No asking for input. This runs unattended.
