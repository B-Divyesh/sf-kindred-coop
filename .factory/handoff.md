# Kindred Co-op — repair handoff

## Status: PASS

Work order `kindred-coop-repair-3` is complete. The live product at
<https://kindred-coop.sociobot.in> serves implementation
`baa33498e4bb43dea2c3fe7e4b45be6249069236`. Claim and test documentation is
at `266f5ad3b76c421c1e716f87a1a2e901c703444f`; the later handoff/report commit
does not require another product image.

- Azure revision: `sf-kindred-coop--0000011`
- Image digest:
  `sha256:467ccfc81d9e664c0eabd5129425348f94c3adf1c7ea782144bda525a938715b`
- Scale: one replica (`min=1`, `max=1`)
- Durable mount: `sf-kindred-coop-data` mounted at `/data`

## Repairs

- Added the required [claims contract](claims.json). Its seven entries each
  have one tagged, outcome-based browser test and a clean command.
- Added a visible **Try it with sample data** action to the first screen and a
  direct `/demo` route. The sample starts with two of four shapes matched,
  supports a wrong-match recovery, completion, and reset.
- Kept the exact **Demo — sample data, nothing is saved** banner visible with
  **Reset demo** and **Start for real**. Sample progress uses only
  `sessionStorage` key `demo:kindred-coop`; tests prove real license and room
  values do not change.
- Rewrote the first screen in plain words. It identifies the job, the parent
  and child audience, the first action, privacy, offline limits, and the exact
  one-time price before scrolling on a 390×844 phone and desktop.
- Added route-specific titles and canonical URLs, `/privacy`, `/terms`, a
  designed HTTP 404, social metadata, a 1200×630 product image, a touch icon,
  and `/demo` in the sitemap and offline shell.
- Removed the anonymous page counter. Azure Files did not provide usable
  SQLite locking for that optional counter and delayed normal page loads by
  about two seconds. The product now sends no analytics request and makes no
  database operation on page load. No user or room data was removed; old
  aggregate database files were left untouched on the product's mount.
- Preserved the working one-process WebSocket relay, forwarded-client rate
  limit, server-authoritative paid license checks, and all three puzzles.

## Earlier findings

| Finding | Current disposition |
| --- | --- |
| Verification 5: missing `.factory/claims.json` | Fixed; seven declared commands pass from a clean clone. |
| Verification 5: no one-click sample | Fixed; visible on the cold phone and desktop screen, with `/demo` direct entry. |
| Verification 4: live guest WebSocket 404 | Fixed previously and rechecked on this revision with a fresh desktop host and phone guest. |
| Verification 4: incomplete 429 response | Fixed previously and rechecked: 40 allowed, 5 limited, every 429 has `Retry-After: 1`. |
| Verification 3: browser-trusted paid access | Fixed previously; valid, fabricated, revoked, and unavailable verdict paths pass. |
| Verification 3: active-game accessibility | Fixed previously; live and local Axe scans report no serious or critical issue. |
| Verification 3: missing build identity | Fixed previously; `/health`, container image, and frontend build identify the deployed SHA. |
| Verification 3: small mobile targets | Fixed previously; the 390 px target audit passes. |
| Verification 3: response/cache hardening | Fixed previously; live headers and cache policies pass. |

## Clean verification

A fresh local clone of `266f5ad` at `/tmp/kindred-claims-clean-266f5ad` ran
`npm ci` and every exact command in `.factory/claims.json`. All seven claims
passed: sample isolation/reset, no analytics/cookies/third-party requests,
offline reload, three-puzzle licensed play with keyboard controls,
server-authoritative paid access, room timers/end/isolation/restart behavior,
and the exact rate allowance.

The main checkout also passed:

```sh
npm test
cargo test --locked
npm run check
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
npm run build
BUILD_SHA=baa33498e4bb43dea2c3fe7e4b45be6249069236 cargo build --release --locked
npm run test:e2e
```

Results: Vitest 3/3, Rust 15/15, Playwright 12/12, strict TypeScript and
Clippy clean. A production build emitted `dist/`; initial JavaScript is
28.00 KB (9.42 KB gzip), CSS is 15.25 KB (4.29 KB gzip), and the mobile hero
is 50,126 bytes. The release binary started with only `PORT=8181`, served the
demo, and returned the implementation SHA.

The fleet ACR build assembled the multi-stage, non-root container. Local and
live SHA-256 values match exactly for `index.html`, the JavaScript bundle, and
the CSS bundle.

## Live verification

- `/health` reports `baa33498…`; latest and latest-ready revision are both
  `sf-kindred-coop--0000011`.
- Fresh 390×844 and 1440×900 browsers showed the job, audience, and sample
  action before scrolling. The sample populated, recovered from an invalid
  match, reset, completed, kept its banner, made no API request, and did not
  change real-data sentinels. There were no console or page errors.
- A fresh desktop host and phone guest joined the same live room, completed
  Moon, Leaf, Star, and Ripple, and reached the paid boundary.
- A dedicated offline context reloaded `/demo`, opened the cached home page,
  and showed that live room play was offline.
- `/`, `/demo`, `/privacy`, and `/terms` return 200. An unknown route returns
  the expected designed 404.
- A 45-way static-route burst returned exactly 40×200 and 5×429; every limited
  response had `Retry-After: 1`. Fifty health requests remained available.
- CSP, HSTS, frame denial, no-referrer, nosniff, Permissions Policy, and cache
  headers are present. The standard URL verifier found no console errors.
- Live Axe checks at phone and desktop sizes found zero serious or critical
  violations.
- Lighthouse 13.4.1 scored 100 for performance, accessibility, best
  practices, and SEO. LCP was 1.50 s, CLS 0, and total blocking time 0 ms.

Evidence is under `/work/.evidence/kindred-coop-repair-3/final`.

## Billing and remaining dependency

The advertised offer remains $8 USD once for the two additional puzzles. The
live Sociobot checkout route currently returns 404, so billing registration is
still an external operator dependency. Paid content remains gated; it was not
made free. Public offer metadata is in
`/work/.evidence/billing-offer.json`, including the return URL and verification
path. The free puzzle and sample work without billing.

The catalog description is 76 characters, starts with a verb, and is copied
exactly to `/work/.evidence/catalog-description.txt`.

No product defect remains open. A process restart intentionally ends temporary
rooms, so the deployment must remain at one replica unless the relay design is
replaced with shared ephemeral state.
