Status: LOCKED

# MyBoat Product Spec

## Product definition

MyBoat is a vessel-first platform for captains and crew who want one canonical home for:

- public boat identity
- authenticated vessel operations
- live telemetry snapshots
- passages and route memory
- geo-linked media and notes
- edge install and ingest-key management

This repo is the canonical successor to the earlier `loganrenz/myboat` starter work. The product now lives in one Nuxt 4 application at `apps/web/`, backed by the Narduk Nuxt layer for auth, D1, SEO, analytics, and Cloudflare-safe runtime conventions.

## Target users

- Owner-operators who want a private operations dashboard and a clean public boat profile
- Couples, crew, and families who need current location, install status, and passage history
- Technical boat owners running SignalK or adjacent onboard telemetry
- Future collaborators who need a stable schema and route system for telemetry, media, and public sharing

## Public vs private surfaces

### Public

- `/`
- `/:username`

Public surfaces must show only captain-approved identity, vessel summaries, and any live or historical context already marked public.

### Private

- `/login`
- `/register`
- `/dashboard`
- `/dashboard/onboarding`
- `/dashboard/vessels/[vesselSlug]`
- `/dashboard/installations/[installationId]`

Private surfaces are for vessel ownership, install configuration, ingest credentials, and internal telemetry views.

## Major feature areas

### 1. Captain profile

- one public username per authenticated user
- public headline, bio, and home port
- profile becomes the stable public entry point

### 2. Vessel identity

- a captain can define one or more vessels
- one vessel is marked primary
- vessel metadata includes name, type, home port, summary, and public-sharing flag

### 3. Live vessel state

- latest known telemetry snapshot is stored per vessel
- snapshot fields include fix, heading, speed, wind, depth, water temperature, battery voltage, and engine RPM
- snapshots are updated through `/api/ingest/v1/delta`

### 4. Install management

- installs represent real onboard or near-boat device deployments
- installs hold hostnames, SignalK stream URLs, connectivity state, event counts, and last-seen timestamps
- install pages can issue ingest keys tied to the install

### 5. Passages

- passages represent meaningful historical movement or voyage slices
- each passage can include summary copy, endpoints, distance, wind, and optional route geometry
- passages are historical context, not raw timeseries dumps

### 6. Media and annotations

- media items are geo-aware vessel memories tied to passages or places
- waypoints represent anchorages, landfalls, fuel stops, reefs, marinas, or notes

## Page inventory

- `/`: public product overview
- `/login`: branded auth entry
- `/register`: branded account creation
- `/dashboard`: operational overview
- `/dashboard/onboarding`: captain, vessel, and install setup
- `/dashboard/vessels/[vesselSlug]`: vessel detail
- `/dashboard/installations/[installationId]`: install and ingest key detail
- `/:username`: public captain profile

## Core flows

### Captain setup

1. Register or sign in.
2. Complete onboarding.
3. Lock the public handle.
4. Define the vessel.
5. Define the first install.
6. Land on vessel detail.

### Install activation

1. Open installation detail.
2. Generate an ingest key.
3. Copy the collector command template.
4. Point a collector or bridge service at `/api/ingest/v1/delta`.
5. Confirm live snapshot and last-seen updates on dashboard and vessel pages.

### Public sharing

1. Visit `/:username`.
2. View captain identity, vessel summaries, latest route context, and public install posture.
3. Move between the public profile and the private dashboard without route confusion.

## Domain model

- `public_profiles`: public captain handle and profile metadata
- `vessels`: captain-owned vessel records
- `vessel_installations`: onboard device installs
- `vessel_installation_api_keys`: mapping from install to layer-owned API keys
- `vessel_live_snapshots`: last known live state per vessel
- `passages`: voyage summaries and optional route geometry
- `waypoints`: geo-linked annotations and visited places
- `media_items`: geo-linked images and notes

## Branding and positioning

- calm, marine-aware, precise, operational
- not a generic SaaS dashboard
- not a consumer social network
- product language centers on captains, vessels, installs, telemetry, passages, and public profiles

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

## Acceptance criteria

- source repo product concepts are represented in the destination app
- Narduk auth, D1, mutation helpers, API-key hashing, SEO, and app shell conventions are canonical
- `/api/ingest/v1/delta` exists and updates install + live snapshot state
- no placeholder home/about/contact scaffold remains
- docs describe the real migrated product, not the provision brief
