Status: LOCKED

# MyBoat Product Contract

## Canonical route contract

### Pages

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/dashboard/onboarding`
- `/dashboard/vessels/[vesselSlug]`
- `/dashboard/installations/[installationId]`
- `/:username`

### API routes

- `GET /api/app/dashboard`
- `POST /api/app/onboarding`
- `GET /api/app/vessels/[vesselSlug]`
- `GET /api/app/installations/[installationId]`
- `POST /api/app/installations/[installationId]/keys`
- `POST /api/ingest/v1/delta`
- `GET /api/public/[username]`

## Page composition requirements

### `/`

- branded hero
- capability cards
- product workflow summary

### `/dashboard`

- hero
- top stats row
- vessel cards
- map panel
- passage panel
- install readiness panel
- recent media/public moments panel

### `/dashboard/onboarding`

- explanatory intro
- single canonical setup form

### `/dashboard/vessels/[vesselSlug]`

- hero
- map panel
- live metric grid
- passage timeline
- media strip
- install links card

### `/dashboard/installations/[installationId]`

- hero
- installation credential panel

### `/:username`

- captain identity hero
- public vessel cards
- public map
- public install readiness section

## Naming rules

- use `vessel`, not `boat` or `install` interchangeably inside the same feature
- use `installation` for device deployments
- use `public profile` for `/:username`
- use `captain` for the human owner/operator identity
- route params must stay descriptive: `[vesselSlug]`, `[installationId]`,
  `[username]`

## Platform rules

- auth uses the Narduk layer session/auth routes only
- app-owned schema lives in `apps/web/server/database/app-schema.ts`
- app routes use `#server/` imports inside `server/`
- state-changing routes use shared mutation helpers
- public/private page SEO must use `useSeo()` and `useWebPageSchema()`
- page data loading uses `useFetch()` or `useAsyncData()`

## Theme rules

- one marine-aware palette
- one shell
- one card system
- no parallel legacy gray utility styling from the source repo
- no scaffold N4 branding or generic placeholder links

## Analytics expectations

- keep the layer analytics hooks available
- do not introduce a parallel analytics stack
- public/profile/dashboard pages should remain compatible with the shipped
  PostHog and GA hooks

## SEO rules

- public pages can be indexed
- dashboard/auth/install pages are private and should not be treated as public
  SEO surfaces
- schema identity must use real MyBoat assets

## Migration completeness criteria

- source product concepts exist in destination routes and schema
- destination layer primitives are reused instead of duplicated
- install keys are tied to installations through the layer API-key table
- ingest route updates live snapshot and installation status
- placeholder README/spec/contract/ui-plan content is gone
- scaffold-only routes and demo assets are removed

## Anti-drift rules

- do not reintroduce separate cloud-web and edge-web apps inside this repo
- do not add another auth, session, or API-key implementation
- do not bypass the app-owned schema with ad hoc JSON files for core product
  data
- do not add raw SignalK or raw Influx browser proxies
- do not create new pages that compete with existing vessel/install/public
  profile terminology
