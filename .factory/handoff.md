# Kindred Co-op — repair handoff

## Status: PASS — deployed

Work order `kindred-coop-repair-2` repaired the release blockers in
`.factory/verification-4.md` for candidate
`d042a5c00975b3eb6577f65c745e9bbb78e98975`.

- Repair commit: `c2f3488453ac0036bc1a1d975e8526fd1cb0f85d`
- Live target: <https://kindred-coop.sociobot.in>
- Azure revision: `sf-kindred-coop--repair2`
- Image: `sociobotregistry.azurecr.io/sf-kindred-coop:c2f3488453ac`
- Image digest: `sha256:f9652ffe39cc9bccc2b30f04afd73cb97810d6f2a3e4385e89a6ac148ff0eb88`

## Repairs

- The deployed Container App is now explicitly pinned to one replica
  (`minReplicas=1`, `maxReplicas=1`). Rooms intentionally remain ephemeral,
  in-process state, so create, join, and WebSocket upgrade requests now always
  reach the one room relay. This preserves the product's stated privacy and
  expiry behavior rather than making rooms durable.
- A router-bound, per-client rate limiter now covers every route, including
  page views, create/join/unlock APIs, WebSocket upgrades, and the static
  fallback. It keys on the first `X-Forwarded-For` hop (with a safe local
  fallback), permits a 40-request rolling one-second burst, exempts `/health`,
  and sends `Retry-After: 1` with every 429.
- README documents the single-replica invariant and rate policy so a future
  deployment cannot unknowingly split the in-memory relay.

The server-authoritative license path, named progress bar, responsive targets,
security/cache headers, generated artwork, free puzzle, privacy boundaries,
and all previously passing behavior were retained.

## Exact regression coverage

Rust route tests now prove that:

- 40 requests from `198.51.100.7, 10.0.0.4` are accepted, the next receives
  429 plus `Retry-After: 1`, and a different first forwarded address remains
  independently accepted;
- rate limiting applies to page views, session creation, session join, license
  unlock, WebSocket upgrades, and fallback pages;
- `/health` remains available after 50 requests from the same client.

Existing coverage still proves the valid/revoked/fabricated license boundaries,
WebSocket unlock rejection, security/cache policy, keyboard path, 390px touch
targets, offline shell recovery, active-game Axe checks, and the full
two-player three-puzzle journey.

## Verification evidence

Run from `/work/repo` on 2026-08-28:

```sh
npm ci
npm audit --audit-level=high
npm test
cargo test --locked
npm run check
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
npm run build
BUILD_SHA="$(git rev-parse HEAD)" cargo build --release --locked
npm run test:e2e
```

Results:

- Clean `npm ci` installed 60 packages; audit reported 0 vulnerabilities.
- Vitest passed 3/3. Rust tests passed 12/12. TypeScript/Cargo checks,
  rustfmt, and strict Clippy passed.
- The SHA-stamped locked release build passed. Vite emitted `dist/`; JS is
  22.00 KB (8.16 KB gzip), CSS is 12.92 KB (3.77 KB gzip), and the mobile hero
  remains 50,126 B. Package/consumer testing is not applicable to this deployed
  web app.
- Playwright 1.58.2 Chromium passed 5/5 at desktop and 390x844 mobile:
  separate contexts completed all puzzles, forged/revoked/unavailable license
  caches remained at the paid lock, Arrow-key input worked, keyboard skip/focus
  worked, all tested mobile navigation targets were at least 44px, offline
  reload worked, and active host/guest Axe serious/critical violations were 0.
- `az acr build` successfully assembled the actual multi-stage container from a
  source archive that excluded `.git`.

Live after deployment:

- `/health` returned
  `{"build":"c2f3488453ac0036bc1a1d975e8526fd1cb0f85d","status":"ok"}`.
  Azure reports ready revision `sf-kindred-coop--repair2`, the image above,
  and `minReplicas: 1`, `maxReplicas: 1`.
- 10/10 fresh, isolated journeys with a 1440x900 host and 390x844 guest
  created a room, joined it, upgraded both WebSockets, reached Moonbeam
  message, and reported "Together". No prior 404 handshake occurred.
- A 45-way live `POST /api/page-view` burst yielded exactly 40x204 and 5x429;
  all 429 responses carried numeric `Retry-After: 1`.
- Live active-game Axe scans had zero serious/critical violations at desktop
  and 390px; the desktop keyboard skip link received focus, and the mobile
  page had no horizontal overflow.
- Live shell and worker headers confirm CSP, nosniff, no-referrer, frame
  denial, HSTS, Permissions Policy, and `no-cache, must-revalidate` cache
  control. The earlier service-worker/offline update behavior is unchanged and
  covered by the authored browser test.

Lighthouse was attempted with the supplied Playwright Chromium but could not
connect to its debugging port in this worker, the same environment limitation
recorded by independent verification. Browser-based accessibility, console,
responsive, and bundle-budget checks above completed successfully.

## Known gaps and next steps

No release-blocking gaps remain. The one-replica setting is a deliberate
product invariant while rooms remain memory-only; a future scale-out change
must first add shared ephemeral room state/pub-sub (or a tested equivalent),
then update this handoff and the deployment configuration.
