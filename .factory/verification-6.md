# Independent repair verification 6 — PASS

## Release decision

**PASS.** The two P0 findings from verification 5 are fixed. The deployed
implementation is `baa33498e4bb43dea2c3fe7e4b45be6249069236`; the claims and
test contract is `266f5ad3b76c421c1e716f87a1a2e901c703444f`. The latter changes
tests and documentation only, so the product image correctly remains on the
implementation SHA.

Live target: <https://kindred-coop.sociobot.in>

## P0 disposition

### Required claims contract — fixed

`.factory/claims.json` contains seven public claims. Every claim has exactly
one `@claim:<id>` test and an executable clean command. A fresh clone of
`266f5ad` ran `npm ci`, then every declared command separately. All passed.

### One-click sample — fixed

**Try it with sample data** is visible on the first phone and desktop screen.
It opens `/demo` in one click with Moon and Leaf already matched and Star ready
to match. The persistent banner names sample mode and offers reset and exit.
Fresh live checks completed an invalid-match recovery, reset, and the full
sample. A separate real license value and real room value remained unchanged.
The clean home-to-demo flow made no API or third-party request and set no
cookie.

## Verification results

| Area | Result and evidence |
| --- | --- |
| Clean setup | PASS — a separate local clone at `266f5ad` completed `npm ci` with 60 packages and 0 vulnerabilities. |
| Declared claims | PASS — all seven exact commands passed independently. |
| Unit/integration | PASS — Vitest 3/3 and Rust 15/15. |
| Static checks | PASS — TypeScript/Cargo check, rustfmt, and strict Clippy. |
| Production build | PASS — `dist/` produced; exact-SHA release binary built and started with only `PORT`. |
| Browser suite | PASS — Playwright 1.58.2 Chromium 12/12. |
| Sample sandbox | PASS — populated output, wrong-input recovery, reset, completion, persistent label, direct entry, and separate storage namespace. |
| Real data isolation | PASS — demo left license and room sentinels unchanged and issued no room or analytics API request. |
| Normal co-op path | PASS — fresh live desktop host and phone guest connected, completed the free puzzle, and reached the paid boundary. |
| Invalid/boundary/recovery | PASS — bad invite, 15/30/60 minute choices, cross-room key rejection, host end, restart loss, offline state, and sample recovery are covered. |
| Paid entitlement | PASS — recorded valid verifier enables three puzzles; fabricated, revoked, and unavailable verdicts remain locked. Live checkout registration is separately unavailable. |
| Accessibility | PASS — semantic checks, focus/keyboard, 44 px mobile targets, reduced motion, and live/local Axe with 0 serious/critical issues. |
| Routes/legal | PASS — unique titles and one h1 for home, demo, privacy, and terms; designed unknown route returns expected HTTP 404. |
| Privacy | PASS — no analytics request, cookies, external font/script, ad, account, or chat; Sociobot is contacted only when a license is supplied. |
| Offline/update | PASS — a fresh live context installed the worker, reloaded `/demo` offline, opened cached home, and reported live play offline. |
| Rate limiting | PASS — live 45-way burst returned 40×200 and 5×429 with `Retry-After: 1`; 50 health checks stayed available. |
| Runtime policy | PASS — security and cache headers present; one replica; durable `/data` mount preserved. |
| Bundle/performance | PASS — JS 28.00 KB / 9.42 KB gzip; CSS 15.25 KB / 4.29 KB gzip; mobile hero 50,126 B. Lighthouse 100/100/100/100, LCP 1.50 s, CLS 0, TBT 0 ms. |
| Candidate/live match | PASS — `/health` returns `baa3349…`; local/live SHA-256 values match for HTML, JS, and CSS. |

## Deployment evidence

- Revision: `sf-kindred-coop--0000011`
- Image:
  `sociobotregistry.azurecr.io/sf-kindred-coop@sha256:467ccfc81d9e664c0eabd5129425348f94c3adf1c7ea782144bda525a938715b`
- `latestRevisionName` equals `latestReadyRevisionName`.
- `minReplicas=1`, `maxReplicas=1`.
- Existing `sf-kindred-coop-data` remains mounted at `/data`.
- Standard URL verification: HTTP 200, correct title/lang/h1/main/alt, and no
  console error. Its one unlabeled-button count is a hidden license form
  control; Axe excludes it while hidden and finds no violation.

## Historical findings

The intermittent live relay, missing `Retry-After`, browser-trusted paid
access, active-puzzle progress label, build identity, mobile target sizing,
and response-hardening findings from verifications 1, 3, and 4 remain fixed.
This run directly rechecked the live relay, rate policy, paid boundaries,
identity, targets, active UI accessibility, and headers.

## Remaining external dependency

`GET https://api.sociobot.in/api/v1/products/kindred-coop/checkout` returns
404. Billing registration is handled by the separate operator. The exact $8
one-time offer is preserved and written to
`/work/.evidence/billing-offer.json`; no checkout or entitlement success is
claimed. The free game remains usable.

There is no remaining release-blocking product defect.
