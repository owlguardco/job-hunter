# Scripts

Helper scripts used by the npm run commands.

## preflight.js

Runs before any agent to validate inputs are filled in. Prevents burning
API tokens on blank or template files.

```bash
node scripts/preflight.js all           # check everything
node scripts/preflight.js resume        # check resume + JD only
node scripts/preflight.js linkedin      # check LinkedIn inputs only
node scripts/preflight.js interview     # check interview inputs only
```

Called automatically by `npm run [tool]` — you don't need to run it manually.

## job-search.py

Searches Indeed, LinkedIn, and Glassdoor using JobSpy and saves results
to `outputs/job-shortlist.md`.

**Requires Python 3.10+ and JobSpy:**
```bash
pip3.11 install jobspy
```

**Run directly:**
```bash
python3.11 scripts/job-search.py
```

**Or via npm:**
```bash
npm run jobs
```

Fill in `inputs/job-search-criteria.md` before running — that's where your
role titles, location, and filters live.

**Note on LinkedIn scraping:** LinkedIn rate-limits scrapers aggressively.
If LinkedIn results come back empty, Indeed and Glassdoor results will still
be returned. This is normal behavior, not a bug.
