# MyBoat Product Contract

Status: UNLOCKED

## Canonical route contract

### Pages

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/dashboard/map`
- `/dashboard/passages`
- `/dashboard/fleet-friends`
- `/dashboard/settings`
- `/dashboard/onboarding`
- `/dashboard/vessels/[vesselSlug]`
- `/dashboard/vessels/[vesselSlug]/passages`
- `/dashboard/installations/[installationId]`
- `/dashboard/settings/profile`
- `/dashboard/settings/security`
- `/dashboard/settings/preferences`
- `/dashboard/settings/sharing`
- `/:username`
- `/:username/:vesselSlug`
- `/:username/:vesselSlug/passages`

### API routes

- `GET /api/app/dashboard`
- `POST /api/app/onboarding`
- `GET /api/app/vessels/[vesselSlug]`
- `POST /api/app/vessels/[vesselSlug]/media/import`
- `PATCH /api/app/vessels/[vesselSlug]/media/[mediaId]`
- `GET /api/app/passages/[passageId]/playback`
- `GET /api/app/vessels/[vesselSlug]/live`
- `GET /api/app/installations/[installationId]`
- `POST /api/app/installations/[installationId]/keys`
- `POST /api/ingest/v1/delta`
- `POST /api/ingest/v1/identity`
- `POST /api/ingest/v1/sources`
- `GET /api/app/vessels/[vesselSlug]/history`
- `GET /api/app/vessels/[vesselSlug]/history/catalog`
- `GET /api/app/vessels/[vesselSlug]/telemetry/sources`
- `GET /api/public/[username]`
- `GET /api/public/[username]/[vesselSlug]`
- `GET /api/public/[username]/[vesselSlug]/history`
- `GET /api/public/[username]/[vesselSlug]/history/catalog`
- `GET /api/public/[username]/[vesselSlug]/live`
- `GET /api/public/[username]/[vesselSlug]/passages/[passageId]/playback`

## Page composition requirements

### `/`

- branded hero
- capability cards
- product workflow summary
- logged-in requests redirect to `/dashboard`

### `/dashboard`

- sticky live header
- full-width half-height map
- fixed boat-stats panel
- header fields:
  - vessel name
  - MMSI
  - latitude
  - longitude
  - apparent wind speed
  - SOG
  - heading
  - depth
- stats-panel fields:
  - vessel name
  - MMSI
  - latitude
  - longitude
  - apparent wind speed
  - SOG
  - heading
  - depth
- no per-user dashboard-panel configurability yet
- dashboard MMSI and other source-derived identifiers must come from observed
  connection identity when available
- `Pending` or equivalent placeholder copy is valid only before the collector
  has observed source identity for the vessel

### `/dashboard/map`

- hero
- large operational chart
- AIS traffic with selected-contact detail
- compact diagnostics panel
- deeper live metric board

### `/dashboard/passages`

- hero
- vessel switcher when multiple vessels exist
- dedicated passage workspace
- searchable and sortable passage rail
- passage-focused map panel
- playback theater with scrubber and rate controls when a bundle exists
- nearby AIS contact panel driven by compact stored traffic samples
- shared media strip

### `/dashboard/fleet-friends`

- route header
- search-and-save controls
- map-first buddy-boat search surface
- saved buddy boats list and saved boats map

### `/dashboard/onboarding`

- explanatory intro
- single canonical setup form

### `/dashboard/vessels/[vesselSlug]`

- hero
- map panel
- live metric grid
- passage timeline with attached media galleries
- owner-only review queue for ambiguous media imports
- general vessel media strip for unattached items
- install links card

### `/dashboard/vessels/[vesselSlug]/passages`

- hero
- local vessel live/passages switcher
- dedicated vessel passage workspace
- searchable and sortable passage rail
- passage-focused map panel
- playback theater with scrubber and rate controls when a bundle exists
- nearby AIS contact panel driven by compact stored traffic samples
- shared media strip

### `/dashboard/installations/[installationId]`

- hero
- installation credential panel
- observed identity panel

### `/dashboard/settings`

- hero
- captain profile section
- captain-managed vessel profile section
- observed connection identity section
- collector setup section
- sharing section
- security section
- local preferences section

### `/:username`

- captain identity hero
- public vessel cards
- public map
- public install readiness section

### `/:username/:vesselSlug`

- vessel hero
- public live data board
- public map
- public route and media context

### `/:username/:vesselSlug/passages`

- public vessel hero
- dedicated public passage workspace
- searchable and sortable public passage rail
- passage-focused public map
- read-only playback theater when a public bundle exists
- public nearby-traffic panel sourced from compact stored AIS samples
- public media strip

## Naming rules

- use `vessel`, not `boat` or `install` interchangeably inside the same feature
- use `installation` for device deployments
- use `public profile` for `/:username`
- use `captain` for the human owner/operator identity
- use `Buddy Boats` as the user-facing label for `/dashboard/fleet-friends`
- route params must stay descriptive: `[vesselSlug]`, `[installationId]`,
  `[username]`

## Platform rules

- auth uses the Narduk layer session/auth routes only
- app-owned schema lives in `apps/web/server/database/app-schema.ts`
- app routes use `#server/` imports inside `server/`
- state-changing routes use shared mutation helpers
- public/private page SEO must use `useSeo()` and `useWebPageSchema()`
- page data loading uses `useFetch()` or `useAsyncData()`
- browsers read only MyBoat-owned APIs and MyBoat-owned live routes
- D1 is the operational state store; InfluxDB is the historical telemetry store
- v1 passage workspace reads only MyBoat-owned D1 passage summaries, stored
  `track_geojson`, compact `playback_json`, and `passage_ais_vessels`
