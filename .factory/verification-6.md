# Independent verification 6 — PASS

## Verdict

**PASS — zero findings; zero untested public claims.**

Reviewed implementation candidate: `baa33498e4bb43dea2c3fe7e4b45be6249069236`.
Documentation head: `bed7136a85c4497d12145c8d996a899d5cdd22e4`.
Live URL: <https://kindred-coop.sociobot.in>

The live `/health` build identity is `bed7136…`, not `baa3349…`. This is not a
product-code divergence: `baa3349..bed7136` changes only factory
documentation, claims-test text, and an end-to-end test. A clean production
build with `VITE_BUILD_SHA=bed7136…` matched the live HTML, JavaScript, and CSS
byte for byte. The last implementation change remains `baa3349…`.

## Job, audience, and first action

On fresh 390×844 phone and 1440×900 desktop browsers, before scrolling, the
page says “Play picture puzzles together,” names a parent and child playing
apart, and shows “Try it with sample data.” The action remains fully visible
on both screens.

## Claims from a clean checkout

A new local clone at `bed7136…` completed `npm ci` (60 packages, 0 reported
vulnerabilities), then every exact command in `.factory/claims.json`:

| Claim | Result |
| --- | --- |
| `sample-demo` | PASS — one browser test passed. |
| `private-play` | PASS — one browser test passed. |
| `offline-instructions` | PASS — one browser test passed. |
| `full-game` | PASS — one browser test passed. |
| `paid-license` | PASS — one browser test passed. |
| `temporary-rooms` | PASS — browser test plus both named Rust tests passed. |
| `rate-limit` | PASS — one browser test passed. |

All seven claims are listed in the contract and each has an observable,
tagged test. No unlisted public claim was found on the landing page or README.

The clean checkout also passed `npm test` (3/3), `cargo test --locked`
(15/15), `npm run check`, `cargo fmt --all -- --check`, strict Clippy,
`npm run build`, an exact-SHA release build, and `npm run test:e2e` (12/12).
The build produced `dist/`: JavaScript 28.00 KB (9.42 KB gzip) and CSS 15.25
KB (4.29 KB gzip).

The release binary built with `BUILD_SHA=baa3349…` started with only
`PORT=8181` and returned that SHA from `/health`.

## Fresh live evidence

- Phone and desktop first screens have the plain job, audience, and sample
  action before scrolling; there is no horizontal overflow or console error.
- `/demo` begins with Moon and Leaf matched, retains the exact persistent
  “Demo — sample data, nothing is saved” label, handles a deliberately wrong
  Moon match, completes Star and Ripple, and resets to the populated state.
  Real license and room sentinels remained unchanged. Direct demo storage was
  only `sessionStorage["demo:kindred-coop"]`.
- A fresh desktop host created a seven-character invite. A fresh phone guest
  joined it; both connected, completed Moon, Leaf, Star, and Ripple, and the
  host reached the paid-puzzle lock. No console or page errors occurred.
- In its own service-worker context, `/demo` reloaded offline after first
  visit. Leaving it showed the explicit Offline state for live play.
- Keyboard Tab reached the skip link, whose designed outline measured 3 px;
  Enter moved focus to `main`. Reduced-motion, 44 px target, and mobile
  coverage pass in the authored suite.
- Live Axe scans of the sample found zero serious or critical violations.
  The full local suite additionally scans home and active/co-op states with
  zero serious or critical violations.
- Fresh home-to-demo traffic used only the product origin, made no API call,
  set no cookie, used no local-storage key, and left only the demo session key.
  There are no analytics, ads, accounts, third-party scripts, fonts, or chat.
- Browser checks confirmed route-specific titles and one h1 for `/`, `/demo`,
  `/privacy`, and `/terms`. Those required pages returned 200. The designed
  unknown route returned HTTP 404, which is expected and not a defect.
- Crawled internal links returned 200, aside from the intentional 404 test
  route. The external checkout URL returned 404 as the known billing
  registration dependency; no checkout success is claimed.
- A 45-request live same-client burst returned exactly 40×200 and 5×429;
  every 429 included `Retry-After: 1`. Fifty `/health` requests returned 200.
- Live headers include CSP, HSTS, `nosniff`, no-referrer, frame denial,
  Permissions Policy, and shell revalidation caching.

## Earlier findings

| Earlier finding | Current disposition |
| --- | --- |
| Verification 5: missing claims contract | Fixed; seven exact commands pass from a clean checkout. |
| Verification 5: no one-click sample | Fixed; visible cold-screen action and direct `/demo` pass. |
| Verification 4: guest relay 404 | Fixed; fresh desktop-host/phone-guest co-op completed live. |
| Verification 4: 429 lacked `Retry-After` | Fixed; live exact 40/5 split returned `Retry-After: 1`. |
| Verification 3: browser-trusted paid access | Fixed; valid, fabricated, revoked, and unavailable paths pass in the claim suite. |
| Verification 3: unnamed active progress | Fixed; active-game Axe checks pass in the full suite. |
| Verification 3: build identity | Fixed; `/health` identifies the actual source build. The handoff records implementation and documentation SHAs accurately. |
| Verification 3: undersized targets and incomplete response policy | Fixed; mobile target and header checks pass. |

## External dependency

Sociobot billing registration remains unavailable: the public checkout route
returns HTTP 404. This is an expected external dependency recorded by the
product. The $8 paid puzzles remain gated, and the free puzzle and sample work
without checkout.

Evidence commands and outputs were run in `/tmp/kindred-coop-verify-6`; the
required QA result is also copied to `/work/.evidence/qa-report.md`.
