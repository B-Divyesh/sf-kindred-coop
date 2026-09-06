# Kindred Co-op review 2 — Play picture puzzles together

## Verdict

**PASS — zero findings and zero untested public claims.**

- Implementation candidate reviewed: `310691eea41475dac6c6ad054b62be27cd5b92cc`
- Documentation checkout reviewed: `ae30bc0157f6e7d4e65dd8bb13098866a91ff9eb`
- Live deployment identity: `22953a1d6a00af63420f8cc7f1bbc24be456da0c`
- Live URL: <https://kindred-coop.sociobot.in>

`310691e..ae30bc0` changes only factory reports and handoff text. The live
health endpoint reports `22953a1…`; a production frontend build made with that
SHA produced the same JavaScript and CSS names and SHA-256 values as live.
The live product is therefore the reviewed implementation with later
documentation-only commits.

## Job, audience, and first action

Before scrolling, fresh 1440×900 desktop and 390×844 phone browsers stated:

- Job: **Play picture puzzles together**.
- Audience: a parent and child playing apart.
- First action: **Try it with sample data**.

The action was visible in the initial viewport on both sizes. Both initial
loads had no console or page errors and no horizontal overflow. Screenshots
are in `/work/.evidence/review-2-live/`.

## Clean setup and claims

From a fresh clone at `ae30bc0`, with no initial `dist/`, the documented
commands passed: `npm ci`, `npm test` (3/3), `cargo test --locked` (15/15
before the frontend build), `npm run check`, rustfmt check, strict Clippy,
`npm run build`, and `npm run test:e2e` (12/12). The production build is
27.97 KB JavaScript (9.38 KB gzip) and 15.25 KB CSS (4.29 KB gzip).

Every exact command in `.factory/claims.json` passed individually from that
clean checkout. The temporary-room command's two named Rust tests also passed.
No public product claim in the landing page, legal pages, or README lacked the
claims contract.

| Claim | Result |
| --- | --- |
| `sample-demo` | PASS |
| `private-play` | PASS |
| `offline-instructions` | PASS |
| `full-game` | PASS |
| `paid-license` | PASS |
| `temporary-rooms` | PASS, including room-key isolation and restart removal |
| `rate-limit` | PASS |

## Live product review

- Direct `/demo` opened with two of four shapes matched and the persistent
  **Demo — sample data, nothing is saved** label. A wrong match showed useful
  recovery text. Reset restored the populated sample state. Seeded real
  license and room sentinels stayed unchanged, and the sample made no room
  request. A separate normal demo load made only same-origin requests and had
  no errors.
- A fresh desktop host and fresh phone guest created and joined one live room,
  connected, completed Moon, Leaf, Star, and Ripple, and reached the expected
  paid boundary: the host saw the $8 two-puzzle option and the guest saw
  **Waiting for the host**. No console or page error occurred in the flow.
- Live room creation accepted 15, 30, and 60 minute durations with matching
  returned expiry times. A 10-minute request returned HTTP 400 with
  `Choose a 15, 30, or 60 minute room.` An unknown invite recovered with
  `That room was not found. Ask the host for a fresh link.`
- In a dedicated service-worker browser context, `/demo` reloaded offline
  after its first visit. Leaving the sample showed the explicit Offline state
  for real play. Keyboard Tab reached **Skip to game** and Enter moved focus
  to `main`. Phone and demo Axe scans found zero serious or critical issues;
  the completed phone room had no horizontal overflow.
- `/`, `/demo`, `/privacy`, and `/terms` returned 200 with expected
  route-specific titles, one `h1`, and one `main`. The styled unknown route
  returned HTTP 404 as designed. Normal loads had `lang=en`, image alt text,
  no console errors, and no third-party requests.
- Live responses include CSP, HSTS, `nosniff`, no-referrer, frame denial, and
  Permissions Policy. A 45-request same-client burst returned exactly 40×200
  and 5×429, with `Retry-After: 1` on every limited response. Fifty health
  requests returned 200.

## Earlier findings

| Earlier finding | Current disposition |
| --- | --- |
| Intermittent guest WebSocket 404 / unreachable live rooms | Closed: fresh desktop-host and phone-guest room completed the free puzzle. |
| Browser-controlled paid access | Closed: the clean paid-license claim rejects forged, revoked, and unavailable verdicts; live play stayed locked after the free puzzle. |
| Missing live build identity | Closed: `/health` reports the live SHA and rebuilt assets byte-match live. |
| Missing shell cache policy and response hardening | Closed: reviewed live cache and security headers are present. |
| Unnamed active progress, small targets, and mobile accessibility gaps | Closed: full-game checks, keyboard review, mobile overflow checks, and Axe scans pass. |
| Rate limiting missed `Retry-After` | Closed: live allowance was exactly 40/5 and every 429 carried `Retry-After: 1`. |
| Missing claims contract and one-click isolated sample | Closed: seven claim commands pass, and `/demo` is populated, labelled, isolated, and resettable. |
| Clean README command order failed before the frontend build | Closed: a fresh clone passed Rust tests before `npm run build`. |

## External dependency

The Sociobot checkout registration URL returns HTTP 404. This is the documented
external billing-registration dependency, not a broken product route: checkout
success is not claimed, paid puzzles remain server-gated, and the free game and
isolated sample work without it.

## Evidence

Clean checkout: `/tmp/kindred-coop-review-2.S0E5oR/src`.
Live screenshots: `/work/.evidence/review-2-live/`.
Required QA copy: `/work/.evidence/qa-report.md`.
