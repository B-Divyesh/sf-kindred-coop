# QA verification: Play picture puzzles together

## Verdict

**PASS — zero findings and zero untested public claims.**

- Implementation candidate reviewed: `310691eea41475dac6c6ad054b62be27cd5b92cc`
- Live build reported by `/health`: `22953a1d6a00af63420f8cc7f1bbc24be456da0c`
- Pre-QA documentation head: `22953a1d6a00af63420f8cc7f1bbc24be456da0c`
- Live URL: <https://kindred-coop.sociobot.in>

`310691e..22953a1` changes only `.factory/handoff.md` and the previous
verification report. A production build made with the live SHA matched the
live HTML, JavaScript, and CSS byte for byte. The live page and backend are
therefore the implementation candidate plus documentation-only commits.

## Job, audience, and first action

Before scrolling, fresh 1440×900 desktop and 390×844 phone browsers state:

- Job: **Play picture puzzles together**.
- Audience: a parent and child playing apart.
- First action: **Try it with sample data**.

Both screenshots are in `/work/.evidence/live-verify-7/`. The page had no
console or page errors on normal loading.

## Clean setup and public claims

A fresh clone at `22953a1` had no `dist/` directory. After `npm ci`, the exact
README order passed: `npm test` (3/3), `cargo test --locked` (15/15 before the
frontend build), `npm run check`, `cargo fmt --all -- --check`, strict Clippy,
`npm run build`, and `npm run test:e2e` (12/12).

Every exact command declared in `.factory/claims.json` passed from that clean
clone. The temporary-room claim also ran both named Rust tests.

| Claim | Result |
| --- | --- |
| `sample-demo` | PASS |
| `private-play` | PASS |
| `offline-instructions` | PASS |
| `full-game` | PASS |
| `paid-license` | PASS |
| `temporary-rooms` | PASS, including room-key isolation and restart tests |
| `rate-limit` | PASS |

The production frontend build is 27.97 KB JavaScript (9.38 KB gzip) and
15.25 KB CSS (4.29 KB gzip). A release binary compiled with `BUILD_SHA=310691e…`
started with only `PORT=8181` and returned the complete candidate SHA from
`/health`.

## Live product checks

- The first-screen and visual checks passed on a fresh desktop and phone.
  `verify-url.sh` reported title, `lang=en`, one `h1`, `main`, image alt text,
  and no normal-load console errors. Axe found no serious or critical issue on
  home, demo, or the desktop-host/phone-guest game.
- The direct `/demo` sample began with two of four shapes matched. Its
  persistent **Demo — sample data, nothing is saved** label stayed visible. A
  wrong match showed recovery text, completing the sample worked, and reset
  returned it to the populated state. Real license and room sentinels stayed
  unchanged; the demo made no room request and all of its requests were
  same-origin.
- A dedicated service-worker context reloaded `/demo` offline after the first
  visit. Leaving it showed the Offline recovery state for live play.
- A fresh desktop host and phone guest created and joined an isolated room,
  completed the free four-shape puzzle, and reached the paid boundary. The
  guest saw **Waiting for the host**. No normal-flow console or page error was
  observed.
- Valid live room lifetimes of 15, 30, and 60 minutes returned matching expiry
  times. A 10-minute request returned 400. An unknown invite showed the useful
  “That room was not found. Ask the host for a fresh link.” recovery message;
  its expected API 404 was the only console network error in that deliberate
  invalid-path test.
- Fresh live request checks returned exactly 40×200 and 5×429 for a 45-request
  same-client burst; every 429 included `Retry-After: 1`. Fifty `/health`
  requests returned 200. Room-key isolation and restart removal passed in the
  clean Rust tests.
- `/`, `/demo`, `/privacy`, and `/terms` returned 200 with their own title,
  one `h1`, and one `main`. The styled unknown page returned its intentional
  HTTP 404. Keyboard Tab reached the skip link with a 3 px focus outline;
  Enter moved focus to `main`. Reduced motion set scrolling to `auto`.
- Internal links, robots, sitemap, legal pages, offline service worker, CSP,
  HSTS, `nosniff`, no-referrer, frame denial, Permissions Policy, shell
  revalidation, and immutable hashed-asset caching passed. The normal home and
  demo flow set no cookies and made no third-party request.

## Earlier findings

| Earlier finding | Current disposition |
| --- | --- |
| Clean README order failed before frontend build | Closed: a fresh clone passed Rust tests before `npm run build`. |
| Missing claim contract and sample sandbox | Closed: seven claim commands and isolated populated demo passed. |
| Guest relay 404 and missing rate-limit retry header | Closed: live desktop-host/phone-guest play passed; live burst returned 40/5 with `Retry-After: 1`. |
| Browser-trusted paid access and unnamed progress bar | Closed: paid-license claim, server checks, and active-game Axe checks passed. |
| Build identity, small targets, and response policy gaps | Closed: live health identity, focus/mobile checks, and response headers passed. |

## Known external dependency

The registered Sociobot checkout URL returns the documented HTTP 404. This is
an expected external billing-registration dependency, not a broken product
path: checkout success is not claimed, paid puzzles remain server-gated, and
the free game and isolated sample work without it.
