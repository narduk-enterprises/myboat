# MyBoat UI Plan

Status: UNLOCKED

## UI foundation lock

- Public landing and shareable public routes can keep the strongest branded hero
  treatments and wider atmospheric spacing.
- Auth routes stay branded, but they should remain task-first and compact enough
  to keep the form and the next action in the first viewport.
- Admin, settings, passages, buddy-boat, and other operational routes follow a
  utility-first presentation rule:
  - compact masthead
  - one-sentence route framing
  - tight action cluster
  - no billboard-style decorative backdrop as the dominant first-view element
- Operational routes should spend the first viewport on active context and
  decisions, not promotional copy or oversized ambient chrome.
- Desktop default for geospatial and history workspaces is split layout:
  - one large active canvas for map or playback
  - one adjacent companion area for selection detail, missing-data summary, and
    next actions
- Tall stacked sections are not the default for active inspection routes. Favor
  side-by-side workspace composition before long vertical rails.
- Large map and playback surfaces must define partial-data behavior:
  - reduce visual height when data is sparse
  - keep missing-data summary near the canvas
  - keep off-map or unavailable items in a structured panel or list, not loose
    chips detached below the workspace
- Operational routes must show title, key action, and primary operational
  context above the fold on desktop.

## Shell model

- One public shell for marketing and shareable routes.
- One authenticated dashboard shell for captain operations.
- One admin shell for system and moderation work.
- Public and private vessel pages should feel related, but the private vessel
  page is denser and more operational.
- Dashboard and admin shells should feel like operator tools first. Decorative
  framing is subordinate to navigation, current status, and task context.
- The authenticated shell has one primary navigation model:
  - desktop: persistent left sidebar
  - mobile: bottom nav with the same core destinations
  - top header: brand, account, and context actions only
- Operator side rails prioritize compact navigation, current route context, and
  lightweight signed-in status. Large promo-style rail blocks are not the
  default pattern for utility routes.

## Route hierarchy

### Public

- `/`
- `/:username`
- `/:username/:vesselSlug`
- `/:username/:vesselSlug/passages`

### Auth

- `/login`
- `/register`
- `/reset-password`
- `/auth/callback`
- `/auth/confirm`
- `/logout`

### Captain dashboard

- `/dashboard`
- `/dashboard/map`
- `/dashboard/passages`
- `/dashboard/fleet-friends`
- `/dashboard/settings`

### Contextual and legacy captain routes

- `/dashboard/onboarding`
- `/dashboard/vessels/[vesselSlug]`
- `/dashboard/vessels/[vesselSlug]/passages`
- `/dashboard/installations/[installationId]`
- `/dashboard/settings/profile`
- `/dashboard/settings/security`
- `/dashboard/settings/preferences`
- `/dashboard/settings/sharing`

### Admin

- `/admin`
- `/admin/users`
- `/admin/vessels`
- `/admin/installations`
- `/admin/telemetry`
- `/admin/system`

## Global navigation

- Public header nav:
  - logged out: `Home`, `Explore`, `Create account`
  - logged in: brand plus a reduced public nav; dashboard destinations live in
    the account menu instead of the public header
- Dashboard nav:
  - `Dashboard`
  - `Live Map`
  - `Passages`
  - `Buddy Boats`
  - `Settings`
  - admin entry only for admins and only as an extra item
- Dashboard header must not duplicate dashboard route buttons.
- Onboarding is not primary navigation; show it only as a contextual action when
  setup is incomplete.
- Vessel, installation, and settings-subpages should use local in-page
  navigation and action links rather than a second competing global subnav.
- Operator routes should avoid using the route header as a second marketing
  surface. Keep the first-view hierarchy tight and task-oriented.
- Admin routes should have a distinct but minimal nav:
  - `Overview`
  - `Users`
  - `Vessels`
  - `Installations`
  - `Telemetry`
  - `System`

## Route plans

### `/`

- Purpose:
  - acquisition and product framing for logged-out visitors
  - logged-in visitors redirect to `/dashboard`
- Primary sections:
  - hero
  - capability cards
  - workflow summary
  - trust or proof strip
- Primary CTA:
  - create account
- Secondary CTA:
  - sign in
- Loading:
  - normal page load only
- Empty:
  - none
- Error:
  - standard site error route

### `/login`

- Purpose:
  - captain sign-in with Narduk auth-backed identity flow
- Primary sections:
  - login form
  - provider buttons when enabled
  - reset password link
- Primary CTA:
  - sign in
- Secondary CTA:
  - create account
- Error:
  - inline auth failure state

### `/register`

