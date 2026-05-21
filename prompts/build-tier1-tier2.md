# Job Hunter — Tier 1 & 2 Integration Build

You are building five new features for the Job Hunter open source project at `~/job-hunter` (or wherever it was cloned). Work through each phase in order. Verify each step before moving to the next. If something fails, fix it before continuing — do not skip ahead.

---

## Setup verification

First, confirm the repo exists and check the current state:

```bash
ls ~/job-hunter/agents/
ls ~/job-hunter/web/
cat ~/job-hunter/package.json
```

All subsequent work happens inside `~/job-hunter/`.

---

## Phase 1 — JobSpy MCP Server (job search across Indeed, LinkedIn, Glassdoor)

### What this does
Lets users search for live job postings by role, location, and keywords — without leaving the tool. The agent pulls structured postings, scores them against the user's resume, and outputs a ranked shortlist.

### Step 1 — Verify prerequisites
```bash
python3 --version   # needs 3.8+
pip3 --version || pip --version
docker --version 2>/dev/null || echo "Docker not available"
```

### Step 2 — Install jobspy-mcp-server
Try pip first, fall back to Docker if unavailable:

```bash
pip3 install jobspy-mcp-server 2>/dev/null || pip install jobspy-mcp-server 2>/dev/null
```

If pip fails, note that Docker is the fallback — document this in the agent file.

Verify:
```bash
python3 -m jobspy_mcp_server --help 2>/dev/null || echo "Check install"
```

### Step 3 — Create `agents/job-search.md`

Write this file with the following content:

```markdown
# Job Search Agent

## What This Does

Searches for live job postings across Indeed, LinkedIn, Glassdoor, and other
platforms using JobSpy MCP. Scores each posting against your resume and outputs
a ranked shortlist with match scores and recommended next steps.

## Prerequisites

JobSpy MCP server installed:
\`\`\`bash
pip install jobspy-mcp-server
\`\`\`
Or via Docker:
\`\`\`bash
docker run -p 9423:9423 borgius/jobspy-mcp-server
\`\`\`

## Instructions for Claude Code

### Step 1 — Load inputs

Read `inputs/my-resume.md`.
Read `inputs/job-search-criteria.md`. This contains the user's search preferences.
Read `rules/writing-rules.md`.

### Step 2 — Start JobSpy MCP server

Try to start locally:
\`\`\`bash
python3 -m jobspy_mcp_server --port 9423 &
MCP_PID=$!
sleep 3
curl -s http://localhost:9423/health && echo "SERVER UP" || echo "SERVER DOWN"
\`\`\`

If server does not start, check if Docker version is running on port 9423.
If neither is available, tell the user to install JobSpy MCP first (see Prerequisites).

### Step 3 — Parse search criteria

From `inputs/job-search-criteria.md` extract:
- Role titles to search (may be multiple)
- Locations (city, state, or remote)
- Keywords to include
- Keywords to exclude
- Date posted preference (last 7 days default)
- Full-time vs contract preference

### Step 4 — Execute searches

Use the JobSpy MCP server at `http://localhost:9423` to search for jobs.
Run one search per role title. Collect all results.

For each search, use these parameters:
- search_term: role title
- location: from criteria
- results_wanted: 20
- hours_old: 168 (7 days)
- site_name: ["indeed", "linkedin", "glassdoor"]

### Step 5 — Score each posting against resume

