# Independent verification — FAIL

Date: 2026-08-28
Candidate: `7a43b3e122aebe7b66f62c58b0ef092b84d23f52`
Target: <https://kindred-coop.sociobot.in>

## Release decision

**FAIL — do not release.** The live core journey is not reliable: four of six
fresh host-room attempts received a WebSocket HTTP 404 immediately after a
successful room creation and could not open the first puzzle.

The deployed HTML has the exact candidate frontend asset names
`index-BuZ4bJTw.js` and `index-BDG8xjSM.css`; the local candidate production
build generated the same names and content lengths. The deployed backend cannot
be attested to the candidate: `/health` returns
`{"build":"unknown","status":"ok"}`, not the requested SHA.

## Blocking defects

### P0 — live rooms intermittently cannot connect

Fresh Chromium tests at 390 x 844 created six valid 15-minute rooms against
the live URL. Two opened; four remained on the loading page. Each failed case
logged:

```
WebSocket connection to wss://kindred-coop.sociobot.in/api/sessions/<code>/ws?... failed:
Error during WebSocket handshake: Unexpected response code: 404
```

The POST create endpoint had already returned a valid room and host key. The
failure rate was 4/6 (attempts 2, 3, 4, and 6), so a parent and child cannot
depend on starting a game. This is consistent with the candidate's in-memory
room map being served by more than one replica without affinity or shared
ephemeral session storage.

### P1 — paid puzzles can be unlocked without a license

The server accepts a browser-controlled `unlocked` boolean in
`POST /api/sessions` and uses it as the room entitlement. Fresh local evidence:
`POST {"expiryMinutes":15,"unlocked":true}` returned 200 with a host room
credential without Sociobot verification. Separately, the WebSocket handler
accepts a host `{ "type": "unlock" }` message and turns on the same flag
without license proof. A caller can thus unlock all paid puzzles without
purchase, defeating the stated $8 one-time unlock and revocation behavior.

### P1 — deployment build identity is absent

Live `GET /health` returns `build: "unknown"`, not the candidate SHA. This
prevents verification of the deployed backend and fails the health/build
identity contract. Frontend asset names do match the candidate production
build, but do not identify the backend binary.

## Checks and evidence

| Area | Result | Evidence |
| --- | --- | --- |
| Clean candidate | PASS | Clean `main` checkout at the candidate SHA; `npm ci` completed with 0 vulnerabilities. |
| Type / compile checks | PASS | `npm run check`: TypeScript no-emit and `cargo check` passed. |
| Unit / integration tests | PASS | `npm test`: 3/3 Vitest; `cargo test`: 5/5 Rust. |
| Production builds | PASS, native stages | `npm run build` produced `dist/`; `cargo build --release --locked` passed. Docker CLI is unavailable, so the multi-stage image was not executed. |
| Authored E2E / PWA | PASS locally | `npm run test:e2e`: 2/2. Two isolated 390 x 844 contexts completed all three puzzles; invalid room and service-worker offline reload passed. Static SW update path uses `skipWaiting`, `clients.claim`, and named cache; live `/sw.js` is 200. |
| Normal / boundary / invalid API | PASS locally, except entitlement | Invalid 10-minute create returned 400; valid 15-minute create returned 200; 100 concurrent `/health` requests were all 200; 305 concurrent creates yielded 300 x 200 and 5 x 429. |
| Live core room path | FAIL | Six fresh mobile host creates: 2 open, 4 WebSocket 404 / loading-timeout failures. |
| Browser / a11y | PASS on reachable live home; local room passed | Live home at 390 px: zero Axe serious/critical findings, no page or console errors, no horizontal overflow. Keyboard Tab produced a visible 3 px focus ring. Local authored E2E also found zero serious/critical Axe findings on home and completed room. |
| Responsive / reduced motion | PASS | Desktop 1440 x 900 and mobile 390 x 844 exercised. Live reduced-motion context computed `scroll-behavior: auto`; CSS reduces animation and transition duration. |
| Privacy / outbound activity | PASS with stated aggregate counter | Static review finds no third-party runtime script/font/asset. Live first-load browser recorded only `https://kindred-coop.sociobot.in`; billing is only reached after license use. Server schema has only aggregate daily `page_views`; room state is in memory. |
| Headers / caching | PARTIAL | Live responses include CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `X-Frame-Options: DENY`. Hashed JS has `Cache-Control: public, max-age=31536000, immutable`. HTML, manifest, and SW have no explicit Cache-Control; health identity fails as above. |
| Bundle budget | PASS | JS 21,486 B (7,990 B gzip), CSS 12,767 B (3,750 B gzip), mobile hero 50,126 B: all within budget. |
| Legal / semantics | PASS | `/privacy` and `/terms` return 200; document has lang, title, one h1 per rendered screen, main, skip link, and meaningful hero alt text. |

## Required remediation before re-verification

1. Use one backend replica, sticky HTTP/WebSocket routing, or shared room state
   and pub/sub; then demonstrate reliable create-to-WebSocket-to-join behavior.
2. Enforce paid entitlement on the server. Do not accept `unlocked` or an
   arbitrary `unlock` WebSocket message as proof; verify a Sociobot license or
   server-issued entitlement before puzzles 2–3.
3. Deploy with `BUILD_SHA=7a43b3e122aebe7b66f62c58b0ef092b84d23f52` and
   make `/health` report it. Repeat the live room matrix afterward.

No product code was changed during this verification.