- Purpose:
  - create a captain account and enter the product
- Primary sections:
  - registration form
  - provider buttons when enabled
  - trust or expectation copy
- Primary CTA:
  - create account
- Secondary CTA:
  - sign in
- Error:
  - inline validation and signup failure state

### `/reset-password`

- Purpose:
  - request password reset and complete the reset flow
- Primary sections:
  - reset request form
  - reset confirmation state
- Primary CTA:
  - send reset link
- Error:
  - invalid or expired token messaging when applicable

### `/auth/callback`

- Purpose:
  - utility route for auth provider return and session exchange
- UI behavior:
  - transient progress state
  - success redirect
  - terminal failure alert when exchange fails

### `/auth/confirm`

- Purpose:
  - utility route for auth confirmation and email verification outcomes
- UI behavior:
  - success confirmation
  - retry or support path on failure

### `/logout`

- Purpose:
  - terminate session and route the user back to public entry
- UI behavior:
  - brief progress state then redirect

### `/dashboard`

- Purpose:
  - captain home for the single-vessel launch product
- Primary sections:
  - compact sticky live header
  - full-width map at roughly half-height
  - one fixed boat-stats panel under the map
- Sticky header fields:
  - vessel name
  - MMSI
  - latitude
  - longitude
  - apparent wind speed
  - SOG
  - heading
  - depth
- Stats panel fields:
  - vessel name
  - MMSI
  - latitude
  - longitude
  - apparent wind speed
  - SOG
  - heading
  - depth
- Behavior:
  - the route-level captain hero is removed
  - the left sidebar keeps only nav links; the old owner-board promo panel is
    removed
  - the stats panel is fixed at launch and not user-configurable yet
  - MMSI and other source-derived identifiers come from observed connection
    identity, not manual vessel-form entry
  - when no observed identity exists yet, show an explicit pending / unavailable
    state tied to collector discovery rather than implying the user must type
    the value in
- Empty:
  - no captain setup yet
  - no vessel yet
  - no live telemetry yet
- Error:
  - dashboard fetch alert with preserved shell

### `/dashboard/map`

- Purpose:
  - deep live-ops map for the active vessel
- Primary sections:
  - compact operational masthead
  - split desktop workspace with the operational chart as the primary canvas
  - adjacent AIS traffic detail and compact diagnostics
  - deeper live metric board than `/dashboard`
- Primary CTA:
  - open contextual vessel or installation detail
- Secondary CTA:
  - return to `/dashboard`
  - open settings
- Behavior:
  - the route intro stays compact and must not consume most of the first
    viewport
  - selected-contact detail and "what is wrong right now" context should stay
    visible near the chart on desktop
- Empty:
  - no vessel yet
  - no live source linked yet
  - no stored live fix yet
- Error:
  - dashboard shell preserved with map-specific error state

### `/dashboard/fleet-friends`

- Purpose:
  - buddy-boat tracking workspace
- Primary sections:
  - compact operational masthead
  - split desktop workspace with the map as the primary canvas
  - persistent companion panel for selected buddy-boat details
  - manage/search controls for saving, refreshing, and removing boats
  - structured off-map list and missing-coordinate summary
- Primary CTA:
  - manage buddy boats
- Secondary CTA:
  - return to dashboard
- Behavior:
  - desktop keeps the selected buddy boat, missing-coordinate counts, and manage
    state visible near the map
  - sparse map data must read as a partial-state workflow, not a large blank
    canvas
  - off-map boats should remain in a structured companion area instead of loose
    chips detached below the map
- Empty:
  - no saved buddy boats yet
  - no mapped boats yet
- Error:
  - search or workspace failure alert

### `/dashboard/onboarding`

- Purpose:
  - create or finish the canonical first-time setup
- Primary sections:
  - captain identity
  - captain-managed vessel profile
  - installation and collector setup
  - observed identity preview when a collector has already reported source data
- Primary CTA:
  - save and continue
- Secondary CTA:
  - cancel back to dashboard if partial account exists
- Empty:
  - this page is itself the empty-state unlock path
- Error:
  - inline save alert above the form

### `/dashboard/vessels/[vesselSlug]`

- Purpose:
  - private vessel command surface
- Primary sections:
  - vessel hero
  - live map
  - live metric grid
  - media-rich passage timeline
  - owner-only review queue for ambiguous media matches
  - general vessel media strip for unattached items
  - linked installations card
- Primary CTA:
  - open installation
- Secondary CTA:
  - open public vessel page
  - open public profile
- Empty:
  - no live telemetry
  - no passages
  - no media
  - no linked installations
