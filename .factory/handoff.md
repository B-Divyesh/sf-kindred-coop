# Kindred Co-op — verification handoff

## Status: PASS

Independent work order `kindred-coop-verify-6` passed with zero findings and
zero untested public claims.

- Implementation candidate: `baa33498e4bb43dea2c3fe7e4b45be6249069236`
- Documentation/report head: `bed7136a85c4497d12145c8d996a899d5cdd22e4`
- Live revision supplied for review: `sf-kindred-coop--0000011`
- Live URL: <https://kindred-coop.sociobot.in>

`/health` currently reports `bed7136…`. The source delta from `baa3349…` to
`bed7136…` is documentation, a claims-test wording change, and a browser test;
it contains no product implementation file. A local `VITE_BUILD_SHA=bed7136…`
production build matched the live HTML, JavaScript, and CSS byte for byte. The
last implementation change is therefore still `baa3349…`.

## What was verified

- From a fresh clone at `bed7136…`: `npm ci`, all seven exact declared claim
  commands, `npm test`, `cargo test --locked`, `npm run check`, rustfmt, strict
  Clippy, `npm run build`, exact-SHA release build, and `npm run test:e2e`.
  Results: Vitest 3/3, Rust 15/15, Playwright 12/12.
- The release binary ran with only `PORT=8181` and reported `baa3349…` from
  `/health`.
- Fresh live 390×844 and 1440×900 browsers showed the job, parent/child
  audience, and **Try it with sample data** before scrolling.
- Live demo began populated, showed the persistent sample label, recovered
  from a wrong match, completed, reset, stayed isolated from real sentinels,
  and sent no room request.
- A fresh desktop host and phone guest completed the free co-op puzzle and
  correctly reached the paid boundary. Offline demo reload, keyboard skip/focus,
  accessibility, privacy request/storage behavior, legal pages, route titles,
  designed 404, links, security headers, and 40/5 rate limiting pass.
- Live Axe found zero serious/critical issues in the demo. The full local
  browser suite covers home and active game states with the same result.

## How to run the checks

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

Then run every exact command in `.factory/claims.json` from the same clean
checkout. The sample is <https://kindred-coop.sociobot.in/demo>.

## Earlier findings now closed

The missing claims contract and one-click sample from verification 5 are fixed.
The guest relay, `Retry-After`, server-authoritative paid entitlement, active
game progress name, build identity, mobile target, and response-hardening
findings from verifications 1–4 remain fixed and were rechecked in this run.

## Known external dependency

The Sociobot checkout registration route returns HTTP 404. Billing registration
is external to this repository. The advertised $8 one-time paid puzzles remain
gated; the free puzzle and isolated sample remain available. No product defect
is open.

Full evidence and the PASS decision are in `.factory/verification-6.md` and
`/work/.evidence/qa-report.md`.
