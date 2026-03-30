# MyBoat

Canonical home for the migrated MyBoat platform.

This repo is the structured successor to `loganrenz/myboat`. The source repo’s
real vessel-platform work has been normalized into the Narduk Nuxt workspace so
the product can evolve on one coherent foundation instead of a split cloud/edge
scaffold.

MyBoat is now the only system that boats and browsers talk to. Boat-side
collectors ingest telemetry into MyBoat, MyBoat normalizes and stores canonical
vessel state in D1 plus historical telemetry in InfluxDB, and browsers consume
only MyBoat APIs and MyBoat-managed live streams. Boats can also run a
boat-local deployment on `myboat.local` or a similar LAN hostname while keeping
the same browser-facing contract.

MyBoat now also de-duplicates overlapping SignalK sources before live fanout and
history writes. The collector and cloud ingest both run the same shared
source-selection policy, and duplicate losers stay only in short-lived debug
telemetry instead of inflating the canonical live or history stream.

## What Lives Here

- `apps/web/`: the shipped Nuxt 4 product
- `apps/edge-collector/`: the SignalK collector runtime for cloud ingest
- `layers/narduk-nuxt-layer/`: shared platform layer used by the app
- `packages/eslint-config/`: repo guardrails and lint plugins
- `packages/telemetry-source-policy/`: shared canonical source-selection policy
  for the collector and cloud ingest
- `tools/` and `scripts/`: workspace automation

## Product Surfaces

- `/`: public product overview
- `/login` and `/register`: branded auth entry points
- `/dashboard`: authenticated vessel operations overview
- `/dashboard/passages`: dedicated captain passage workspace
- `/dashboard/onboarding`: captain, vessel, and install setup
- `/dashboard/vessels/[vesselSlug]`: live + historical vessel detail
- `/dashboard/vessels/[vesselSlug]/passages`: vessel-scoped passage workspace
- `/dashboard/installations/[installationId]`: install and ingest-key management
- `/:username`: public captain profile
- `/:username/:vesselSlug`: public vessel detail
- `/:username/:vesselSlug/passages`: public vessel passage log
- `/api/ingest/v1/delta`: collector ingest endpoint for source-aware telemetry,
  observed vessel identity, and installation keys
- `/api/ingest/v1/identity`: collector ingest endpoint for observed vessel
  identity
- `/api/ingest/v1/sources`: collector ingest endpoint for normalized SignalK
  source inventory
- `/api/app/vessels/[vesselSlug]/history`: owner history API
- `/api/app/vessels/[vesselSlug]/telemetry/sources`: owner source diagnostics
- `/api/public/[username]/[vesselSlug]/history`: public history API

## Tideye Flagship Demo

- The seeded passage workspace now includes a compact Tideye flagship demo
  import stored in MyBoat-owned D1 data.
- Demo playback lives in `passages.playback_json` plus `passage_ais_vessels`,
  and is served only through MyBoat-owned endpoints:
  - `GET /api/app/passages/[passageId]/playback`
  - `GET /api/public/[username]/[vesselSlug]/passages/[passageId]/playback`
- Captain and public passage pages use that compact import to drive playback,
  timeline scrubbing, and nearby-traffic replay without exposing Tideye or
  Influx directly to the browser.
- This is a temporary flagship/demo migration. The long-term historical model
  for playback bundles and AIS enrichment still needs a dedicated MyBoat-owned
  design.

## Local Development

```bash
pnpm install
doppler setup --project myboat --config dev
pnpm run db:migrate
pnpm dev
```

`pnpm dev` boots the full local stack:

- local D1 migrate + seed
- Cloudflare dev-binding verification
- the vessel live broker worker and Durable Object on `127.0.0.1:8791`
- the Nuxt app on `http://127.0.0.1:${NUXT_PORT:-3000}`

To simulate live boat traffic from the public Tideye SignalK stream through the
collector container:

```bash
doppler setup --project myboat --config dev
MYBOAT_INGEST_KEY=nk_replace_me pnpm run dev:collector:tideye
```

Useful commands:

```bash
pnpm --filter web run db:verify
pnpm --filter web run quality
pnpm run quality
pnpm run test:e2e:web
MYBOAT_INGEST_KEY=nk_replace_me MYBOAT_PUBLISHER_ROLE=shadow ./scripts/deploy-bee-consumer.sh
```

## Migration Decisions

### Preserved from `loganrenz/myboat`

- public captain handle and vessel profile model
- installation and ingest-key concept
- live vessel snapshot concept
- passage, map, media, and waypoint framing
- marine unit conversion and telemetry vocabulary

### Adopted from the Narduk stack

- single `apps/web` canonical product app
- layer auth/session helpers
- D1 + Drizzle app-owned schema pattern
- shared API key hashing/storage
- shared mutation wrappers
- shared SEO, Schema.org, analytics, and MapKit patterns
- Nuxt UI 4 design-token discipline and workspace quality gates

### Explicitly dropped

- split `cloud-web` / `edge-web` / `edge-api` architecture inside this repo
- placeholder scaffold home/about/contact surfaces
- OTP auth as a parallel auth path
- separate MapKit loader and ad hoc fetch/auth composables
- unused demo assets and template residue

## Docs

- [SPEC.md](./SPEC.md)
- [UI_PLAN.md](./UI_PLAN.md)
- [CONTRACT.md](./CONTRACT.md)
- [Architecture](./docs/architecture.md)
- [Operations Guide](./docs/agents/operations.md)
- [Collector README](./apps/edge-collector/README.md)

## Template Maintenance

When the base template evolves, keep this repo current with:

```bash
pnpm run sync-template -- --from ~/new-code/narduk-nuxt-template
pnpm run update-layer -- --from ~/new-code/narduk-nuxt-template
```
