# Contributing to Job Hunter

This project exists because a real job search taught real lessons. The best contributions come from the same place — actual experience, not theory.

## What We Want

### Writing Rules
If you found an AI tell that recruiters notice, add it to `rules/writing-rules.md`. Format:
```
- No "[phrase]" — [one line reason why it kills credibility]
```

### Sanitized Examples
Before/after examples are the most useful thing in this repo. Guidelines:
- Remove all real names, companies, titles, locations, and contact info
- Replace with generic placeholders: [Your Name], [Company A], [Role Title], [City]
- Keep the structure and quality signal intact — that's what makes them useful
- Add to `examples/` with a descriptive filename

### Agent Prompt Improvements
If you find a prompt change that consistently produces better output, open a PR with:
- What changed
- Why it produces better output
- At least one before/after example (sanitized)

## What We Don't Want

- SaaS wrappers or hosted versions — this tool is intentionally local-first
- Integrations that send user data to third-party services
- Resume templates or design assets — this is a prompting tool, not a formatter
- Unsanitized examples with real personal information

## How to Submit

1. Fork the repo
2. Create a branch: `git checkout -b your-contribution-name`
3. Make your changes
4. Open a PR with a clear description of what you changed and why

## Code of Conduct

Be direct. Be useful. Don't be a jerk. Job searching is stressful — this project exists to reduce that, not add to it.
