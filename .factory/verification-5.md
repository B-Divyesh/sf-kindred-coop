# Independent product verification 5 — FAIL

Date: 2026-08-28  
Work order: `kindred-coop-verify-5`  
Candidate and tested checkout: `b787a609fb645e462f6c454cd9867cfa3be7968f`  
Live target: <https://kindred-coop.sociobot.in>

## Release decision

**FAIL — do not release this candidate.** Fresh evidence shows that the earlier deployment-only relay and rate-limit defects are repaired: the live deployment is this exact candidate and a fresh desktop-host/390 px-guest journey joined, synchronized, and completed the free puzzle. However, two explicit acceptance gates fail before implementation quality can make the candidate releasable:

1. `.factory/claims.json` is absent from the clean checkout. The work order explicitly makes a missing claims file release-blocking, so no claim tests could be run through the product demo entry point.
2. The cold live page has no one-click **“try it with sample data”** demo. Its available first actions are `Light a room`, `See the 3 controls`, `Create invite link`, and `Join room`; `Light a room` only scrolls to real room creation. The work order explicitly makes absence of this demo a FAIL.

## Blocking defects

### P0 — required claims contract is missing

`find .factory -maxdepth 1 -name claims.json` produced no file in the clean candidate. This prevented the mandated first action, “run every test listed in `.factory/claims.json` … via the product's demo entry point.” The acceptance contract says a missing file is release-blocking.

### P0 — no one-click sample-data demo

Cold live first read did communicate the product in plain language: it is a small remote co-op picture-signal game, for “a parent and child” playing apart, and the primary next action is `Light a room` / `Create invite link`. It does **not** provide a one-click way to try the game with supplied sample data. The only available route creates an actual room and requires a second player. This fails the stated demo-sandbox gate.

## Evidence and results

Environment: clean checkout at the candidate SHA; Node 22.23.2, npm 10.9.8, Rust/Cargo 1.98.0, Playwright 1.58.2 Chromium. `npm ci` installed 60 packages and reported 0 vulnerabilities. No product code was changed during verification.

| Area | Result | Evidence |
| --- | --- | --- |
| Claims prerequisite | **FAIL** | `.factory/claims.json` is absent. No claim list exists to execute. |
| Cold first read | **FAIL** | Live copy clearly says “A parent and child guide each other through three gentle picture puzzles”; `Light a room` is the evident first click, but no one-click sample/demo action exists. |
| Unit/integration | PASS | `npm test`: 3/3 Vitest. `cargo test --locked`: 12/12 Rust route/session tests. |
| Type/lint | PASS | `npm run check`, `cargo fmt --all -- --check`, and `cargo clippy --all-targets --all-features --locked -- -D warnings` passed. |
| Production build/runtime | PASS | `npm run build` produced `dist/`; `BUILD_SHA=b787a609… cargo build --release --locked` passed. With an otherwise empty environment (`env -i PORT=8181`), the release binary served `/health` as `{"build":"b787a609…","status":"ok"}` and logged supplied/default configuration provenance without secrets. Docker/Podman are not installed in this worker, so the image itself could not be assembled. |
| Authored end-to-end | PASS locally | `npm run test:e2e`: 5 Playwright scenarios passed: two isolated players finish all three puzzles against the mock Sociobot verifier; forged/revoked/unavailable entitlement caches remain locked; invalid room/offline reload, mobile targets, and desktop keyboard paths are covered. |
| Fresh live core journey | PASS | A fresh 1440×900 host created room `EDFZ3VE`; a fresh 390×844 guest joined via its invite link; both WebSockets reported `Together`; host and guest solved Moon/Leaf/Star/Ripple; the host then reached the correct free-game lock. No console or page errors occurred. This specifically does **not** reproduce verification 4’s live guest WebSocket 404. |
| Boundary/recovery | PASS | Live `POST /api/sessions` with `{"expiryMinutes":10}` returned 400 and “Choose a 15, 30, or 60 minute room.” Live unknown-room join returned 404 and a recovery message. Local E2E covers the 15/30/60 valid values and offline reload. |
| Candidate/live equivalence | PASS | Live `/health` returned the exact candidate SHA. SHA-256 matched exactly for locally rebuilt/live `index.html`, JS (`fc5325…a043fe`), and CSS (`b76506…e40daef`). |
| Accessibility | PASS where exercised | Playwright Axe scans of fresh live home at desktop and 390 px reported zero serious/critical violations (indeed zero violations). Both had `lang=en`, exactly one `h1`, one `main`, no horizontal overflow, and no unanticipated console/page errors. Keyboard Tab gave the skip link a visible `rgb(200, 67, 47) solid 3px` outline; local E2E covers Enter, arrows, active-room Axe, and 44 px navigation targets. Reduced-motion context computed `scroll-behavior: auto`. |
| PWA | PASS for offline; update mechanism inspected | On live, the service worker controlled the page and an offline reload returned the cached shell plus useful “server is out of reach” recovery. `sw.js` has a versioned cache, `skipWaiting`, `clients.claim`, and `updateViaCache: 'none'`. A revised-worker update could not be simulated without a second deployed worker revision. Expected 404/offline network console entries occurred only during the deliberate invalid-room/offline test. |
| Privacy/outbound | PASS | A cold live browser made requests only to `kindred-coop.sociobot.in` (HTML, local assets, and the disclosed aggregate `POST /api/page-view`); no third-party fonts, scripts, ads, trackers, accounts, or chat were observed. Source and `/privacy` describe only a daily aggregate view counter, local browser storage, in-memory temporary rooms, and Sociobot validation only when a license is supplied. No sign-in is used. |
| Headers/caching | PASS | Live HTML/SW use `no-cache, must-revalidate`; API/health use `no-store`; hashed assets are `public, max-age=31536000, immutable`. CSP, `nosniff`, no-referrer, frame denial, HSTS, and restrictive Permissions Policy were present. |
| Rate limiting | PASS | A 50-way live `POST /api/page-view` burst yielded 40×204 and 10×429. Every 429 carried `Retry-After: 1`; observed threshold was request 41 in the one-second per-client window. Candidate route tests also cover page view, create, join, unlock, WebSocket upgrade, fallback, first `X-Forwarded-For` hop, and `/health` exemption. |
| Performance budget | PASS, Lighthouse unavailable | Live first-load JS is 22,000 B / 8,163 B gzip, CSS 12,921 B / 3,775 B gzip, and mobile hero 50,126 B—well within 200 KB/50 KB/300 KB budgets. Lighthouse 13.4.1 was attempted against the local release server with the supplied Playwright Chromium but could not connect to that Chromium; no Lighthouse score is claimed. |

## Required remediation

1. Add a complete `.factory/claims.json` with runnable, product-facing claim tests and make them pass through the demo entry point.
2. Add a plainly labelled one-click “Try it with sample data” sandbox that lets a parent understand the host/guest signal loop without creating a real invite or requiring a second person. Keep it isolated from real rooms and privacy-minimal.

After those changes, rerun the claims first, then repeat the cold-read gate and ordinary regression suite. The repaired live relay/rate limit should remain covered by the existing tests.
