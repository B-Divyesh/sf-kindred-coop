# Independent product verification 3 — FAIL

Date: 2026-08-28  
Work order: `kindred-coop-verify-3`  
Candidate: `7a43b3e122aebe7b66f62c58b0ef092b84d23f52`  
Live target: <https://kindred-coop.sociobot.in>

## Release decision

**FAIL — do not release.** The core two-player game is currently reachable and
completed successfully in fresh live testing, including 10/10 room starts that
did not reproduce the earlier intermittent WebSocket failure. However, three
independent release blockers remain:

1. Paid puzzles can be unlocked from browser-controlled state without a valid
   license.
2. Every in-progress puzzle exposes an unnamed ARIA progressbar; Axe rates this
   `serious` on both desktop and mobile.
3. Live `/health` reports `build: "unknown"`, so the deployed backend cannot be
   attested to the candidate commit.

The live frontend is an exact byte-for-byte match for the candidate production
build. This does not establish the identity of the backend binary.

## Defects

### P1 — paid entitlement is trusted from the browser

The candidate backend accepts `unlocked: true` in `POST /api/sessions` and also
accepts a host WebSocket `{ "type": "unlock" }` message. Neither route verifies
a Sociobot license or a server-issued entitlement.

Fresh local API evidence confirmed both paths. Fresh live browser evidence was
stronger: a fabricated `sb_license_verdict:kindred-coop` local-storage value
with `valid: true` allowed a desktop host and mobile guest to complete all three
puzzles. The browser made no request to `api.sociobot.in` during that journey.
Thus anyone controlling their own browser state can unlock the paid game, and a
revoked license is not enforced server-side.

Expected: the server verifies or accepts a server-signed entitlement before it
marks a room unlocked. Client cache may improve first paint but must not be the
authority for paid access.

### P1 — active puzzle has an Axe-serious accessibility failure

Axe on the live and local in-progress room reports:

```text
aria-progressbar-name (serious)
ARIA progressbar nodes must have an accessible name
```

Affected node:

```html
<div class="progress-track" role="progressbar"
  aria-valuemin="0" aria-valuemax="4" aria-valuenow="0">
```

The home page, `/privacy`, `/terms`, onboarding dialog, and completed-room state
had zero Axe violations, but the screen used throughout actual play fails the
explicit serious/critical acceptance threshold.

### P1 — live backend build identity is unavailable

At `2026-08-28T05:54:24Z`, live `GET /health` returned:

```json
{"build":"unknown","status":"ok"}
```

The candidate release binary, compiled with the required build value, returned
the full candidate SHA locally. Deployment must pass the candidate build arg
and expose it from `/health` before backend equivalence can be confirmed.

### P2 — mobile touch targets do not meet the 44 px contract

At 390 px, visible undersized targets included:

| Target | Measured size |
| --- | ---: |
| Header “Play” | 28 × 15 px |
| Footer “Privacy” | 56.9 × 18 px |
| Footer “Terms” | 46.8 × 18 px |
| Footer “Help” | 34.7 × 18 px |
| Skip link | 125.4 × 42 px |

The main game controls were at least 44 px and were keyboard operable.

### P2 — response hardening and shell cache policy are incomplete

HTTPS responses include CSP, `nosniff`, `no-referrer`, and frame denial, and
plain HTTP redirects to HTTPS. They do not include `Strict-Transport-Security`
or `Permissions-Policy`. HTML, `sw.js`, and the manifest also have no explicit
`Cache-Control`; only hashed assets receive the intended one-year immutable
policy. The service-worker update test passed, but explicit no-cache/revalidate
policy for the shell and worker would make deployment updates deterministic.

## Clean checkout and build evidence

The candidate was checked out detached in a new worktree. `git status --short`
was empty before installation and after all verification.

Environment:

- Node `v22.23.2`, npm `10.9.8`
- Rust `1.98.0`, Cargo `1.98.0`
- Playwright `1.58.2`, bundled Chromium
- Lighthouse `13.0.1`

| Check | Result |
| --- | --- |
| `npm ci` | PASS; 60 packages, 0 vulnerabilities |
| `npm test` | PASS; 3/3 Vitest tests |
| `cargo test --locked` | PASS; 5/5 Rust tests |
| `npm run check` | PASS; TypeScript no-emit and `cargo check` |
| `cargo fmt --all -- --check` | PASS |
| `cargo clippy --all-targets --all-features --locked -- -D warnings` | PASS |
| `npm run build` | PASS; emitted `dist/` |
| `BUILD_SHA=<candidate> cargo build --release --locked` | PASS; 7.5 MB release binary |
| `npm run test:e2e` | PASS; 2/2 authored Playwright tests |

No Docker-compatible CLI is installed in the worker, so the multi-stage image
could not be assembled. The exact locked frontend and Rust release stages were
run directly. Static inspection confirms `.git` is excluded, the image is
multi-stage, the runtime user is non-root UID 10001, and port 8080 is exposed.
The release binary also started successfully with no application-specific
configuration other than `PORT`.

## Functional and backend verification

### Local candidate

- Accepted the supported 15, 30, and 60 minute boundaries; generated 7-character
  room codes and distinct 32-character role keys.
- Rejected missing, zero, 10, 61, negative, string, and malformed expiry input
  with 400/422 responses and rejected malformed/unknown invite codes.
- Allowed the same guest key to reconnect; rejected an unkeyed third seat with
  409.