For each job posting returned, score it 1-10 against the resume on:
- Title match (does the role title align with the user's background?)
- Keyword overlap (how many JD keywords appear in the resume?)
- Experience level match (seniority alignment)
- Industry match (does the company industry align with their background?)

Discard any postings scoring below 5.

### Step 6 — Output ranked shortlist

Write `outputs/job-shortlist.md` with:

\`\`\`
JOB SEARCH RESULTS
Searched: [date]
Criteria: [role] in [location]
Total found: [n] | After scoring: [n]

─────────────────────────────────────
RANK 1 — SCORE: 9/10
Role: [title]
Company: [company]
Location: [location]
Posted: [date]
Source: [indeed/linkedin/glassdoor]
URL: [link]

WHY IT SCORES HIGH:
- [specific reason from resume match]
- [specific reason]

GAPS TO PREPARE FOR:
- [requirement in JD not in resume]

RECOMMENDED ACTION: Apply now / Research first / Skip
─────────────────────────────────────
[repeat for each posting, ranked by score]
```

### Step 7 — Stop MCP server
\`\`\`bash
kill $MCP_PID 2>/dev/null || pkill -f jobspy_mcp_server 2>/dev/null
\`\`\`

### Step 8 — Prompt next steps

Tell the user:
> Found [n] matches. Top result: [role] at [company] — score [x]/10.
> Your shortlist is saved to outputs/job-shortlist.md
>
> To apply to any of these:
> 1. Copy the job URL into inputs/job-description.md
> 2. Run: npm run resume
> 3. Run: npm run cover-letter
> 4. Run: npm run ats
```

### Running

\`\`\`bash
npm run jobs
\`\`\`
```

### Step 4 — Create `inputs/job-search-criteria.md`

```markdown
# Job Search Criteria

<!-- Fill this in before running npm run jobs -->

## Role Titles
<!-- List the job titles you want to search for, one per line -->
Senior Account Executive
Account Executive
Enterprise Sales Manager

## Locations
<!-- City and state, or "Remote" -->
Charlotte, NC
Remote

## Must-Have Keywords
<!-- Skills or terms that must appear in the posting -->


## Exclude Keywords
<!-- Terms that disqualify a posting — e.g. "internship", "entry level" -->
internship
entry level
junior

## Date Posted
<!-- How recent: 1, 3, 7, or 30 days -->
7

## Employment Type
<!-- full-time, part-time, contract, or any -->
full-time

## Salary Minimum (optional)
<!-- Leave blank if not filtering by salary -->

```

---

## Phase 2 — Salary Research Agent

### What this does
Before any application, pulls real salary data for the role + location so the user knows their market rate going into a screening call. Prevents underquoting.

### Step 1 — Create `agents/salary-research.md`

Write this file:

```markdown
# Salary Research Agent

## What This Does

Researches current market compensation for a specific role and location.
Gives you a realistic range, a negotiation anchor, and talking points for
the comp conversation — before you get on a screening call.

## Instructions for Claude Code

### Step 1 — Load inputs

Read `inputs/job-description.md` for role title and company.
Read `inputs/my-resume.md` for years of experience and background context.

### Step 2 — Extract role details

From the JD identify:
- Exact role title
- Seniority level (entry / mid / senior / director / VP)
- Location (remote or specific city)
- Industry
- Company size if mentioned

### Step 3 — Research compensation

Use web search to find current salary data from:
- Glassdoor (search: "[role title] salary [city] site:glassdoor.com")
- LinkedIn Salary (search: "[role title] salary [city] site:linkedin.com/salary")
- Levels.fyi for tech roles (search: "[role title] [company] salary site:levels.fyi")
- Payscale (search: "[role title] salary [city] site:payscale.com")
- Indeed Salary (search: "[role title] salary [city] site:indeed.com")

Run at least 3 searches. Collect the ranges returned.

### Step 4 — Calculate ranges

From all data collected, determine:
- Floor: 25th percentile (low end, likely entry-level or low-cost market)
- Midpoint: 50th percentile (market rate for this role/location)
- Ceiling: 75th percentile (experienced candidate or HCOL market)
- Stretch: 90th percentile (for negotiation anchor — never open here, use as ceiling)

For sales roles, also calculate:
- Base salary range
- OTE (On-Target Earnings) range
- Commission structure norms for this role type

### Step 5 — Assess where the user lands

Based on their resume, assess where in the range they realistically sit:
- Years of experience in this role type
- Industry background alignment
- Geographic market (HCOL vs MCOL vs LCOL)
- Whether they're targeting a step up, lateral, or step down

### Step 6 — Write negotiation strategy

Produce a short negotiation playbook:

OPENING NUMBER: [specific number — not a range]
Why: Opening with a range anchors to the bottom. Opening with a number anchors higher.

ACCEPTABLE RANGE: [floor] to [ceiling]

WALK-AWAY NUMBER: [the number below which this role doesn't make sense]

IF THEY COME IN BELOW YOUR FLOOR:
[2-3 sentences on how to respond — what to say, what to ask for instead]

IF THEY ASK "WHAT ARE YOU LOOKING FOR" BEFORE AN OFFER:
"I'm focused on finding the right fit first. I'm confident we can get to a
number that works for both sides once we get there." — then redirect.

NON-SALARY LEVERS:
List 5 things to negotiate if base salary is fixed:
signing bonus, equity/RSUs, remote flexibility, start date, PTO, title bump,
performance review timing, expense account, equipment budget.

### Step 7 — Save output

Write to `outputs/salary-research.md`.

Tell the user:
> Market rate for [role] in [location]: [floor]-[ceiling] base, [OTE if applicable]
> Your anchor: [opening number]
> Full research saved to outputs/salary-research.md
```

---

## Phase 3 — Google Calendar MCP Integration

### What this does
After an interview is scheduled, creates the calendar event with a prep checklist, adds a 24-hour reminder for the thank-you note, and adds a follow-up reminder if no response in 5 business days.

### Step 1 — Create `agents/schedule-interview.md`

Write this file:

```markdown
# Schedule Interview — Calendar Agent

## What This Does

Creates a Google Calendar event for a scheduled interview with:
- Prep checklist in the description
- 1-hour reminder before the interview
- 24-hour post-interview reminder to send thank-you note
- 5-business-day follow-up reminder if no response

Requires Google Calendar MCP connected in Claude.ai settings.

## Instructions for Claude Code

### Step 1 — Load inputs

Read `inputs/job-description.md` for role and company.
If `outputs/interview-prep.md` exists, read it for prep context.

### Step 2 — Get interview details from user

Ask the user:
> What date and time is the interview? (e.g. "Tuesday June 3rd at 2pm ET")
> Who are you interviewing with? (name and title if known)
> Is it phone, video, or in-person?
> Video link or dial-in number if applicable?

### Step 3 — Create main interview event

Use Google Calendar MCP to create an event with:
- Title: "Interview — [Role] at [Company]"
- Date/time: as provided
- Duration: 60 minutes (default)
- Location/link: video link or phone number if provided
- Description:

\`\`\`
INTERVIEW PREP CHECKLIST

Before the interview:
☐ Review outputs/interview-prep.md
☐ Run the mock interview: npm run mock
☐ Research [Company] — recent news, funding, products
☐ Prepare 3 questions to ask the interviewer
☐ Confirm the video link / dial-in 30 minutes before
☐ Have your resume open in front of you

Key talking points from your prep:
[Pull the top 3 stories from outputs/interview-story-bank.md if it exists]

Interviewer: [name and title if provided]
\`\`\`

- Reminder: 60 minutes before

### Step 4 — Create thank-you note reminder

Create a second calendar event:
- Title: "Send thank-you note — [Company] interview"
- Date/time: next day at 9am
- Description: "Run: npm run thankyou — Send within 24 hours of the interview"
- Reminder: at time of event

### Step 5 — Create follow-up reminder

Create a third calendar event:
- Title: "Follow up on [Company] interview if no response"
- Date/time: 5 business days after the interview at 10am
- Description: "If you haven't heard back, send one polite follow-up email."
- Reminder: at time of event

### Step 6 — Confirm to user

Tell the user:
> 3 calendar events created:
> - Interview: [date/time]
> - Thank-you reminder: [date] at 9am
> - Follow-up reminder: [date] at 10am
>
> Your prep guide is in outputs/interview-prep.md
> Run `npm run mock` before the interview.

## Note on Google Calendar MCP

This agent requires the Google Calendar MCP to be connected in your Claude.ai
settings (Settings → Integrations → Google Calendar). The MCP must be enabled
for Claude Code to access it.

If not connected, Claude Code will prompt you to connect it.
```

---

## Phase 4 — Gmail MCP Integration

### What this does
Sends the thank-you note and follow-up emails directly from the tool. Removes the copy-paste step.

### Step 1 — Create `agents/send-thankyou.md`

Write this file:

```markdown
# Send Thank-You Note — Gmail Agent

## What This Does

Takes the thank-you note you generated, formats it as an email, and sends it
via Gmail — directly from the tool. No copy-paste.

Requires Gmail MCP connected in Claude.ai settings.

## Instructions for Claude Code

### Step 1 — Load inputs

Read `outputs/thank-you-templates.md`. This contains the three templates.
Read `inputs/job-description.md` for role and company context.

### Step 2 — Select template

Ask the user:
> Which template fits your interview?
> 1. Strong interview — I want this job
> 2. One concern came up
> 3. I'm also interviewing elsewhere

Wait for their answer.

### Step 3 — Get recipient details

Ask:
> Interviewer's email address?
> Their name? (for personalization)
> Anything specific from the interview to reference? (optional — leave blank to use the template as-is)

### Step 4 — Personalize if context provided

If the user provided interview context, lightly personalize the chosen template:
- Replace any [placeholder] text with the specific detail
- Keep the same structure and tone
- Do not change the opening or closing
- Apply all rules from `rules/writing-rules.md`

### Step 5 — Show draft for approval

Show the complete email to the user and ask:
> Ready to send? (yes / edit first)

If they want to edit, take their changes and show the updated version before sending.

### Step 6 — Send via Gmail MCP

Once approved, use Gmail MCP to:
- Create a draft with the finalized email
- Subject line: "Following up — [Role] interview"
- To: interviewer email
- Send immediately or save as draft based on user preference

Tell the user:
> Sent. Subject: "Following up — [Role] interview"
> Sent to: [email]
> Sent at: [timestamp]

## Note on Gmail MCP

Requires Gmail MCP connected in Claude.ai settings.
Settings → Integrations → Gmail

Claude Code will only send email when you explicitly confirm. It will always
show you the draft before sending.
```

---

## Phase 5 — Update package.json, README, and web UI

### Step 1 — Update package.json

Add these npm scripts to `package.json`:

```json
"jobs": "node scripts/preflight.js all && claude \"follow agents/job-search.md\"",
"salary": "node scripts/preflight.js resume && claude --print \"$(cat agents/salary-research.md)\"",
"schedule": "claude \"follow agents/schedule-interview.md\"",
"send-thankyou": "claude \"follow agents/send-thankyou.md\""
```

Add them after the existing "ats" script, before "check".

### Step 2 — Update CHANGELOG.md

Add a new entry at the top of CHANGELOG.md:

```markdown
## [0.4.0] — [today's date]

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
```

### Step 3 — Update README.md

Find the "## Advanced" section and add a new section before it called "## Full Pipeline" with this content:

```markdown
## Full Pipeline

Job Hunter now covers the complete job search workflow end to end:

\`\`\`bash
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
\`\`\`

MCPs required for steps 5: Google Calendar and Gmail connected in Claude.ai settings.
Everything else runs locally with no additional setup beyond an Anthropic API key.
```

### Step 4 — Commit and push

```bash
cd ~/job-hunter
git add -A
git status --short
git commit -m "v0.4.0 — full pipeline: job search, salary research, calendar, Gmail

agents/job-search.md — JobSpy MCP integration, searches Indeed/LinkedIn/Glassdoor,
  scores postings against resume, outputs ranked shortlist with match scores
agents/salary-research.md — web search salary research, produces negotiation
  playbook with opening number, acceptable range, walk-away number, and
  non-salary levers
agents/schedule-interview.md — Google Calendar MCP, creates interview event
  with prep checklist, thank-you reminder, and follow-up reminder
agents/send-thankyou.md — Gmail MCP, selects and personalizes thank-you
  template, shows draft for approval before sending
inputs/job-search-criteria.md — search criteria template
package.json — npm run jobs, salary, schedule, send-thankyou
README.md — full pipeline section
CHANGELOG.md — v0.4.0 entry"

git push https://[YOUR_GITHUB_TOKEN]@github.com/owlguardco/job-hunter.git main
```

**Replace [YOUR_GITHUB_TOKEN] with your new token after rotating.**

---

## Verification checklist

After all phases complete, verify:

```bash
cd ~/job-hunter

# All agent files exist
ls agents/
# Should show: ats-scanner.md, cover-letter.md, interview-prep.md,
# job-search.md, linkedin-analyzer.md, linkedin-scraper-setup.md,
# mock-interview.md, resume-tailor.md, salary-research.md,
# schedule-interview.md, send-thankyou.md

# Input templates exist
ls inputs/
# Should show: job-description.md, job-search-criteria.md, linkedin-url.txt,
# my-linkedin.md, my-resume.md

# npm scripts
cat package.json | grep -A 20 '"scripts"'
# Should show: linkedin, resume, cover-letter, interview, mock,
# linkedin-scrape, ats, jobs, salary, schedule, send-thankyou, check

# JobSpy installed
python3 -c "import jobspy" 2>/dev/null && echo "JobSpy OK" || echo "JobSpy not installed — Docker fallback available"
```

Report the results of all checks. If anything is missing, fix it before reporting done.

---

## Notes

- **JobSpy MCP** — source: `github.com/borgius/jobspy-mcp-server`. If pip install fails on the user's machine, Docker is the documented fallback. The agent handles both cases.
- **Google Calendar and Gmail MCPs** — these run through Claude.ai's MCP integration layer, not locally. The agents instruct Claude Code to use the connected MCPs. Users need to connect them in Claude.ai settings first.
- **Salary research** — uses web search tools available to Claude Code rather than a dedicated MCP. No additional install required.
- **No user data leaves the machine** except to Anthropic's API for inference and to Google's APIs for calendar/Gmail (with user's own OAuth credentials via the MCP).
