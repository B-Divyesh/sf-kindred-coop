# Kindred Co-op

Kindred Co-op is a private, browser-first co-op game for a parent and child
playing apart. One player reads a tiny field note and sends structured picture
signals; the other matches them. A private invite room lasts 15, 30, or 60
minutes and then disappears.

The free game includes the complete Moonbeam Message puzzle. A one-time $8
family license unlocks Stepping-stone Trail and Moth Field Notes through the
Sociobot hosted checkout—never an embedded payment provider.

Live: <https://kindred-coop.sociobot.in>

## Product promises

- No account, open chat, ads, subscriptions, or behavioral analytics.
- Room state lives only in server memory and is purged after expiry.
- SQLite stores one aggregate page-view count per day, with no visitor data.
- License tokens and the offline app shell stay in the user's own browser.
- Keyboard, screen reader, reduced-motion, offline, mobile, full-room, and
  expired-room paths are designed and handled.

## Run locally

Requirements: Node 22+, npm, Rust 1.89+, and SQLite development libraries.

```sh
npm ci
npm run build
DATABASE_URL='sqlite://kindred.db?mode=rwc' cargo run
```

Open <http://localhost:8080>. For live frontend work, run `cargo run` and
`npm run dev` in separate terminals, then use <http://localhost:5173>.

Useful checks:

```sh
npm test          # frontend unit tests
cargo test        # backend route and game tests
npm run check     # TypeScript and Rust checks
npm run build     # reproducible frontend output in dist/
```

To test the paid flow against staging, build with
`VITE_BILLING_BASE=https://pilot-api.sociobot.in`. The production default is
`https://api.sociobot.in`. Product registration is handled by the factory; no
payment-provider credentials or product IDs belong in this repository.

## Container

```sh
docker build --build-arg BUILD_SHA="$(git rev-parse --short HEAD)" -t kindred-coop .
docker run --rm -p 8080:8080 -v kindred-data:/data kindred-coop
```

The multi-stage image runs as a non-root user on `PORT` (default `8080`) and
serves the Vite build and Axum API from one origin. `/health` reports status
and build SHA. Set `DATABASE_URL`, `DIST_DIR`, `PORT`, and `RUST_LOG` with
environment variables when needed.

## Architecture

- Vite + strict TypeScript, using browser APIs and no runtime framework.
- Rust 2021, Axum WebSockets, Tokio, and SQLx/SQLite.
- In-memory, two-seat rooms protected by distinct random role keys.
- The Container App is deliberately pinned to one replica (`min=1`, `max=1`):
  a room's ephemeral WebSocket relay must share the same process as its create
  and join requests. Scaling this product requires a shared room relay first.
- Server-authoritative paid rooms verified against the Sociobot license API.
- All application routes except `/health` are limited to a 40-request rolling
  one-second burst per first `X-Forwarded-For` address; limited responses carry
  `Retry-After: 1`.
- Installable PWA shell with no third-party fonts, scripts, or CDN assets.

Visual rationale and generated-asset provenance are in
[`.factory/design.md`](.factory/design.md). Deployment verification and known
gaps are in [`.factory/handoff.md`](.factory/handoff.md).

## License

MIT — see [LICENSE](LICENSE).