- Completed the free puzzle, handled a wrong answer by resetting progress and
  incrementing “Fresh starts,” then exposed the intended paid lock.
- Ignored invalid signal values, invalid JSON messages, guest attempts to use
  host controls, and an invalid 14-minute extension.
- Accepted host extension/end controls; end produced the expired-room state.
- Confirmed the two entitlement failures described above.
- `100/100` concurrent health requests returned 200 in 155 ms.
- `305` concurrent room creates returned `300 × 200` and `5 × 429` in 426 ms,
  confirming the documented global request limit.
- After restart, a room created before shutdown returned 404. SQLite retained
  only the `page_views(day, count)` table and the three test increments. This
  confirms the claimed room-memory and aggregate-persistence boundaries.

### Live target

- `10/10` isolated 390 × 844 host attempts created a room and opened the first
  puzzle; there were no console/page errors. The earlier 4/6 WebSocket failure
  is not reproducible in this fresh run.
- A 1440 × 900 host and 390 × 844 guest joined the same room and completed all
  three puzzles. Puzzle two was operated with guest Arrow keys.
- `100/100` concurrent live health checks returned 200 in 383 ms.
- Short invite input was stopped by native validation; an unknown seven-character
  room produced the useful “not found” recovery message.
- An invalid license return token was removed from the URL, stored locally,
  verified once through Sociobot, and shown as inactive. The verify response was
  200 with `valid: false`.

## Deployment identity and asset match

Candidate and live SHA-256 values were identical:

| Resource | SHA-256 |
| --- | --- |
| `index.html` | `8be8f17168a50dbc6773f12e7db6ce4334c40851157ececb72b5f1051ca147cf` |
| `index-BuZ4bJTw.js` | `ad1c008a0b5b722b482dfca8db20d1fcc0678b25cee0dc20acc7ae76ba398b45` |
| `index-BDG8xjSM.css` | `50b11a2824c7fc665acaa0d3c2296a40d09cb76d630aa38e743b96be25a76aaa` |
| `sw.js` | `5f7327fa22803feb1f6e424b885eb9ec8c8495d7e4f6a3e8d7279883afb3dda0` |
| `manifest.webmanifest` | `c0cc316f15b01aecdcb7d3fbd98b09cceb74ebe538eb04f24251e19aa2ba1e87` |

Frontend match: **confirmed**. Backend match: **not confirmable** because live
health identity is `unknown`.

## Accessibility, responsive behavior, and visual review

- Tested at 1440 × 900 and 390 × 844; no horizontal overflow in the active game.
- One `<h1>`, one `<main>`, `lang="en"`, page-specific titles, skip link, form
  labels, meaningful hero alt text, and logical native controls were present.
- Keyboard-only room creation passed. The focus indicator computed to a visible
  3 px tomato outline. The onboarding dialog focused its close button, trapped
  modal interaction natively, closed with Escape, and restored its opener.
- Reduced-motion emulation matched; scroll behavior became `auto`, and animation
  and transition durations became `0.01ms`.
- 200% root text scaling produced no horizontal overflow at 390 px.
- Home, privacy, terms, onboarding dialog, and final room: zero Axe violations.
  Active room: one serious violation, documented above.
- Visual inspection found the field-guide design coherent and readable on both
  viewport sizes, with clear primary actions and no clipping or overlap.

## PWA, privacy, network, and policy checks

- Chromium reported no manifest or installability errors.
- The versioned cache contained `/`, the hashed JS/CSS, mobile hero, icon, and
  manifest. Offline reload worked for the home page and live `/terms`; local
  `/privacy` also worked offline.
- Reinstall/update removed a seeded old cache and left only
  `kindred-shell-v1`; an active controller remained after `registration.update()`.
- A normal first load and the fabricated cached-license journey contacted only
  `kindred-coop.sociobot.in`. Invalid-license recovery additionally contacted
  only `api.sociobot.in`, as disclosed. No third-party runtime scripts, fonts,
  analytics, ads, cookies, or beacons were observed.
- Static review found only the documented local/session storage keys, the daily
  aggregate page count, and in-memory room state. No account, open chat, or
  behavioral event collection exists.
- `/privacy` and `/terms` returned 200 and explain device storage, room expiry,
  parent responsibility, merchant handling, and refunds.
- The checkout URL is the required Sociobot URL. No real purchase was made.

## Performance and caching

- JS: 21,486 B (7,990 B gzip), under 200 KB.
- CSS: 12,767 B (3,750 B gzip), under 50 KB.
- Mobile hero: 50,126 B, under 300 KB. No font downloads.
- Live Lighthouse mobile: Performance 99, Accessibility 100, Best Practices
  100, SEO 100; FCP 1.0 s, LCP 1.2 s, TBT 130 ms, CLS 0, Speed Index 1.0 s.
- Lighthouse transferred 86,917 bytes over 8 requests and found no console
  errors on the home load.
- Hashed assets return `Cache-Control: public, max-age=31536000, immutable`.
  Shell/worker cache gaps are recorded above.

## Required remediation

1. Enforce paid entitlement on the backend; remove trust in client-provided
   `unlocked` state and unauthenticated `unlock` messages.
2. Give the active progressbar an accessible name and rerun Axe on every game
   state, not only home/completion.
3. Deploy with the exact `BUILD_SHA` and verify `/health` reports the candidate.
4. Increase all mobile interactive target boxes to at least 44 × 44 px.
5. Add HSTS/Permissions Policy and explicit shell/service-worker cache policy.

No product code was changed during verification.
