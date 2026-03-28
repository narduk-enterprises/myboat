# MyBoat UI Plan

Status: UNLOCKED

## Shell model

- One public shell for marketing and shareable routes.
- One authenticated dashboard shell for captain operations.
- One admin shell for system and moderation work.
- Public and private vessel pages should feel related, but the private vessel
  page is denser and more operational.
- The authenticated shell has one primary navigation model:
  - desktop: persistent left sidebar
  - mobile: bottom nav with the same core destinations
  - top header: brand, account, and context actions only

## Route hierarchy

### Public

- `/`
- `/:username`
- `/:username/:vesselSlug`

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
- `/dashboard/fleet-friends`
- `/dashboard/settings`

### Contextual and legacy captain routes

- `/dashboard/onboarding`
- `/dashboard/vessels/[vesselSlug]`
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
  - `Overview`
  - `Live Map`
  - `Buddy Boats`
  - `Settings`
  - admin entry only for admins and only as an extra item
- Dashboard header must not duplicate dashboard route buttons.
- Onboarding is not primary navigation; show it only as a contextual action when
  setup is incomplete.
- Vessel, installation, and settings-subpages should use local in-page
  navigation and action links rather than a second competing global subnav.
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
  - calm hero/status summary
  - compact current-location map card
  - live vessel data cards for the primary vessel
  - compact operational context cards
- Primary CTA:
  - open live map
- Secondary CTA:
  - finish setup when captain, vessel, or live source is missing
  - open settings
  - open contextual vessel detail
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
  - hero
  - large operational chart
  - AIS traffic with selected-contact detail
  - compact diagnostics for "what is wrong right now"
  - deeper live metric board than `/dashboard`
- Primary CTA:
  - open contextual vessel or installation detail
- Secondary CTA:
  - return to `/dashboard`
  - open settings
- Empty:
  - no vessel yet
  - no live source linked yet
  - no stored live fix yet
- Error:
  - dashboard shell preserved with map-specific error state

### `/dashboard/fleet-friends`

- Purpose:
  - buddy-boat map workspace
- Primary sections:
  - route header
  - search-and-save controls
  - map-first search results
  - saved buddy boats list and saved boats map
- Primary CTA:
  - save a buddy boat
- Secondary CTA:
  - remove a buddy boat
  - return to dashboard
- Empty:
  - no saved buddy boats yet
  - no AIS matches yet
- Error:
  - search or workspace failure alert

### `/dashboard/onboarding`

- Purpose:
  - create or finish the canonical first-time setup
- Primary sections:
  - captain identity
  - vessel identity
  - installation and telemetry setup
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
  - passage timeline
  - media strip
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

### `/dashboard/installations/[installationId]`

- Purpose:
  - manage one installation and its ingest posture
- Primary sections:
  - installation summary
  - connection status
  - ingest key creation
  - collector command and setup guidance
  - existing key list
- Primary CTA:
  - generate ingest key
- Secondary CTA:
  - copy command
  - return to vessel
- Empty:
  - no keys issued yet
  - no telemetry observed yet
- Error:
  - installation not found state
  - key generation failure toast or inline alert

### `/dashboard/settings`

- Purpose:
  - canonical long-form captain settings surface
- Primary sections:
  - hero
  - captain profile section
  - vessel profile section
  - live-feed setup section
  - sharing section
  - security section
  - local preferences section
- Primary CTA:
  - open the relevant settings action
- Secondary CTA:
  - contextual links into legacy settings subpages and installation detail

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
  - captain hero
  - fleet map
  - public vessel cards
  - public install readiness section
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

### `/admin`

- Purpose:
  - admin overview and operational triage
- Primary sections:
  - system status cards
  - ingest health summary
  - moderation or review queue
  - shortcuts to admin sections
- Primary CTA:
  - open an admin section

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
- Maps keep a fixed-height container but step down in height on smaller screens.
- No route should rely on dense tables as the only mobile representation.

## Shared state rules

- Live telemetry cards should look distinct from historical passage content.
- Private vessel pages are denser than public vessel pages.
- Empty states must explain what is missing and what action unlocks the feature.
- Error states should preserve route shell and context where possible.

## Open UI questions

- Whether settings should remain split into child routes or start as tabs under
  `/dashboard/settings`
- Whether admin detail views should be separate routes or drawers within list
  pages
- Whether the public vessel page should expose live map by default or gate some
  live detail behind sharing preferences
