# Kindred Co-op — build handoff

Work order: `kindred-coop-build-1`

Completed: 2026-08-28

Artifact: containerized Axum backend serving a Vite/TypeScript PWA

## What shipped

- A complete two-player, browser-first co-op flow with random seven-character
  invite codes and separate 32-character host/guest keys.
- Three asymmetric, structured-signal puzzles: Moonbeam Message,
  Stepping-stone Trail, and Moth Field Notes. Two separate browser contexts can
  complete the full journey; no voice or open chat is required.
- Illustrated first-run control cards, replayable instructions, labeled symbol
  controls, Arrow-key support for the direction puzzle, designed focus
  continuity during live state updates, retry feedback, and 44px+ touch targets.
- Host-selected 15/30/60-minute expiry, host-only extension/end controls,
  automatic in-memory room deletion, a two-seat limit, edge validation, and a
  global room-request rate limit.
- First-class waiting, full-room, invalid-code, expired, connection-lost,
  offline, loading, free-completion, paid-lock, and final-success states.
- A genuinely useful free first puzzle. The $8 one-time family unlock uses only
  Sociobot's hosted checkout and verify API, stores `sb_license:kindred-coop`,
  caches verdicts for one day, handles return tokens, and supports paste-to-
  restore. Only the host needs a license for both players to continue.
- Privacy/terms routes, parent/device responsibility language, no account or
  chat, and one anonymous aggregate daily page count in SQLite. Room codes,
  signals, IP addresses, and device data are not stored in the database.
- A versioned service worker that discovers and precaches Vite's hashed shell,
  install manifest/icon, immutable asset caching, and a useful offline shell.
- Security headers (CSP, `nosniff`, no-referrer, frame denial), structured JSON
  logs, `/health` with build SHA, graceful shutdown, and a non-root multi-stage
  Dockerfile on port 8080.
- A product-specific two-ink field-guide visual system and original generated
  halftone hero. Source, prompt, review, optimization, and provenance are in
  `.factory/design.md` and `assets/src/`; the shipped 720px WebP is 50 KB.

## Run and verify

```sh
npm ci
npm run check
npm run test:all
npm run build
npm run test:e2e
DATABASE_URL='sqlite://kindred.db?mode=rwc' cargo run
```

`npm run build` is the reproducible frontend build command and writes
`dist/index.html` at the required root. The runtime container builds with:

```sh
docker build --build-arg BUILD_SHA="$(git rev-parse --short HEAD)" -t kindred-coop .
```

## Verification results

- `npm test`: 3/3 license/cache unit tests passed.
- `cargo test`: 5/5 session, validation, and route tests passed.
- Playwright 1.58.2: 2/2 end-to-end tests passed. The primary test uses two
  isolated 390×844 contexts to create/join a room and finish all three puzzles.
- Playwright Axe: zero serious or critical findings on the home and completed
  room screens; browser console errors: zero; mobile horizontal overflow: zero.
- Direct `/privacy` and `/terms` navigation: HTTP 200; immutable asset caching
  and security headers confirmed with response-header checks.
- Production bundle: 21.49 KB JS and 12.77 KB CSS uncompressed (7.99 KB and
  3.75 KB gzip); mobile hero 50,126 bytes. All are inside the product budgets.
- Lighthouse 13 mobile emulation on the compiled Axum-served build:
  Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.1s,
  LCP 1.8s, TBT 30ms, CLS 0, interactive 1.8s.
- Load smoke: 100 concurrent `/health` requests, 100 successful, 139ms total on
  the local worker.

## Known gaps / deployment notes

- Rooms intentionally live in one process. Deploy one replica (or add sticky
  routing plus shared ephemeral state later); a restart ends active rooms,
  consistent with the privacy/ephemerality promise.
- The factory still needs to register the `kindred-coop` paid product and align
  its hosted price to the stated $8 before release. Use
  `VITE_BILLING_BASE=https://pilot-api.sociobot.in` for staging.
- The worker image had no Docker CLI, so the Dockerfile itself could not be
  executed here. Both native build stages and the final runtime command were
  verified independently; CI/deployment should run the documented image build.
- Automated Axe and keyboard/mobile paths passed; a human VoiceOver/NVDA read-
  through remains a worthwhile release check.
