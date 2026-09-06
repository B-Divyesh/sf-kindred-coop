# Kindred Co-op — repair 4 handoff

## Status: PASS

The documented clean setup now works in the order stated in the README.
`cargo test --locked` no longer requires a prebuilt `dist/` directory.

## Release

- Implementation commit and deployed build: `310691eea41475dac6c6ad054b62be27cd5b92cc`
- Documentation and verification report commit: `d92fc925894f48b46c895c3cb778a763fe16f944`
- Previous documentation/review baseline: `bebc0cb0887bc5f6e5162b6fb846a25bb5a701dc`
- Live product: <https://kindred-coop.sociobot.in>
- Live `/health`: reports the implementation commit above.
- Deployed image: `sociobotregistry.azurecr.io/sf-kindred-coop@sha256:d67cc972392d37c0c71d0fd59d2e3e66f454de668d7c1c50b40ef43b434c552c`
- Deployment keeps one replica and the durable `sf-kindred-coop-data` Azure File mount at `/data`.

## What changed

Rust route tests now build their Axum fallback with the committed
`tests/fixtures/test-shell/index.html` fixture. Production still serves the
directory selected by `DIST_DIR` (default `dist/`). This keeps the rate-limit
tests focused on their observable HTTP behavior while allowing a clean Rust
test run before Vite has built frontend files.

## Verification

From a fresh clone at `310691e`, `dist/` was absent before the commands below.
The README sequence then passed in this exact order:

```sh
npm ci
npm test
cargo test --locked
npm run check
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
npm run build
npm run test:e2e
```

- Vitest passed 3/3; Rust passed 15/15 before the frontend build; Playwright
  passed 12/12. The production build contains 27.97 KB JavaScript (9.38 KB
  gzip) and 15.25 KB CSS (4.29 KB gzip).
- Every exact command in `.factory/claims.json` passed from that same clone:
  sample demo, private play, offline instructions, full game, paid license,
  temporary rooms plus both Rust boundary tests, and rate limit.
- A release build compiled with `BUILD_SHA=310691e…` started with only
  `PORT=8181` and returned that full SHA from `/health`.
- `/opt/fleet/lib/verify-url.sh` passed against the live origin with no console
  errors, title/lang, one `h1`, `main`, and complete image alt coverage.
- Fresh live 1440×900 and 390×844 browsers showed the job (“Play picture
  puzzles together”), audience (a parent and child playing apart), and **Try
  it with sample data** before scrolling. Keyboard skip-to-main, phone layout,
  reduced motion, and Axe serious/critical checks passed.
- The live sample began populated at two of four matches, kept its persistent
  sample label, recovered from a wrong match, completed, reset to the seeded
  state, made no room API request, and left real room/license sentinels
  unchanged.
- A fresh desktop host and phone guest created, joined, solved the free puzzle,
  reached the paid boundary, and ended their temporary room without console
  errors. A dedicated service-worker context reloaded `/demo` offline.
- `/`, `/demo`, `/privacy`, and `/terms` returned 200 with their route titles
  and a single `h1`; the designed unknown page returned its intentional HTTP
  404. Live security headers include CSP, HSTS, `nosniff`, no-referrer, frame
  denial, and Permissions Policy.
- A fresh 45-request live burst returned exactly 40×200 and 5×429; every 429
  had `Retry-After: 1`. Fifty live `/health` requests returned 200.

## Earlier findings

| Finding | Current disposition |
| --- | --- |
| Review 1: clean README command order failed before `npm run build` | Fixed and regression-covered by the committed test shell fixture; fresh clone passed. |
| Verification 5: missing claims contract and one-click sample | Closed; all seven declared claim commands and the populated isolated `/demo` passed. |
| Verification 4: guest WebSocket 404 and missing retry header | Closed; fresh desktop-host/phone-guest flow and live 40/5 rate test passed. |
| Verification 3: browser-trusted paid access and unnamed progressbar | Closed; paid-boundary claim, active-room Axe, and server verification paths passed. |
| Verification 3: build identity, target size, and response policy | Closed; live health SHA, keyboard/mobile checks, and headers passed. |

## External dependency and known gap

The registered Sociobot checkout URL still returns HTTP 404. This is the known
external billing-registration dependency. The one-time $8 offer remains gated;
the free puzzle and isolated sample remain usable without checkout. No checkout
success or entitlement from that unavailable external route is claimed.

## Run and deploy

Use the README commands above for local verification. The product container is
deployed with the factory product-scoped deployment command and `WO_DATA_DIR=/data`.
The runtime uses `PORT` (default 8080); temporary room state is intentionally
in-memory and ends on restart, while the durable mount is retained for product
state that needs to survive redeploys.
