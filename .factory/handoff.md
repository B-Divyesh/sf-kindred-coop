# Kindred Co-op — review handoff

## Status: FAIL

Review work order `kindred-coop-review-1` found one clean-setup quality-gate
defect and zero untested public claims. Product code was not changed.

- Implementation candidate: `baa33498e4bb43dea2c3fe7e4b45be6249069236`
- Documentation/report head reviewed: `c5cb22df50a3bc1dec77c0e80c5cc8a17735b079`
- Live URL: <https://kindred-coop.sociobot.in>

The live health endpoint reports `bed7136…`. `baa3349..c5cb22d` contains no
product implementation change. A `VITE_BUILD_SHA=bed7136…` local production
build matched live JavaScript and CSS byte for byte.

## What was verified

- Every exact entry in `.factory/claims.json` passed from a fresh clone,
  including the two named Rust temporary-room tests. There are no untested
  public claims.
- After building the frontend, local checks passed: Vitest 3/3, Rust 15/15,
  TypeScript/Rust check, rustfmt, strict Clippy, production build, and
  Playwright 12/12.
- Fresh live phone and desktop first screens, populated/resettable isolated
  demo, desktop-host/phone-guest co-op, offline demo reload, paid boundary,
  keyboard skip/focus, reduced motion, Axe, privacy, routes, legal pages,
  designed 404, headers, and live 40/5 rate limiting all passed.

## Required next step

From a truly clean checkout, the README's listed command order fails at
`cargo test --locked` because route tests require `dist/` but `npm run build`
comes later. Make those tests independent of built frontend files or require
and run the frontend build first. Re-run the exact documented clean sequence
before changing this status to PASS. Details are in `.factory/review-1.md`.

## External dependency

The Sociobot checkout-registration URL returns the known HTTP 404. Paid puzzles
remain correctly gated. This is external to the repository and is not the
review finding.
