# MyBoat Status Snapshot

Generated: 2026-03-29 07:28:56 CDT

This snapshot summarizes the current state of the MyBoat stack across the
official boat install (`tideyebee`), the `narduk` Linode host, the live public
app, and the local workspace after the changes made this morning.

## Executive Summary

- `tideyebee` is still the canonical onboard MyBoat install and SignalK source.
- The remote proving rig on `narduk` (`myboat-edge-canary`) is healthy and is
  actively forwarding live SignalK deltas into MyBoat ingest.
- The live public app is currently `https://mybo.at`, not `https://my.boat`.
- `https://mybo.at` is reachable and serving the public vessel detail route, but
  the new public history catalog endpoint is not live there yet.
- The newest history and telemetry-source work is healthy locally but is not
  fully deployed.

## Current Status By Surface

- **`tideyebee` / Bee**: Green. Infra runbooks still define `tideyebee` as the
  canonical onboard install and primary publisher. Bee remains the source of
  truth for live boat telemetry.
- **`signalk-public.tideye.com`**: Green. Resolves to `173.255.193.57` via
  `vps.tideye.com`. The remote collector is connected to
  `wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all`.
- **`influx-public.tideye.com`**: Green. `/health` returned `200` with InfluxDB
  `v2.7.11`, message `ready for queries and writes`.
- **`narduk` Linode host**: Green. Host docs still show `173.255.193.57` public
  IP and `100.100.231.109` Tailscale IP. `myboat-edge-canary` is up and healthy.
- **`myboat-edge-canary` on `narduk`**: Green. At check time it was
  `Up 31 minutes (healthy)`. Health payload reported `connectedToSignalK: true`,
  `ingestFailures: 0`, and `lastPostSucceededAt: 2026-03-29T12:25:15.263Z`.
  Recent logs showed continuous delta forwarding.
- **Live public app `https://mybo.at`**: Yellow. Fleet registry and
  `narduk fleet doctor myboat` both report the live app URL as
  `https://mybo.at`, reachable with HTTP `200`, build version `05c31e8e73f8`,
  build time `2026-03-29T11:57:50.898Z`, app version `1.17.2`.
- **Public vessel detail API**: Green.
  `GET https://mybo.at/api/public/narduk/tideye` returned `200` and the seeded
  public vessel payload.
- **Public history catalog API**: Yellow.
  `GET https://mybo.at/api/public/narduk/tideye/history/catalog` returned `404`.
  The route exists locally and passes local smoke, so the new history API is not
  fully live on the public app yet.
- **`my.boat` domain**: Red. `dig +short my.boat A` returned no result from this
  machine, and `curl https://my.boat/...` failed with `Could not resolve host`.
- **Local workspace**: Green. `/Users/narduk/new-code/template-apps/myboat` is
  clean on branch `codex/passage-media-map-pins`, ahead of
  `origin/codex/passage-media-map-pins` by 1 commit.
- **Local telemetry smoke**: Green. `pnpm run smoke:telemetry:local` passed
  against local app `http://127.0.0.1:3300`, local collector
  `ws://127.0.0.1:4012/myboat/v1/stream`, and local Influx
  `http://127.0.0.1:18086`.

## What Changed In The Last Couple Hours

### 2026-03-29 06:49:02 CDT

Commit `0243db4` on `origin/codex/passage-media-map-pins` added:

- passage media import APIs and review queue
- map photo pins and passage timeline/media UI updates
- new media review schema migration
- the `tools/myboat-photo-seed` Swift helper

### 2026-03-29 07:02:02 CDT

Local-only commit `862dea3` added:

- telemetry source deduplication policy package
- new ingest source inventory endpoint
- owner and public history APIs plus history catalog endpoints
- Influx-backed history utilities
- `myboat-edge-canary` deploy assets and local telemetry smoke scripts
- local Influx bootstrap script

## Deployment State Of Those Changes

- The current local branch is ahead of origin by 1 commit, which is
  `862dea3 Add telemetry source deduplication and production history ingest`.
- There is no open PR for `codex/passage-media-map-pins` in
  `narduk-enterprises/myboat`.
- The currently live public build reports build time `2026-03-29T11:57:50.898Z`.
- That live build time is after local commit `0243db4` (`11:49:02Z`) and before
  local commit `862dea3` (`12:02:02Z`).
- The live build version `05c31e8e73f8` is not present in the local git history,
  so the exact deployed commit cannot be mapped from this checkout.
- Practical outcome: the passage-media work may be partially live, but the new
  history/catalog API work is not fully deployed on `mybo.at`.

## Local Validation Results

- Web targeted tests

  ```bash
  pnpm --filter web exec vitest run \
    tests/server/liveRoute.test.ts \
    tests/server/history.test.ts \
    tests/server/telemetry.test.ts \
    tests/server/telemetrySourcePolicy.test.ts \
    tests/server/telemetrySources.test.ts
  ```

  Result: passed, 5 files, 24 tests.

- `pnpm --filter @myboat/edge-collector test` passed: 1 suite, 1 test.
- `pnpm run smoke:telemetry:local` passed with:
  - owner history points: `2`
  - public catalog series: `20`
  - logs saved under `.data/smoke-telemetry/`

## Recently Created Upstream Issues

These were created today in `narduk-enterprises/narduk-nuxt-template`:

- Issue `#29`
  `Root AGENTS references missing apps/web/AGENTS.md in downstream apps`
  Created: `2026-03-29T11:41:38Z` Status: open Current state here: reproduced.
  The root
  [AGENTS.md](/Users/narduk/new-code/template-apps/myboat/AGENTS.md#L30) points
  to `apps/web/AGENTS.md`, but that file is absent in this checkout.
- Issue `#28`
  `Cloudflare image config emits duplicate provider warning at deploy time`
  Created: `2026-03-29T10:49:12Z` Status: open Current state here: likely still
  applicable.
  [apps/web/nuxt.config.ts](/Users/narduk/new-code/template-apps/myboat/apps/web/nuxt.config.ts#L161)
  still sets `image.cloudflare.baseURL`, matching the issue description.
- Issue `#27` `dev:kill should reclaim the local broker port used by web dev`
  Created: `2026-03-29T10:09:58Z` Status: open Current state here: locally
  worked around already.
  [scripts/dev-kill.sh](/Users/narduk/new-code/template-apps/myboat/scripts/dev-kill.sh#L7)
  now includes port `8791`.

No issues created today were found in `narduk-enterprises/myboat`.

## Operational Notes

- `caddy` on `narduk` had restarted recently and was `Up 3 minutes` at the last
  check, but the public app was still reachable during the same window.
- The `myboat-edge-canary` health payload showed successful live publishing but
  also retained older source inventory failure counters. The tail of current
  container logs during this check showed continuous successful delta forwards
  and no fresh ingest failures.

## Recommended Next Steps

1. Decide whether the canonical public domain should be `mybo.at` or `my.boat`,
   then align DNS and fleet metadata. Right now the live fleet registry says
   `mybo.at`, while `my.boat` does not resolve.
2. If the new public history/catalog API should be live now, deploy the current
   history commit or otherwise roll the app to a build that includes those
   routes.
3. Open a PR for `codex/passage-media-map-pins` if this branch is the intended
   rollout vehicle. At the moment the newest commit is still local-only.
4. Close or update upstream issue `#27` if the local `8791` broker-port fix is
   the final intended template behavior.
5. Consider adding a dedicated `narduk` command for this workflow, for example
   `narduk myboat status`, to combine fleet URL/build checks, Linode collector
   health, Tideye SignalK reachability, Influx health, and local smoke status
   into one report.