- the seeded Tideye flagship playback import is allowed only as demo content
  after it has been copied into MyBoat-owned D1 rows and served by MyBoat-owned
  endpoints
- future playback or AIS passage enrichments must stay MyBoat-owned compact
  bundles in D1 and/or R2, generated server-side from Influx history
- connection-derived vessel identity is app-owned operational state and must not
  require browser-side SignalK parsing
- `POST /api/ingest/v1/delta` accepts collector-normalized batched deltas with
  `context`, `self`, `publisherRole`, update `$source`, update `source`, and
  collector `receivedAt`
- `POST /api/ingest/v1/identity` accepts collector-derived observed self
  identity from SignalK bootstrap / refresh reads
- `POST /api/ingest/v1/sources` accepts normalized SignalK source inventory for
  the authenticated installation
- collector and cloud ingest both run the same canonical source-selection
  policy; the collector is the load-reduction point and cloud ingest is the
  safety gate
- owner and public history reads go through the MyBoat history routes and
  series catalog routes instead of raw browser Flux
- owner source diagnostics go through
  `GET /api/app/vessels/[vesselSlug]/telemetry/sources`
- local boat deployments may read onboard telemetry directly, but they must
  expose the same MyBoat-shaped browser contract as `mybo.at`

## Identity and telemetry data rules

- Captain-managed vessel profile and observed connection identity are distinct
  data categories.
- Captain-managed vessel profile is for:
  - public display name
  - summary
  - home port
  - sharing posture
  - captain-confirmed overrides
- Observed connection identity is for:
  - MMSI
  - observed vessel name
  - callsign
  - dimensions / beam / draft / length
  - ship type and source context metadata
  - last-observed timestamps and provenance
- Dashboard, vessel, and installation reads should expose observed identity
  separately from manual profile fields or provide equivalent resolved fields
  with source provenance.
- Browsers do not derive MMSI or vessel identity directly from raw SignalK.
- Live AIS updates are partial by nature; broker/store handling must preserve
  last known non-null values when sparse upserts arrive.
- Only canonical source winners may update the live snapshot, live broker,
  curated `core` history, or curated `detail` history.
- Duplicate losers are retained only in short-lived debug telemetry and source
  diagnostics.
- Owner source diagnostics return `latestSourceInventory`,
  `duplicateHotspots`, `currentWinners`, `policyVersion`,
  `primaryInstallation`, and `shadowPublisherSeen`.
- Shadow publishers must never replace a fresh primary winner in canonical
  output.
- media items can attach to passages or remain general vessel media.
- media items support per-item public visibility.
- public vessel reads return only media where `share_public = true`.
- review-queue media remains owner-only until a captain confirms it.

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
- do not make browsers call Tideye playback endpoints or Tideye-owned storage
- do not add filesystem-backed playback fallbacks inside Worker-serving code
- do not create new pages that compete with existing vessel/install/public
  profile terminology
- do not reintroduce installation-first primary navigation for launch
