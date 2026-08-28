# Kindred Co-op — repair handoff

## Status: PASS — deployed

Work order `kindred-coop-repair-1` repaired the findings in
`.factory/verification-3.md` for candidate
`7a43b3e122aebe7b66f62c58b0ef092b84d23f52`.

- Release code commit: `1b81322180347f8eaa3b058d5394a7408c3d82aa`
- Live target: <https://kindred-coop.sociobot.in>
- Azure revision: `sf-kindred-coop--0000003`
- Image: `sociobotregistry.azurecr.io/sf-kindred-coop:1b8132218034`
- Digest: `sha256:741d708990f518137e63cca2da86440445a44b212111cc9fe51a5f27e1cbd6be`

## Repairs

- Paid entitlement is server-authoritative. `POST /api/sessions` rejects the
  former browser-controlled `unlocked` field, optionally verifies a license
  against the Sociobot API, and defaults safely to the free room if billing is
  unavailable. The WebSocket `unlock` message no longer changes entitlement.
  Restore-in-room now uses an authenticated host-only HTTP endpoint that
  verifies the license before broadcasting the unlocked state.
- The active puzzle progress bar has a puzzle-specific accessible name.
- Docker's build-identity default is `dev`; release builds receive the full
  `BUILD_SHA`. `/health` and the default startup log report the embedded SHA.
- Header/footer links and the skip link now have at least 44×44 CSS-pixel hit
  areas. Skip-link activation reliably moves focus into `<main>`.
- HSTS and Permissions Policy were added. APIs and health use `no-store`, the
  HTML shell/service worker/manifest use `no-cache, must-revalidate`, and
  hashed assets remain one-year immutable.
- The service-worker cache moved to `kindred-shell-v2` and registration bypasses
  the HTTP cache during update checks.
- Because room state is intentionally ephemeral and in memory, the deployed
  Container App is pinned to one replica (`min=1`, `max=1`), preventing
  create/WebSocket requests from landing on different instances.
- Privacy copy now discloses server-side license validation. The researched
  visual thesis, generated artwork, original deployment class, free puzzle,
  expiry behavior, and previously passing game behavior are unchanged.

## Regression coverage

Rust tests now prove that:

- `{"expiryMinutes":15,"unlocked":true}` is rejected with HTTP 422;
- valid billing verdicts unlock while fabricated, revoked, and unavailable
  cached verdicts remain locked;
- room unlock requires the host credential and a fresh valid license;
- a host WebSocket `unlock` message cannot grant paid access;
- HSTS, Permissions Policy, API no-store, and shell/worker cache policies are
  present.

Playwright now checks the accessible active puzzle (not only home/completion),
the named progress bar, a valid server-verified three-puzzle journey, forged,
revoked, and unavailable cached-verdict containment, 390px target sizes,
desktop keyboard focus/room creation, Arrow-key puzzle input, invalid rooms,
and offline reload.

## Verification evidence

Run from `/work/repo` on 2026-08-28:

```sh
npm ci
npm audit --audit-level=high
npm test
cargo test --locked
npm run check
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
npm run build
BUILD_SHA="$(git rev-parse HEAD)" cargo build --release --locked
npm run test:e2e
```

Results:

- npm clean install/audit: 60 packages, 0 vulnerabilities.
- Vitest: 3/3 passed.
- Rust unit/integration: 10/10 passed.
- TypeScript, Cargo check, rustfmt, and strict Clippy: passed.
- Playwright 1.58.2 Chromium: 5/5 passed at 1440×900 and 390×844; active
  host/guest Axe serious/critical violations: 0; browser console errors: 0.
- Valid test license completed all three puzzles. Fabricated, revoked, and
  verifier-unavailable cached licenses each completed only the free puzzle and
  stopped at the paid lock.
- Production output: JS 22,000 B (8.16 KB gzip), CSS 12,921 B (3.77 KB gzip),
  mobile hero 50,126 B. `dist/` was produced.
- Local load smoke: 100/100 health requests returned 200; 305 concurrent room
  creates returned 300×200 and 5×429.
- Package/consumer verification is not applicable: this artifact is a deployed
  web application, not a library package.
- Local mobile Lighthouse: performance 100, accessibility 100, best practices
  100, SEO 100; FCP 1.1 s, LCP 1.8 s, TBT 30 ms, CLS 0.

Live after deployment:

- `/health` returned
  `{"build":"1b81322180347f8eaa3b058d5394a7408c3d82aa","status":"ok"}`;
  100/100 concurrent health checks returned 200.
- Startup logs reported `port_config=supplied`, `database_config=supplied`,
  `billing_config=default`, and the same full build SHA without secret values.
- 10/10 fresh 390px room starts reached the active first puzzle. A 1440px host
  and 390px guest connected, completed the free puzzle, and a fabricated cached
  license remained locked. There were no browser console errors or horizontal
  overflow; all measured navigation/footer targets were at least 44px.
- Offline reload of `/terms` passed under service-worker control.
- A direct attempt to send `unlocked:true` returned HTTP 422.
- Live headers include CSP, `nosniff`, no-referrer, frame denial, HSTS, and
  Permissions Policy. HTML, `sw.js`, and the manifest explicitly revalidate;
  hashed assets are immutable for one year.
- Local and live SHA-256 hashes match for `index.html`, JS, CSS, and `sw.js`.
- Live mobile Lighthouse: performance 100, accessibility 100, best practices
  100, SEO 100; FCP 0.9 s, LCP 1.2 s, TBT 30 ms, CLS 0, total transfer 86 KiB.

## Known gaps and next steps

No release-blocking gaps remain. Room state is deliberately non-durable, so the
service must remain single-replica unless a future release adds shared ephemeral
state/pub-sub or verified sticky routing. A real payment was not made; valid,
invalid, revoked, and verification-unavailable outcomes are covered against a
deterministic local Sociobot-compatible verifier, while the live invalid-token
path was exercised without charging a card.
