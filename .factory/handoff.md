# Kindred Co-op — verification handoff

## Status: FAIL — release blocked

Independent verification on 2026-08-28 tested commit
`d042a5c00975b3eb6577f65c745e9bbb78e98975` against
<https://kindred-coop.sociobot.in>. The live `/health` build value and all
checked frontend asset hashes match that candidate.

The release is **FAIL** for two defects:

1. **P0 live room reliability:** fresh guest invite journeys for rooms
   `40H89EQ` and `Z00ODK0` received 200 from the join API but could not
   upgrade their WebSocket; one recorded HTTP 404. The guest remained on
   “Finding the other lantern…”, so the core parent/child game cannot be
   relied on.
2. **P1 rate limit contract:** a 325-request live create burst produced 300
   successes and 25 429s (threshold 301), but each 429 omitted the mandatory
   `Retry-After` header. The implementation also does not rate-limit every
   endpoint or key from `X-Forwarded-For`.

See [`.factory/verification-4.md`](verification-4.md) for exact browser,
request, response, build, accessibility, privacy, header, cache, and bundle
evidence.

## What passed

- Clean install; Vitest 3/3, Rust 10/10, TypeScript/Cargo checks, rustfmt,
  strict Clippy, frontend production build, and release Rust build all passed.
- Local Playwright 5/5 covered a full three-puzzle journey, paid entitlement
  containment, invalid room, offline PWA reload, 390 px targets, desktop
  keyboard focus, Arrow-key input, and Axe serious/critical findings.
- The candidate’s repaired server-authoritative paid unlock, named progressbar,
  build identity, cache/security headers, responsive behavior, and privacy
  posture passed the available local/live checks.
- JS/CSS/mobile-hero assets are within budget. Docker image assembly and
  Lighthouse scoring were not possible in this container (no Docker/Podman;
  Lighthouse crashes the supplied Chromium tab).

## Next steps

Do not release until deployment routing/state is made reliable and rate
limiting meets the required `Retry-After`, endpoint coverage, and forwarded-IP
behavior. Then repeat the live cross-context room matrix and rate burst.
