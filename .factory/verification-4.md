# Independent product verification 4 — FAIL

Date: 2026-08-28  
Work order: `kindred-coop-verify-4`  
Candidate: `d042a5c00975b3eb6577f65c745e9bbb78e98975`  
Live target: <https://kindred-coop.sociobot.in>

## Release decision

**FAIL — do not release.** The candidate frontend and the live backend build identity both match the candidate, and the repaired paid-entitlement and accessibility paths pass locally. However, a new two-browser live test reproduced a deployment-only P0: guest joins receive HTTP 200 and then their WebSocket upgrade receives HTTP 404, leaving the guest permanently at “Finding the other lantern…”. The required rate-limit response also omits its mandatory `Retry-After` header.

## Blocking defects

### P0 — live invite links can join but cannot open the game

Fresh host and guest Chromium contexts were used at desktop and 390 px mobile. The host successfully created a room; the guest `POST /join` returned 200 and was redirected to `?room=<code>`, but the guest never received a room state. Two independently created rooms reproduced it:

| Room | Join API | WebSocket result |
| --- | --- | --- |
| `40H89EQ` | 200 | no room screen after two seconds |
| `Z00ODK0` | 200 | HTTP 404 during WebSocket handshake |

The second attempt's browser evidence was:

```text
WebSocket connection to wss://kindred-coop.sociobot.in/api/sessions/Z00ODK0/ws?role=guest&key=… failed: Error during WebSocket handshake: Unexpected response code: 404
```

The rendered guest screen stayed on “Finding the other lantern… / Connecting…”. This prevents the parent and child from starting their core two-player game. The candidate keeps session state in an in-process `HashMap`; this behavior is consistent with HTTP and WebSocket requests reaching different live replicas or revisions. A previous handoff's single-replica assertion is not sufficient evidence while this fresh failure is reproducible.

### P1 — rate limiting lacks mandatory retry guidance and does not cover every endpoint

A live burst of 325 concurrent `POST /api/sessions` requests produced exactly `300 × 200` and `25 × 429`: the observed threshold is request 301 in the one-minute global window. Every 429 had `Retry-After: null` (header absent). The acceptance contract requires `429` **with** `Retry-After`.

Static route review also finds the limiter only on create and join. It is not applied to `/api/page-view`, `/{code}/unlock`, or WebSocket upgrades, and is a global in-process queue rather than keyed from the first `X-Forwarded-For` hop. This does not meet the stated every-server-endpoint, per-client contract.

## Verification evidence

Environment: Node 22.23.2 / npm 10.9.8, Rust/Cargo 1.98.0, Playwright 1.58.2 Chromium. The checkout began clean at the candidate SHA. `npm ci` installed 60 packages with 0 reported vulnerabilities.

| Area | Result | Evidence |
| --- | --- | --- |
| Unit tests | PASS | `npm test`: 3/3 Vitest. `cargo test --locked`: 10/10 Rust. |
| Checks | PASS | `npm run check`, `cargo fmt --all -- --check`, and strict `cargo clippy --all-targets --all-features --locked -- -D warnings` passed. |
| Exact builds | PASS | `npm run build` produced `dist/`; `BUILD_SHA=<candidate> cargo build --release --locked` passed. Docker/Podman is unavailable, so the image itself could not be assembled. Dockerfile review confirms multi-stage, non-root runtime, `PORT`, and `BUILD_SHA` use. |
| Authored end-to-end | PASS locally | `npm run test:e2e`: 5/5. Two isolated players completed all three puzzles against the deterministic billing verifier; fabricated, revoked, and unavailable cached license verdicts stopped at the paid lock; invalid-room, offline service-worker reload, mobile targets, and desktop keyboard paths passed. |
| Local entitlement | PASS | Rust and Playwright coverage confirmed browser-controlled `unlocked` is rejected, WebSocket `unlock` cannot unlock, and only a host plus valid verifier response unlocks paid puzzles. |
| Boundaries/recovery | PASS locally | 15, 30, and 60 minute room options are accepted; 10 minutes is rejected; malformed/unknown room recovery and offline shell reload passed. A room created before local restart returned 404 after restart, confirming the intentional in-memory session boundary. |
| Live core journey | **FAIL** | The two fresh guest failure cases above occurred after successful host create and 200 join. |
| Candidate/live equivalence | PASS | Live `/health` returned `{"build":"d042a5c00975b3eb6577f65c745e9bbb78e98975","status":"ok"}`. SHA-256 matched exactly for `index.html`, JS, CSS, `sw.js`, and manifest. |
| Accessibility | PASS where reachable | Local home, active host/guest, completion, mobile and desktop authored tests reported zero Axe serious/critical violations. Fresh live home at 390 px also reported zero serious/critical findings, one `h1`, `main`, `lang=en`, no overflow, and no errors. Keyboard testing locally confirmed the designed 3 px focus ring and skip-to-main behavior. The broken live guest room necessarily logs the WebSocket console error. |
| Responsive/motion | PASS | Local authored coverage exercised 1440×900 and 390×844. Fresh live 390 px had no horizontal overflow; a reduced-motion context computed `scroll-behavior: auto`. |
| Privacy/outbound | PASS with disclosed aggregate count | Fresh live home loaded only the product origin; source review found no third-party fonts, scripts, analytics SDKs, ads, accounts, or chat. It sends one `POST /api/page-view` aggregate daily counter; purchase validation goes only to Sociobot when a license is used. |
| Headers/caching | PASS | Live HTML/SW use `no-cache, must-revalidate`; API/health `no-store`; hashed assets immutable for one year. CSP, nosniff, no-referrer, DENY frame policy, HSTS, Permissions Policy, and HTTP→HTTPS redirect were present. |
| Bundle budget | PASS | JS 22,000 B / 8,163 B gzip; CSS 12,921 B / 3,775 B gzip; mobile hero 50,126 B. All are under the stated budgets. Lighthouse could not run in this container because the supplied Chromium tab crashes under Lighthouse; Playwright/aXe checks above completed. |
| Runtime configuration | PASS | The release binary started with only `PORT=8181`, returned the full candidate build SHA, and logged supplied/default provenance without secrets. |
| Sign-in | N/A | No sign-in is present or required. |

## Required remediation before re-verification

1. Make a created room and its WebSocket relay reliably routable as one unit: run a genuinely single live replica/revision, configure verified sticky routing for HTTP and WebSocket, or move ephemeral room state/broadcast to a shared store. Demonstrate repeated cross-context create → join → WebSocket state delivery after deployment.
2. Apply per-client rate limiting to every server-side endpoint, use the first `X-Forwarded-For` hop behind ingress, and return a numeric `Retry-After` on every 429. Re-run and record the burst threshold.

No product code was modified during verification. Only this report and the handoff were updated.
