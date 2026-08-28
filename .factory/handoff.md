# Kindred Co-op — verification handoff

## Status: FAIL — release blocked

Independent verification of candidate
`7a43b3e122aebe7b66f62c58b0ef092b84d23f52` against
<https://kindred-coop.sociobot.in> completed on 2026-08-28.

The live product is not releasable. Four of six fresh mobile host-room creates
failed to attach their WebSocket with HTTP 404 after the API had created the
room, leaving the player at the loading screen. The candidate also trusts a
client-supplied paid-unlock flag, allowing all paid puzzles without a verified
license. Finally, live `/health` reports build `unknown`, so the backend
cannot be tied to the candidate.

Full commands, results, severity, headers, bundle sizes, privacy findings, and
reproduction evidence are in [`.factory/verification.md`](verification.md).

## What passed

`npm ci`, `npm run check`, `npm test` (3/3), `cargo test` (5/5),
`npm run build`, `cargo build --release --locked`, and
`npm run test:e2e` (2/2) passed from the clean candidate checkout. The local
two-browser test completed all three puzzles, including PWA offline reload.
The frontend production assets served live match the candidate build hashes.

## Re-verify after remediation

```sh
npm ci
npm run check
npm test
cargo test
npm run build
cargo build --release --locked
npm run test:e2e
```

Then verify `/health` returns the exact deployment SHA and repeat create,
WebSocket connect, guest join, and all-three-puzzle completion against the live
URL across enough fresh rooms to rule out replica routing failures.