- Error:
  - vessel not found state
  - fetch failure alert inside dashboard shell

### `/dashboard/vessels/[vesselSlug]/passages`

- Purpose:
  - vessel-scoped captain passage workspace
- Primary sections:
  - compact vessel masthead with return to live view
  - local live/passages switcher
  - split desktop passage workspace with a large playback/map canvas
  - always-visible selected-passage summary and readiness context
  - searchable passage rail
  - shared media and linked context
- Primary CTA:
  - return to live vessel view
- Secondary CTA:
  - open public vessel page
- Behavior:
  - the selected passage, playback readiness, and route context stay visible in
    the first viewport on desktop
  - the route should not read as a tiny header above a long undifferentiated
    vertical stack
- Empty:
  - no passages
- Notes:
  - compact Tideye demo playback bundles should light up the playback theater
    when present
  - passages without playback bundles fall back to static route focus
- Error:
  - vessel not found state
  - fetch failure alert inside dashboard shell

### `/dashboard/passages`

- Purpose:
  - dedicated captain passage workspace
- Primary sections:
  - compact operational masthead
  - vessel switcher when multiple vessels exist
  - split desktop workspace with a larger playback/map canvas
  - always-visible selected-passage summary and route context
  - searchable passage rail
  - passage metrics and linked media context
- Primary CTA:
  - open live view for the active vessel
- Secondary CTA:
  - open public passage log for the active vessel when shared
- Behavior:
  - desktop prioritizes the active playback or map workspace over a tall stacked
    reading flow
  - the selected passage, playback readiness, and next action must be legible
    without deep scrolling
- Empty:
  - no vessel yet
  - no passages yet
- Notes:
  - compact Tideye demo playback bundles should replay directly from MyBoat D1
    storage when available
  - the route remains useful without playback by falling back to route-focused
    chart review
- Error:
  - fetch failure alert inside dashboard shell

### `/dashboard/installations/[installationId]`

- Purpose:
  - manage one installation and its ingest posture
- Primary sections:
  - installation summary
  - connection status
  - observed vessel identity
  - ingest key creation
  - collector command and setup guidance
  - local boat-mode guidance
  - existing key list
- Primary CTA:
  - generate ingest key
- Secondary CTA:
  - copy command
  - return to vessel
- Empty:
  - no keys issued yet
  - no telemetry observed yet
  - no observed identity yet
- Error:
  - installation not found state
  - key generation failure toast or inline alert

### `/dashboard/settings`

- Purpose:
  - canonical long-form captain settings surface
- Primary sections:
  - compact utility masthead
  - above-the-fold section shortcuts plus current vessel and source context
  - captain profile section
  - captain-managed vessel profile section
  - observed connection identity section
  - collector setup section
  - sharing section
  - security section
  - local preferences section
- Primary CTA:
  - open the relevant settings action
- Secondary CTA:
  - contextual links into legacy settings subpages and installation detail
- Behavior:
  - this route reads as a control surface, not a campaign page
  - the public-profile action stays secondary to settings tasks
  - section actions should sit close to the section they affect rather than
    clustering in the masthead

### `/dashboard/settings/profile`

- Purpose:
  - contextual legacy page for captain identity editing
- Primary sections:
  - captain name
  - username
  - headline
  - bio
  - home port
- Primary CTA:
  - save profile
- Error:
  - handle conflict
  - validation errors

### `/dashboard/settings/security`

- Purpose:
  - contextual legacy page for security and account-hardening controls
- Primary sections:
  - password change
  - MFA posture
  - linked auth providers
  - active session posture
- Primary CTA:
  - save security change
- Error:
  - invalid password
  - MFA enrollment or verification failure

### `/dashboard/settings/preferences`

- Purpose:
  - contextual legacy page for personal operating preferences
- Primary sections:
  - unit preferences
  - map behavior
  - telemetry display defaults
  - notification preferences
- Primary CTA:
  - save preferences

### `/dashboard/settings/sharing`

- Purpose:
  - contextual legacy page for public visibility and live-sharing defaults
- Primary sections:
  - public profile visibility
  - vessel sharing defaults
  - live telemetry sharing posture
  - public delay or redaction controls when supported
- Primary CTA:
  - save sharing settings

### `/:username`

- Purpose:
  - public captain profile and fleet overview
- Primary sections:
  - compact captain strip (handle, optional headline line-clamp, captain name,
    home port, vessel count — no four-tile stats card, no long bio block)
  - fleet map (vessel pins only; no passage tracks so the default view centers
    on live positions)
  - public vessel cards
- Primary CTA:
  - open public vessel page
