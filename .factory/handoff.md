# Kindred Co-op handoff

## Status

**PASS — review 2 found zero findings and zero untested public claims.**

## Release identity

- Implementation candidate: `310691eea41475dac6c6ad054b62be27cd5b92cc`
- Documentation checkout reviewed: `ae30bc0157f6e7d4e65dd8bb13098866a91ff9eb`
- Live `/health`: `22953a1d6a00af63420f8cc7f1bbc24be456da0c`
- Live product: <https://kindred-coop.sociobot.in>

Commits after the implementation candidate are report-only. A production build
with the live SHA produced JavaScript and CSS with the same names and SHA-256
values as the live files.

## What was verified

- A fresh clone passed the documented checks: Vitest 3/3, Rust 15/15 before
  the frontend build, TypeScript/Rust checks, rustfmt, strict Clippy, build,
  and Playwright 12/12.
- All seven exact claim commands passed individually. The temporary-room claim
  also passed room-key isolation and restart removal checks.
- Fresh desktop and phone screens named the job, audience, and sample action
  before scrolling. The labelled populated demo reset without touching real
  sentinels or room APIs.
- A live desktop host and phone guest completed the free puzzle, reached the
  server-gated paid boundary, and had no normal-flow console or page error.
- Offline sample reload, invalid/boundary room recovery, keyboard focus,
  mobile layout, Axe scans, legal pages, route titles, designed 404, headers,
  and the live 40×200/5×429 allowance with `Retry-After: 1` passed.

Full evidence is in [review-2.md](review-2.md). Screenshots are in
`/work/.evidence/review-2-live/`.

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
puzzles remain server-gated, no successful checkout is claimed, and the free
puzzle and isolated sample remain available.
