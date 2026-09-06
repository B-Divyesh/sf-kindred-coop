# Kindred Co-op review 1 — clean setup does not run the declared suite

## Verdict

**FAIL — 1 finding; 0 untested public claims.**

Implementation candidate reviewed: `baa33498e4bb43dea2c3fe7e4b45be6249069236`.
Documentation/report head: `c5cb22df50a3bc1dec77c0e80c5cc8a17735b079`.
Live URL: <https://kindred-coop.sociobot.in>.

`baa3349..c5cb22d` changes factory documentation, the claims contract/copy
audit, and tests only. It does not change product implementation files. Live
`/health` reports `bed7136a85c4497d12145c8d996a899d5cdd22e4`; an exact
production frontend build with `VITE_BUILD_SHA=bed7136…` matched the live
JavaScript and CSS SHA-256 byte for byte. The last implementation change is
therefore still `baa3349…`.

## Job, audience, and first action

Before scrolling, fresh 1440×900 desktop and 390×844 phone browsers say
“Play picture puzzles together,” name a parent and child playing apart, and
show **Try it with sample data** in the initial viewport. The job, audience,
and first action are plain and visible on both sizes.

## Finding

### P1 — the documented clean setup cannot run its declared complete suite

From a new clone at `c5cb22d`, after the documented `npm ci`, the README says
to run `cargo test --locked` before `npm run build`. That command fails:

```
app::tests::rate_limit_covers_every_route_but_not_health_checks ... FAILED
app::tests::rate_limit_uses_first_forwarded_hop_and_supplies_retry_after ... FAILED
assertion `left == right` failed
  left: 404
 right: 200
```

Both failures come from `exhaust_client` expecting `/privacy` to serve the
frontend shell at `src/app.rs:709-717`. In a pristine checkout `dist/` does
not exist, so the route correctly returns 404 instead. The stated command
order in `README.md:47-54` and the handoff's fresh-clone pass assertion are
therefore false. Running `npm run build` first makes the same Rust suite pass
(15/15), so this is a clean-setup/test-isolation defect, not a live-game
failure.

Fix before a PASS: make Rust route tests self-contained with a fixture shell,
or document and enforce the frontend build prerequisite before `cargo test`.
Then rerun the exact clean command sequence.

## Claims from a clean checkout

All seven exact entries in `.factory/claims.json` passed from the new clone;
the temporary-room entry's two named Rust tests also passed. No public
landing-page or README claim lacked a contract entry. There are **0 untested
public claims**.

| Claim | Result |
| --- | --- |
| `sample-demo` | PASS |
| `private-play` | PASS |
| `offline-instructions` | PASS |
| `full-game` | PASS |
| `paid-license` | PASS |
| `temporary-rooms` | PASS, including both Rust boundary tests |
| `rate-limit` | PASS |

After building the frontend, the remaining local commands passed: Vitest 3/3,
Rust 15/15, `npm run check`, rustfmt, strict Clippy, `npm run build`, and
Playwright 12/12. The production build is 27.97 KB JavaScript (9.38 KB gzip)
and 15.25 KB CSS (4.29 KB gzip).

## Fresh live review

- The phone demo opened directly with two of four shapes matched, kept the
  exact persistent “Demo — sample data, nothing is saved” label, recovered
  from a wrong match, reset to the populated state, and retained seeded real
  license and room sentinels. Direct `/demo` traffic was same-origin and made
  no API request.
- A fresh desktop host created an invite and a fresh phone guest joined it.
  Both connected, completed Moon, Leaf, Star, and Ripple, and the host then
  reached the paid-puzzle lock. No console or page error occurred in that
  flow.
- In a dedicated service-worker context, `/demo` reloaded offline after first
  visit. Leaving demo showed the explicit Offline recovery state for live
  play. Reduced motion changed scroll behavior to `auto`.
- Keyboard Tab reached the skip link; Enter moved focus to `main`. Fresh home
  had `lang=en`, one `h1`, one `main`, and no console errors. Live Axe scans of
  home and demo found zero serious or critical violations. The one console
  error observed during the wider route run belonged to the deliberate 404
  request, not a normal load.
- `/`, `/demo`, `/privacy`, and `/terms` had their expected route-specific
  titles and one `h1`; required legal routes returned 200. The designed
  unknown route returned HTTP 404, as intended.
- A live 45-request same-client burst returned exactly 40×200 and 5×429. Each
  429 included `Retry-After: 1`; 50 health requests returned 200.
- Live headers include CSP, HSTS, `nosniff`, no-referrer, frame denial, and
  Permissions Policy. No normal-load third-party script, font, or request was
  observed. The demo has no account, room, or analytics request.

## Earlier findings

| Earlier finding | Current disposition |
| --- | --- |
| Verification 5: missing claims contract | Closed; seven exact claim commands now pass. |
| Verification 5: no one-click sample | Closed; cold first screen and `/demo` pass. |
| Verification 4: guest relay 404 | Closed; fresh desktop-host/phone-guest live flow passed. |
| Verification 4: 429 lacked `Retry-After` | Closed; live 40/5 test returned `Retry-After: 1`. |
| Verification 3: browser-trusted paid access | Closed; valid, forged, revoked, and unavailable cases pass. |
| Verification 3: active-game accessibility name | Closed; full-game claim and live Axe pass. |
| Verification 3: build identity | Closed; live identity and byte-matched asset build identify the source. |
| Verification 3: small targets and incomplete response policy | Closed; authored checks and live header/keyboard review pass. |

## External dependency

The Sociobot checkout registration URL still returns HTTP 404. This is the
recorded external billing-registration dependency. Paid puzzles remain gated;
no checkout success is claimed. It is not this review's finding.

## Evidence

The clean checkout was `/tmp/kindred-coop-review-1.6wz94Q`. Live endpoint,
desktop, phone, demo, co-op, offline, accessibility, route, header, and rate
checks were run on 2026-09-06. The required copy is at
`/work/.evidence/qa-report.md`.