- Secondary CTA:
  - sign in or create account for product conversion
- Empty:
  - no public vessels
  - no public telemetry yet
- Error:
  - profile unavailable alert

### `/:username/:vesselSlug`

- Purpose:
  - public vessel detail page
- Primary sections:
  - vessel hero
  - public live status
  - public map
  - public passage list
  - public media strip
- Primary CTA:
  - open captain profile
- Secondary CTA:
  - create account
- Empty:
  - no public live data
  - no public passages
  - no public media
- Error:
  - vessel unavailable or not shared

### `/:username/:vesselSlug/passages`

- Purpose:
  - dedicated public passage workspace
- Primary sections:
  - public vessel hero
  - searchable public passage rail
  - route-focused public map workspace
  - read-only playback theater with timeline scrubber and nearby traffic
  - passage metrics and note surface
  - public media strip
- Primary CTA:
  - return to public live vessel page
- Secondary CTA:
  - open captain profile
  - create account
- Empty:
  - no public passages
- Notes:
  - public playback must read only captain-approved compact bundles already
    stored by MyBoat
  - if no playback bundle exists, the page falls back to static route focus
- Error:
  - vessel unavailable or not shared

### `/admin`

- Purpose:
  - admin overview and operational triage
- Primary sections:
  - compact operational masthead
  - dense KPI row
  - urgent controls and ingest health summary
  - shortcuts to admin sections
  - lightweight operator notes or review queue only when relevant
- Primary CTA:
  - open an admin section
- Behavior:
  - the first viewport should show title, key action, and primary operational
    context without centered dead air
  - decorative rail or hero treatments must not dominate the route above the KPI
    and control surfaces

### `/admin/users`

- Purpose:
  - user and role management
- Primary sections:
  - searchable user list
  - role controls
  - user detail drawer or detail panel
- Primary CTA:
  - update role

### `/admin/vessels`

- Purpose:
  - vessel moderation and ownership review
- Primary sections:
  - vessel list
  - shareability posture
  - owner linkage
- Primary CTA:
  - open vessel review

### `/admin/installations`

- Purpose:
  - operational view of installation health
- Primary sections:
  - stale installation list
  - ingest failure or inactive list
  - key posture indicators
- Primary CTA:
  - open installation review

### `/admin/telemetry`

- Purpose:
  - telemetry pipeline operations
- Primary sections:
  - queue backlog
  - ingest error posture
  - live fanout health
  - historical write health
- Primary CTA:
  - inspect telemetry issue

### `/admin/system`

- Purpose:
  - system-level platform controls and internal configuration
- Primary sections:
  - system prompt or model controls when applicable
  - feature or runtime controls
  - internal diagnostics links

## Responsive behavior

- Public and auth heroes collapse to one column on mobile.
- Dashboard, vessel, and admin layouts collapse to one column below `xl`.
- Split workspaces collapse to stacked sections on smaller screens without
  losing the active selection summary or missing-data context.
- Maps and playback canvases keep a fixed-height container but step down in
  height on smaller screens and in sparse-data states.
- No route should rely on dense tables as the only mobile representation.

## Shared state rules

- Live telemetry cards should look distinct from historical passage content.
- Private vessel pages are denser than public vessel pages.
- Operational routes use compact mastheads and should not spend most of the
  first viewport on decorative route framing.
- Empty states must explain what is missing and what action unlocks the feature.
- Error states should preserve route shell and context where possible.
- Source-derived vessel identity should be visually distinct from
  captain-managed profile fields.
- UI should minimize manual entry for fields the collector can reliably observe
  from SignalK.
- AIS and vessel identity cards should preserve last known non-null values when
  live updates are sparse.
- Sparse map or playback states should remain informative: keep the selected
  focus, missing-data summary, and next action near the main canvas instead of
  pushing them below it.

## Verification checkpoints

- Desktop screenshot review:
  - no operational route should spend the majority of its first viewport on
    decorative header space
- Admin and settings:
  - title, key action, and primary operational context stay visible above the
    fold
- Buddy boats:
  - sparse-coordinate datasets still show selected-vessel context and a clear
    missing-data summary
- Passages:
  - selected passage, playback readiness, and route context stay legible without
    deep scrolling
- Mobile:
  - split-workspace routes collapse cleanly without losing active selection or
    missing-data explanation

## Open UI questions

- Whether settings should remain split into child routes or start as tabs under
  `/dashboard/settings`
- Whether admin detail views should be separate routes or drawers within list
  pages
- Whether the public vessel page should expose live map by default or gate some
  live detail behind sharing preferences
