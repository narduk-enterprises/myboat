# MyBoat Product Spec

Status: UNLOCKED

## Product definition

MyBoat is a vessel-first platform for captains and crew who want one canonical
home for:

- public boat identity
- authenticated captain operations
- live telemetry snapshots
- passages and route memory
- geo-linked media and notes
- one canonical live-data source per vessel at launch

This repo is the canonical successor to the earlier `loganrenz/myboat` starter
work. The product now lives in one Nuxt 4 application at `apps/web/`, backed by
the Narduk Nuxt layer for auth, D1, SEO, analytics, and Cloudflare-safe runtime
conventions. Identity is anchored to the shared Narduk auth authority, and the
app remains the canonical product surface for owner, public, and telemetry
views.

Launch scope is intentionally narrow:

- one captain
- one primary vessel
- one canonical live-data source for that vessel

The app still keeps `installation` in the data model, but installations are not
a first-class launch navigation object. Multi-vessel and multi-install
management are deferred until the single-vessel operator console is stable.

## Runtime architecture

- `https://mybo.at` is the canonical MyBoat app on Cloudflare Workers
- app-owned operational state lives in D1
- identity authority lives outside the app at `https://auth.nard.uk/auth/v1`
- `https://vps.nard.uk/auth/v1` remains the staging and rollback auth origin
- MyBoat keeps first-party app sessions and vessel data in its own app storage
- historical telemetry lands in InfluxDB on `narduk` / Linode
- D1 remains the operational store for captain, vessel, installation, sharing,
  heartbeat, latest-snapshot state, and connection-derived vessel identity
- owner and public live views consume MyBoat-managed live streams, not raw
  browser connections to SignalK or InfluxDB
- remote browsers load initial state from MyBoat APIs, then subscribe to
  MyBoat-native live updates for incremental changes
- the collector is responsible for speaking SignalK, discovering upstream vessel
  self identity, and delivering normalized MyBoat ingest payloads
- boats can also run a local MyBoat deployment on `myboat.local` or a similar
  LAN hostname; that local deployment serves the same MyBoat-shaped APIs and
  live stream while reading directly from onboard telemetry to reduce boat-side
  bandwidth

## Target users

- Owner-operators who want a private operations dashboard and a clean public
  boat profile
- Couples, crew, and families who need current location, install status, and
  passage history
- Technical boat owners running SignalK or adjacent onboard telemetry
- Future collaborators who need a stable schema and route system for a
  single-vessel launch product before broader fleet concepts return

## Public vs private surfaces

### Public

- `/`
- `/:username`
- `/:username/:vesselSlug`

Public surfaces must show only captain-approved identity, vessel summaries, and
any live or historical context already marked public.

### Private

- `/login`
- `/register`
- `/dashboard`
- `/dashboard/map`
- `/dashboard/fleet-friends`
- `/dashboard/settings`

Contextual and legacy private routes remain valid in this pass, but they are not
primary navigation:

- `/dashboard/onboarding`
- `/dashboard/vessels/[vesselSlug]`
- `/dashboard/installations/[installationId]`
- `/dashboard/settings/profile`
- `/dashboard/settings/security`
- `/dashboard/settings/preferences`
- `/dashboard/settings/sharing`

Private surfaces are for vessel ownership, install configuration, ingest
credentials, and internal telemetry views.

## Major feature areas

### 1. Captain profile

- one public username per authenticated user
- public headline, bio, and home port
- profile becomes the stable public entry point

### 2. Vessel identity

- launch supports one primary vessel per captain
- vessel identity is split into:
  - captain-managed profile fields:
    - public display name
    - vessel type label
    - home port
    - summary
    - public-sharing flag
  - observed connection-derived identity:
    - MMSI
    - observed vessel name
    - callsign
    - dimensions / beam / draft / length
    - ship type and other stable source metadata when available
- dashboard and install views should prefer observed identity for source-derived
  facts like MMSI instead of requiring manual entry
- manual entry is still valid for presentation, summary, and captain-confirmed
  overrides
- future multi-vessel management is explicitly deferred

### 3. Live vessel state

- latest known telemetry snapshot is stored per vessel
- snapshot fields include fix, heading, speed, wind, depth, water temperature,
  battery voltage, and engine RPM
