# Kindred Co-op

Kindred Co-op is a browser game for a parent and child playing in different
places. One player reads a shape order. The other player matches each shape.
The controls work on a phone, tablet, or computer.

Try the isolated sample at <https://kindred-coop.sociobot.in/demo>. It shows
both roles with two shapes already matched. It does not create a real room or
change real room and license data.

The free game includes one complete puzzle. A one-time $8 family license adds
two puzzles through Sociobot checkout. There are no accounts, ads,
subscriptions, open chat, or behavior tracking.

Live product: <https://kindred-coop.sociobot.in>

## What it includes

- A one-click sample with both roles, populated progress, reset, and clear exit.
- Private two-player rooms that last 15, 30, or 60 minutes.
- Three picture-and-direction puzzles with touch and keyboard controls.
- Offline access to the instructions and sample after the first visit. Live
  room play still needs internet access.
- A server-checked family license for the two paid puzzles.
- One aggregate page count per day. The app has no visitor profiles.

Every public product claim and its clean command are listed in
[`.factory/claims.json`](.factory/claims.json). The sample data and its isolated
storage key are documented in [`.factory/demo.md`](.factory/demo.md).

## Run locally

Install Node 22 or newer, npm, the current stable Rust toolchain, and SQLite
development libraries.

```sh
npm ci
npm run build
DATABASE_URL='sqlite://kindred.db?mode=rwc' cargo run
```

Open <http://localhost:8080>. The sample is at <http://localhost:8080/demo>.
For frontend development, run `cargo run` and `npm run dev` in separate
terminals, then use <http://localhost:5173>.

Run the complete local checks:

```sh
npm test
cargo test --locked
npm run check
cargo fmt --all -- --check
cargo clippy --all-targets --all-features --locked -- -D warnings
npm run build
npm run test:e2e
```

Run each command in `.factory/claims.json` from this same clean setup. The
Playwright configuration builds the frontend and starts the backend plus a
recorded local billing response. It does not spend money or use a live license.

For a staging billing check, build with
`VITE_BILLING_BASE=https://pilot-api.sociobot.in`. Production uses
`https://api.sociobot.in`. Billing registration is handled outside this
repository. No payment-provider credential belongs here.

## Container

```sh
docker build --build-arg BUILD_SHA="$(git rev-parse HEAD)" -t kindred-coop .
docker run --rm -p 8080:8080 -v kindred-data:/data kindred-coop
```

The multi-stage image runs as a non-root user on `PORT`, which defaults to
`8080`. It serves the Vite build and Axum API from one origin. `/health`
returns status and the build SHA. SQLite uses `/data` in the image. Outside the
image, the server uses `/data` when that directory exists and otherwise writes
beside the process. `DATABASE_URL`, `DIST_DIR`, `PORT`, and `RUST_LOG` may
override these defaults.

## Architecture and deployment

- Vite and strict TypeScript use browser APIs without a runtime framework.
- Rust 2021, Axum WebSockets, Tokio, and SQLx use SQLite for the page count.
- Room progress stays in process memory. A restart removes rooms but keeps the
  SQLite page count.
- The product deployment must keep one replica (`min=1`, `max=1`) because a
  room and its WebSocket relay share one process.
- All routes except `/health` allow a 40-request burst per first forwarded IP.
  A limited request returns 429 with `Retry-After: 1`.
- The PWA uses no third-party fonts, scripts, or CDN assets.

Visual rationale and asset provenance are in
[`.factory/design.md`](.factory/design.md). Current verification and deployment
details are in [`.factory/handoff.md`](.factory/handoff.md).

## License

MIT — see [LICENSE](LICENSE).
