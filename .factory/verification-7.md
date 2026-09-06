# Independent verification 7 — PASS

## Verdict

**PASS — zero current findings; zero untested public claims.**

- Implementation candidate and deployed build:
  `310691eea41475dac6c6ad054b62be27cd5b92cc`
- Previous documentation/review baseline:
  `bebc0cb0887bc5f6e5162b6fb846a25bb5a701dc`
- Live URL: <https://kindred-coop.sociobot.in>

The repair makes the Rust test router self-contained. It uses a committed test
shell fixture rather than the production `dist/` directory, so the existing
route and rate-limit outcomes remain tested even before Vite runs.

## Clean setup and claims

A new clone at `310691e` began without `dist/`. After `npm ci`, the exact
README command order passed, including `cargo test --locked` before
`npm run build`: Vitest 3/3, Rust 15/15, TypeScript/Rust checks, formatting,
strict Clippy, production build, and Playwright 12/12.

Every exact command in `.factory/claims.json` passed from that clone. The two
named Rust temporary-room tests also passed. The product has seven listed,
observable claims and no unlisted public product claim found in the landing
page or README.

## Live checks

- `/health` returned the deployed implementation SHA. The product image has a
  durable `/data` Azure File mount and fixed `minReplicas=1`, `maxReplicas=1`.
- Fresh desktop and phone first screens named the job, audience, and sample
  action before scrolling. Browser console errors were absent.
- `/demo` used only its `demo:kindred-coop` session storage, began with realistic
  populated progress, showed the persistent sample label, recovered from an
  incorrect match, reset, and did not change real sentinels or make room API
  requests.
- A desktop host and phone guest joined a live temporary room, completed the
  free puzzle, saw the paid boundary, and ended the room. Offline demo reload,
  keyboard skip focus, reduced motion, mobile layout, and Axe serious/critical
  scans passed.
- `/`, `/demo`, `/privacy`, and `/terms` returned 200 with route-specific titles
  and one `h1`. The designed unknown route returned HTTP 404 as intended.
- Live 45-request allowance: 40×200 and 5×429, each with `Retry-After: 1`.
  Fifty health checks returned 200. CSP, HSTS, nosniff, no-referrer, frame
  denial, and Permissions Policy were present.

## Earlier findings

All earlier findings listed in verification reports 3–6 and review 1 remain
closed. The only external dependency is billing registration: the required
Sociobot checkout route returned its known HTTP 404. The paid puzzles remain
server-gated and no successful checkout is claimed.
