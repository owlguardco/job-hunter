# Security Policy

## Scope

Job Hunter is a client-side tool. It runs entirely in the user's browser or on their local machine. There is no server, no database, and no data transmitted to the project maintainers.

**What this means:**
- API keys are stored in the user's browser `localStorage` only
- All requests go directly from the user's browser to Anthropic's API
- The project maintainers never see user data, resumes, job descriptions, or API keys
- The CLI agents run locally on the user's machine via Claude Code

## Reporting a Vulnerability

If you find a security issue — particularly anything that could expose user API keys, enable data interception, or create a supply chain risk — please report it responsibly before disclosing publicly.

**Report to:** open a private GitHub Security Advisory at:
https://github.com/owlguardco/job-hunter/security/advisories/new

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix if you have one

**What to expect:**
- Acknowledgment within 48 hours
- Assessment and response within 7 days
- Credit in the fix commit if you want it

## What Counts as a Vulnerability

**In scope:**
- Anything that could expose a user's Anthropic API key to a third party
- XSS or injection vulnerabilities in the web UI
- Prompt injection attacks that could cause the agents to exfiltrate user data
- Malicious dependencies introduced via supply chain

**Out of scope:**
- Anthropic API rate limits or pricing (not our infrastructure)
- LinkedIn scraper behavior (third-party tool — report to stickerdaniel/linkedin-mcp-server)
- Issues that require physical access to the user's machine
- Social engineering attacks against users

## Security Notes for Users

- **LinkedIn scraper session:** The advanced LinkedIn scraper stores a Chrome session at `~/.linkedin-mcp/profile/`. This contains your LinkedIn login credentials. Protect it: `chmod 700 ~/.linkedin-mcp`. Do not run on shared machines. To revoke: delete the directory and sign out of LinkedIn.
- **API key:** Your Anthropic API key is stored in your browser's `localStorage`. It is not encrypted at rest. Do not use Job Hunter on a shared or public computer.
- **Local CLI:** The Claude Code agents run with the permissions of your local user account. Review any agent file before running it, especially if you cloned from a fork.
- **LinkedIn scraper:** The advanced LinkedIn scraper stores a Chrome browser session in `~/.linkedin-mcp/profile/`. This contains your LinkedIn login session. Protect that directory accordingly.
- **Outputs:** Your resume, job descriptions, and generated content are saved to your local `outputs/` directory. This folder is git-ignored and never leaves your machine.
