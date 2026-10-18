# Apply 01-results-history patch (Results history filters)

## Pre-check (done, read-only)
- `src/lib/results.functions.ts` and `src/routes/results.tsx` current SHA-256 match `before_sha256` in verification.json exactly; `results-query.ts` and the three test files do not exist yet (before = null). No later edits to port by hand — patch applies as-is on the current UI.

## Steps
1. `git apply --check` the patch, then apply it touching only the six listed files. Confirm resulting SHA-256 of each equals `after_sha256`.
2. Confirm protected files are byte-identical before/after (styles.css, MatchCard, LotteryModule, schedule, AppShell, index.tsx), and that package.json / lockfile / DB are untouched.
3. Verify (no credentials, no .env reads, no seeding/migration):
   - `bunx vitest run src/test/results-functions.test.ts src/test/results-page.test.tsx src/test/results-query.test.ts`, plus the full suite excluding `identity-approvals.integration.test.ts`.
   - `tsgo` typecheck and production build check via build log.
   - Playwright at 1280 and 390: six controls visible; filter combos (Period/History, source, Event, team, From/To boundaries) change results; pagination last page matches total; changing a filter returns to page 1; empty/error/retry states; unknown scores show TBD; no horizontal overflow; green score bars still present.
   - Regression spot-check: home 50/50 block, in-card Full schedule, schedule yellow stars and pending cards; Coach invert via existing mock method (no coach session available).
4. Report per acceptance item: passed / failed / not verifiable (e.g. live DB/RLS, real coach/family sessions), with actual test counts from this run only.
5. Stop after reporting; apply 02-next-match.patch only when you send it.

## Out of scope
No GitHub connect/disconnect, no publishing, no styling, schema, dependency, or other-page changes.