- snapshots are updated through `/api/ingest/v1/delta`
- owner and public pages can subscribe to low-latency live updates sourced by
  MyBoat-managed fanout
- browsers must not depend on direct connections to a vessel's private SignalK
  websocket or raw InfluxDB endpoints
- the browser contract is always a MyBoat API plus a MyBoat-native live stream,
  whether the app is running at `mybo.at` or on a local boat hostname

### 4. Live-source management

- installs represent real onboard or near-boat device deployments
- installs hold hostnames, connectivity state, event counts, and last-seen
  timestamps
- install pages can issue ingest keys tied to the install
- one install is treated as the canonical live-data source for the vessel at
  launch
- installation selection and setup live inside vessel/settings workflows rather
  than acting as a first-class route family in the primary IA
- installs use a MyBoat collector delivered as a Docker image or similar onboard
  package
- the collector should discover and forward upstream self identity context and
  connection-derived vessel metadata when SignalK makes it available
- MyBoat does not store or expose user-managed SignalK websocket URLs as part of
  the product contract
- the collector may read local onboard telemetry, but once data enters MyBoat
  the product serves only MyBoat-native data shapes

### 5. Buddy boats

- captains can search AIS data and save a small set of buddy boats
- buddy boats live on one map-first private tool
- saved buddy boats can appear on public captain surfaces when enabled

### 6. Telemetry transport and storage

- a single collector path normalizes incoming telemetry before fanout or storage
- collector ingest is the canonical cloud entrypoint:
  `boat sensors / SignalK -> collector -> MyBoat ingest`
- live viewer updates and historical ingest happen in parallel from the same
  normalized stream
- D1 stores latest vessel state, install heartbeat, sharing flags, and other
  app-facing derived state
- D1 also stores the latest observed vessel identity and its provenance so
  dashboard and settings surfaces do not need to infer identity directly from
  raw live deltas
- InfluxDB stores time-series history and rollups for all boats
- public and dashboard clients read telemetry through MyBoat APIs and managed
  live channels, not through raw SignalK or raw Influx browser access
- local boat deployments can read directly from onboard telemetry, but they
  still expose the same MyBoat-shaped API contract to browsers

### 7. Passages

- passages represent meaningful historical movement or voyage slices
- each passage can include summary copy, endpoints, distance, wind, and optional
  route geometry
- passages are historical context, not raw timeseries dumps

### 8. Media and annotations

- media items are geo-aware vessel memories tied to passages or places
- waypoints represent anchorages, landfalls, fuel stops, reefs, marinas, or
  notes

### 9. Observed identity and overrides

- MyBoat should derive as much stable vessel identity as possible from the live
  connection instead of requiring operators to type it into the UI
- onboarding and settings should minimize manual entry for fields SignalK can
  reliably provide
- connection-derived identity should be presented as "observed from source" with
  last-observed timestamps
- captain-managed overrides remain the public presentation and correction layer
  when onboard identity is absent, wrong, or intentionally redacted

## Page inventory

- `/`: public product overview for logged-out visitors; logged-in visitors
  redirect to `/dashboard`
- `/login`: branded auth entry
- `/register`: branded account creation
- `/dashboard`: sticky live-header dashboard with one full-width chart and one
  fixed boat-stats panel for the active vessel
- `/dashboard/map`: dedicated live-ops chart with AIS traffic and diagnostics
- `/dashboard/fleet-friends`: buddy-boat monitoring and search/save workflow
- `/dashboard/settings`: canonical long-form captain settings surface
- `/:username`: public captain profile
- `/:username/:vesselSlug`: public vessel detail

Contextual and legacy pages remain in the product but outside the primary
authenticated IA:

- `/dashboard/onboarding`: temporary setup flow
- `/dashboard/vessels/[vesselSlug]`: contextual vessel detail
- `/dashboard/installations/[installationId]`: contextual install detail
- `/dashboard/settings/profile`
- `/dashboard/settings/security`
- `/dashboard/settings/preferences`
- `/dashboard/settings/sharing`

## Core flows

### Captain setup

