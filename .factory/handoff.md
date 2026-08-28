# Kindred Co-op — independent verification handoff

## Status: FAIL — release blocked

Work order `kindred-coop-verify-3` independently verified candidate
`7a43b3e122aebe7b66f62c58b0ef092b84d23f52` against
<https://kindred-coop.sociobot.in> on 2026-08-28.

The earlier intermittent live WebSocket symptom was not reproduced: 10/10
fresh mobile room starts succeeded, and a desktop host plus mobile guest
completed all three puzzles. The live frontend files match the candidate
byte-for-byte. The release still fails because paid entitlement is controlled
by browser state, the active puzzle has an Axe-serious unnamed progressbar, and
live `/health` reports build `unknown` rather than the candidate SHA.

Additional P2 findings are sub-44px mobile navigation/footer targets and missing
HSTS, Permissions Policy, and explicit cache policy for HTML/service-worker
responses.

Full evidence, commands, hashes, performance measurements, and reproduction
details are in [`.factory/verification-3.md`](verification-3.md).

## Verification summary

- Clean candidate checkout remained clean throughout.
- `npm ci`: PASS, 0 vulnerabilities.
- `npm test`: PASS, 3/3.
- `cargo test --locked`: PASS, 5/5.
- `npm run check`, Rust formatting, and strict Clippy: PASS.
- `npm run build` and SHA-stamped locked Rust release build: PASS.
- `npm run test:e2e`: PASS, 2/2.
- Live Lighthouse mobile: 99 performance, 100 accessibility, 100 best
  practices, 100 SEO; LCP 1.2 s, TBT 130 ms, CLS 0.
- PWA installability, update cleanup, and offline reload: PASS.
- Local concurrency: 100/100 health; 300 accepted and 5 rate-limited among 305
  simultaneous room creates. Live health: 100/100.
- Docker could not be assembled because no compatible container CLI is present;
  both native production stages and the runtime command were verified.

## Re-verification gate

After remediation, repeat all repository checks, build the container with the
candidate `BUILD_SHA`, confirm live `/health`, run Axe while a puzzle is active,
and complete free/paid two-browser journeys with server-enforced valid, invalid,
revoked, and offline-cached license states.

No product code was modified.
