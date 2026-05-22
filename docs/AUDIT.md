# Repo Audit Report

**Date:** May 21, 2026
**Version:** v1.2.0
**Branches audited:** main, commercial

---

## ✅ What's clean

### Open source (main)
- No secrets or tokens in any tracked file
- All agent files have `## ✅ What to do next` sections
- All input file references in agents resolve to actual files
- `.env` and `commercial/.env` both git-ignored
- `outputs/` git-ignored (only `outputs/README.md` is tracked)
- MIT license present
- Security policy (`docs/SECURITY.md`) present
- All npm scripts reference existing agent files

### Commercial server
- 13 API routes all require `userId` auth check
- All database queries use parameterized statements (no SQL injection risk)
- Stripe webhook signature verified via HMAC (`verifyStripeWebhook`)
- Credit balance checked before every `/api/run` call
- All DB queries scoped to `user_id` (no cross-user data access)
- `commercial/.env` gitignored, `commercial/.env.example` has only placeholders

---

## 🔧 Issues found and fixed (v1.2.0)

| Issue | Severity | Fixed |
|---|---|---|
| `agents/apply-linkedin-scrape.md` had doubled path `apply-apply-linkedin-url.txt` | Medium | ✓ |
| `agents/search-send-email.md` missing `What to do next` section | Low | ✓ |
| Clerk webhook had no replay attack protection | Medium | ✓ Added timestamp validation |
| No rate limiting on `/api/run` | Medium | ✓ 20 req/min per user |
| CORS set to `*` even in production | Low | ✓ Locked to `APP_URL` in production |

---

## ⚠️ Known gaps (not yet fixed — post-launch)

### Commercial server

**1. Rate limiter is in-memory**
Current rate limiter resets on server restart and doesn't work across multiple
server instances. Acceptable at launch scale. Replace with Redis-backed limiter
(e.g. `upstash/ratelimit`) before horizontal scaling.

**2. Clerk webhook signature not cryptographically verified**
Current implementation validates the timestamp only. Full Svix signature
verification requires the `svix` npm package. Add before launch:
```bash
npm install svix
```
Then verify with `wh.verify(payload, headers)`.
See: https://docs.svix.com/receiving/verifying-payloads/how

**3. No input sanitization on user-submitted content**
Resume and JD text is passed directly to the Anthropic API. No XSS risk
(outputs are text only, not rendered as HTML). Prompt injection is possible
but mitigated by the rules engine. Monitor for abuse patterns.

**4. Gmail MCP runs with user's full Gmail access**
The inbox scanner can read all of the user's Gmail, not just job-related emails.
This is documented in the Privacy Policy but could be tightened with a
more restricted OAuth scope when Clerk supports it.

**5. No audit log for admin actions**
No record of who did what when beyond the usage table. Sufficient for now.

**6. Session cleanup not automated**
Sessions older than 2 hours are logically expired but not deleted from Postgres.
Add a cleanup cron job or Railway scheduled task:
```sql
DELETE FROM sessions WHERE last_active < NOW() - INTERVAL '24 hours';
```

### Open source (main)

**7. `npm run jobs` requires Python 3.10+ but many Macs ship with 3.9**
Documented in `scripts/README.md` and `docs/ONBOARDING.md`. User must
install `python@3.11` via Homebrew. No code fix needed — documentation fix only.

**8. LinkedIn scraper session stored unencrypted**
`~/.linkedin-mcp/profile/` stores a Chrome session. Standard browser behavior
but worth noting. Documented in `agents/apply-linkedin-scrape.md` and `SECURITY.md`.

---

## Structure accuracy check

| Item | Expected | Actual | Status |
|---|---|---|---|
| Total agents | 23 | 23 | ✓ |
| apply-* agents | 8 | 8 | ✓ |
| search-* agents | 5 | 5 | ✓ |
| interview-* agents | 3 | 3 | ✓ |
| offer-* agents | 4 | 4 | ✓ |
| career-* agents | 3 | 3 | ✓ |
| npm scripts (main) | 23 | 26 | ✓ (guide+start+check) |
| DB tables (commercial) | 8 | 8 | ✓ |
| README diagrams accurate | — | — | ✓ |

---

## Recommended pre-launch checklist

- [ ] Install `svix` and implement full Clerk webhook signature verification
- [ ] Set `NODE_ENV=production` in Railway env vars
- [ ] Set `APP_URL` in Railway env vars (locks CORS)
- [ ] Add session cleanup scheduled task
- [ ] Test Stripe webhook end-to-end with Stripe CLI
- [ ] Rotate any tokens that appeared in conversation history
- [ ] Review Privacy Policy dates before first payment is taken

---

## Next audit

Run this before every major release:
```bash
# Agent count check
ls agents/*.md | grep -v README | wc -l

# No secrets in tracked files
git grep -l "ghp_\|sk-ant-api\|vcp_" -- '*.md' '*.js' '*.json'

# All agents have next-steps
for f in agents/*.md; do grep -q "What to do next" "$f" || echo "MISSING: $f"; done

# No broken input paths
for f in agents/*.md; do
  grep -o 'inputs/[a-z_-]*\.[a-z]*' "$f" | while read inp; do
    [ -f "$inp" ] || echo "MISSING: $inp in $f"
  done
done
```