1. Register or sign in.
2. Complete onboarding.
3. Lock the public handle.
4. Define the captain-managed vessel profile.
5. Define the first install.
6. Land on `/dashboard`.

### Install activation

1. Open settings or vessel context and reach the current installation detail.
2. Generate an ingest key.
3. Copy the collector command template.
4. Point the collector at `/api/ingest/v1/delta` and its local onboard telemetry
   source.
5. Confirm live snapshot, observed vessel identity, and last-seen updates on
   dashboard and vessel pages.
6. Allow the same normalized telemetry stream to feed both:
   - low-latency live viewing
   - historical storage in InfluxDB

### Public sharing

1. Visit `/:username`.
2. View captain identity, vessel summaries, latest route context, and public
   install posture.
3. Move between the public profile and the private dashboard without route
   confusion.

### Dashboard operations

1. Land on `/dashboard`.
2. Read the sticky live header for:
   - vessel name
   - MMSI from observed connection identity when available
   - latitude
   - longitude
   - apparent wind speed
   - SOG
   - heading
   - depth
3. Read the full-width chart sitting directly under the header.
4. Use the fixed boat-stats panel under the chart for the same core vessel
   readings.
5. Open `/dashboard/map` for full AIS traffic and issue context.
6. Open `Buddy Boats` when tracking other vessels matters.
7. Use `/dashboard/settings` for captain profile, vessel defaults, live-source
   setup, sharing, security, and local preferences.

The dashboard stats panel is fixed at launch. Per-user panel configurability is
explicitly deferred.

Dashboard identity behavior:

- MMSI and other source-derived identifiers should come from the observed vessel
  identity record
- `Pending` or equivalent placeholder copy is valid only until the collector has
  not yet observed identity for that vessel
- manual profile fields are fallback and presentation metadata, not the source
  of truth for MMSI

## Domain model

- `public_profiles`: public captain handle and profile metadata
- `vessels`: captain-owned vessel records
- `vessel_installations`: onboard device installs
- `vessel_installation_api_keys`: mapping from install to layer-owned API keys
- `vessel_live_snapshots`: last known live state per vessel
- `vessel_observed_identities`: latest connection-derived MMSI, observed name,
  callsign, dimensions, ship type, source context, and last-observed timestamps
- `followed_vessels`: saved buddy boats for captain surfaces
- `passages`: voyage summaries and optional route geometry
- `waypoints`: geo-linked annotations and visited places
- `media_items`: geo-linked images and notes

## Branding and positioning

- calm, marine-aware, precise, operational
- not a generic SaaS dashboard
- not a consumer social network
- product language centers on captains, vessels, installs, telemetry, passages,
  and public profiles

## SEO and public sharing strategy

- home page is indexable and product-level
- captain profile pages are indexable when public
- private dashboard and install pages must never be indexable
- structured data uses `useSeo()` plus `useWebPageSchema()`
- schema identity points at real MyBoat branding assets

## Out of scope for this migration

- rebuilding the old split cloud-web/edge-web/edge-api monorepo structure
- OTP auth or a second auth stack
- raw SignalK or raw Influx browser proxies
- giant marketing-site expansion unrelated to the product
- telemetry charts beyond the current live snapshot and passage framing
- multi-vessel launch navigation
- multi-install launch navigation

## Acceptance criteria

- source repo product concepts are represented in the destination app
- Narduk auth, D1, mutation helpers, API-key hashing, SEO, and app shell
  conventions are canonical
- the spec reflects the external Narduk auth authority and rollback hostname
- the spec reflects InfluxDB as historical time-series storage and D1 as the
  operational state store
- the spec reflects connection-derived vessel identity as app-owned operational
  state, not a browser concern
- logged-in visits to `/` redirect to `/dashboard`
- `/api/ingest/v1/delta` exists and updates install + live snapshot state
- `/api/ingest/v1/delta` is capable of carrying collector-normalized self
  identity context alongside telemetry
- owner and public vessel pages read live deltas through MyBoat-managed live
  routes, not raw SignalK browser sockets
- dashboard identity surfaces do not depend on manual MMSI entry when the
  collector can discover it from the connection
- no placeholder home/about/contact scaffold remains
- docs describe the real migrated product, not the provision brief
