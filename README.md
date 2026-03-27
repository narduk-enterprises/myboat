# MyBoat

Canonical home for the migrated MyBoat platform.

This repo is the structured successor to `loganrenz/myboat`. The source repo’s real vessel-platform work has been normalized into the Narduk Nuxt workspace so the product can evolve on one coherent foundation instead of a split cloud/edge scaffold.

## What Lives Here

- `apps/web/`: the shipped Nuxt 4 product
- `layers/narduk-nuxt-layer/`: shared platform layer used by the app
- `packages/eslint-config/`: repo guardrails and lint plugins
- `tools/` and `scripts/`: workspace automation

## Product Surfaces

- `/`: public product overview
- `/login` and `/register`: branded auth entry points
- `/dashboard`: authenticated vessel operations overview
- `/dashboard/onboarding`: captain, vessel, and install setup
- `/dashboard/vessels/[vesselSlug]`: live + historical vessel detail
- `/dashboard/installations/[installationId]`: install and ingest-key management
- `/:username`: public captain profile
- `/api/ingest/v1/delta`: SignalK-style ingest endpoint for installation keys

## Local Development

```bash
pnpm install
pnpm --filter web run db:migrate
doppler setup --project myboat --config dev
pnpm --filter web run dev
```

Useful commands:

```bash
pnpm --filter web run db:verify
pnpm --filter web run quality
pnpm run quality
pnpm run test:e2e:web
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

- [SPEC.md](/Users/narduk/Downloads/myboat-main/SPEC.md)
- [UI_PLAN.md](/Users/narduk/Downloads/myboat-main/UI_PLAN.md)
- [CONTRACT.md](/Users/narduk/Downloads/myboat-main/CONTRACT.md)

## Template Maintenance

When the base template evolves, keep this repo current with:

```bash
pnpm run sync-template -- --from ~/new-code/narduk-nuxt-template
pnpm run update-layer -- --from ~/new-code/narduk-nuxt-template
```
