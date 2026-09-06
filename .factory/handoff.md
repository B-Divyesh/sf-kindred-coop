# Kindred Co-op handoff

## Status

**PASS — independent QA verification 7 found zero findings and zero untested public claims.**

## Release identity

- Implementation candidate: `310691eea41475dac6c6ad054b62be27cd5b92cc`
- Live `/health` and documentation build: `22953a1d6a00af63420f8cc7f1bbc24be456da0c`
- Live product: <https://kindred-coop.sociobot.in>

The commits between these identifiers change only factory documentation and a
previous report. A production build made with the live SHA matched the live
HTML, JavaScript, and CSS byte for byte.

## What was verified

- The clean README setup passed, including `cargo test --locked` before the
  frontend build: Vitest 3/3, Rust 15/15, TypeScript/Rust checks, rustfmt,
  strict Clippy, production build, and Playwright 12/12.
- All seven exact claim commands in `.factory/claims.json` passed. The
  temporary-room claim also passed its room-isolation and restart tests.
- Fresh desktop and phone pages stated the job, audience, and sample action
  before scrolling. The isolated sample was populated, persistent-labelled,
  resettable, and did not touch real sentinels or room APIs.
- Live desktop-host/phone-guest co-op completed the free puzzle and reached
  the paid boundary. Offline demo reload, keyboard skip focus, reduced motion,
  mobile layout, route titles, legal pages, designed 404, Axe scans, and
  normal-load console checks passed.
- Live valid room-lifetime boundaries, invalid invite recovery, health,
  security/cache headers, internal links, and the exact 40×200/5×429 allowance
  with `Retry-After: 1` passed.
- A release binary built as `310691e…` started with only `PORT=8181` and
  returned that candidate SHA from `/health`.

Full evidence is in [verification-7.md](verification-7.md). Live screenshots
and the required QA copy are in `/work/.evidence/` for this verification run.

## Run and verify

Install Node 22 or newer, npm, and the current stable Rust toolchain, then run:

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

Run every command in `.factory/claims.json` from the same clean setup. Start
the product locally with `cargo run`; it serves on `PORT` (default 8080).

## Known external dependency

The Sociobot checkout registration endpoint currently returns HTTP 404. Paid
puzzles stay server-gated, and no successful checkout is claimed. The free
puzzle and isolated sample remain available.
