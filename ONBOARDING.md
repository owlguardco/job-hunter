# Onboarding — First Run Walkthrough

Five things to do before you run anything. Takes about 10 minutes.

---

## Step 1 — Install Claude Code

Claude Code is the CLI that powers every agent in this repo.

```bash
npm install -g @anthropic-ai/claude-code
```

Verify it works:
```bash
claude --version
```

If you hit issues, see the [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code).

---

## Step 2 — Add your API key

```bash
cp .env.example .env
```

Open `.env` and replace `your_anthropic_api_key_here` with your key from [console.anthropic.com](https://console.anthropic.com).

The key stays on your machine. It is never sent anywhere except Anthropic's API when you run an agent.

---

## Step 3 — Fill in your inputs

Three files in `inputs/` — fill in the ones you need before running.

### `inputs/my-linkedin.md`
Copy your LinkedIn profile into this file. The easiest way:
- Go to your LinkedIn profile
- Click "More" → "Save to PDF" — this gives you a clean text dump
- Paste the relevant sections: Headline, About, Experience, Skills

You don't need contact info. The audit doesn't use it.

### `inputs/my-resume.md`
Paste your base resume in plain text. This is your master resume — everything you've done, not tailored to any specific role. The `resume-tailor` agent does the tailoring.

### `inputs/job-description.md`
Paste the full job description for the role you're targeting. The more complete, the better the output. Include: role title, company, responsibilities, requirements, preferred qualifications.

**One JD at a time.** If you're applying to multiple roles, run the agents once per JD. Keep a folder of your outputs — they're git-ignored and stay local.

---

## Step 4 — Run the preflight check

Before running any agent, verify your inputs are filled in:

```bash
npm run check
```

This catches blank files and template placeholders before you burn API tokens on them.

---

## Step 5 — Run your first agent

Start with the LinkedIn audit — it takes the least time and gives you the most immediate feedback:

```bash
npm run linkedin
```

Output lands in `outputs/linkedin-audit.md`.

Then tailor your resume to the JD:

```bash
npm run resume
```

Output lands in `outputs/resume-tailored.md` and `outputs/resume-gaps.md`.

Then write the cover letter:

```bash
npm run cover-letter
```

Output lands in `outputs/cover-letter.md`.

---

## The Right Order

For a new application, run in this sequence:

```
npm run linkedin      # Fix your profile first
npm run resume        # Tailor to the JD
npm run cover-letter  # Cover letter draws from the tailored resume
npm run interview     # Prep questions based on the tailored resume + JD
```

Each agent builds on the previous one. The cover letter agent will automatically pick up `outputs/resume-tailored.md` if it exists.

---

## What to Do With the Output

The outputs are markdown files. From there:

- **LinkedIn changes** — make them directly on LinkedIn before you apply anywhere. Your profile should match your resume.
- **Resume** — copy into your preferred format (Word, Google Docs, a template). Don't submit a markdown file.
- **Cover letter** — paste into your email or application form. Read it out loud before sending. If any sentence sounds like a bot wrote it, rewrite it.

---

## A Note on Tailoring

The agents will not invent experience you don't have. They translate what's real into the language of the role. If there's a gap between what the JD asks for and what you've done, it will show up in `outputs/resume-gaps.md` — those are things to address directly in interviews, not paper over in the resume.

Specific beats polished. A resume with real numbers that are slightly rough beats a beautifully formatted resume with vague claims every time.

---

## Questions or Issues

Open an issue at [github.com/owlguardco/job-hunter](https://github.com/owlguardco/job-hunter/issues).

---

## Advanced Path — LinkedIn Auto-Scrape (technical users)

Skip the copy-paste step entirely. This path scrapes your LinkedIn profile
directly from a URL using a local MCP server, then runs the audit automatically.

**Extra requirements:** Python 3.8+, `uv` package manager, Chrome or Chromium

### Setup (one time)

**1. Install `uv`**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**2. Log into LinkedIn through the scraper**
```bash
uvx linkedin-scraper-mcp@latest --login
```
A Chrome window opens. Log in normally. Once you see your LinkedIn feed, close
the window. Your session is saved locally in `~/.linkedin-mcp/profile/`.

**3. Add your LinkedIn URL**

Create/edit `inputs/linkedin-url.txt` and paste your profile URL:
```
https://www.linkedin.com/in/yourname/
```

### Running

```bash
npm run linkedin-scrape
```

This does everything in one shot:
1. Starts the local MCP server
2. Scrapes your profile from LinkedIn
3. Formats it into `inputs/my-linkedin.md`
4. Runs the full audit if a job description is present
5. Shuts down the MCP server

Output lands in `outputs/linkedin-audit.md` as usual.

### Re-authentication

LinkedIn sessions expire. If you get a login error:
```bash
uvx linkedin-scraper-mcp@latest --login
```
Then re-run `npm run linkedin-scrape`.

### Privacy

Your LinkedIn credentials are stored only in `~/.linkedin-mcp/profile/` on your
machine — the same way Chrome stores any browser session. Nothing goes through
a third-party service. The scraper runs Chrome locally.

### Source

MCP server: [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server)
