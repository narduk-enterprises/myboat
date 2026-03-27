Status: LOCKED

# MyBoat UI Plan

## Global layout

- Single branded shell with sticky header, compact nav, dashboard CTA, and
  footer.
- Landing pages can use full-width hero treatment.
- Authenticated application pages use a constrained `max-w-7xl` content frame.

## Navigation structure

- Header primary nav: `Home`
- Header action: `Sign in` or `Dashboard`
- Dashboard navigation is route-driven through direct links, not a second
  competing shell
- Vessel and install pages use in-page action links rather than adding more
  global chrome

## Page priorities

### `/`

- immediate product framing
- clear CTA into register/login
- visual proof that the product is boat-aware, telemetry-aware, and operational

### `/dashboard`

- top-row operational stats
- vessel cards first
- map and passage context second
- install readiness and recent public moments in the supporting column

### `/dashboard/onboarding`

- one decisive setup form
- no multi-route wizard sprawl
- sections: captain identity, vessel identity, telemetry install

### `/dashboard/vessels/[vesselSlug]`

- map first
- live metrics second
- passages and media below
- install links in supporting column

### `/dashboard/installations/[installationId]`

- install summary
- ingest key creation
- copyable collector command
- existing key list

### `/:username`

- public captain hero
- vessel cards and public operational summary
- public map if shareable data exists

## Mobile vs desktop behavior

- hero stacks to one column on mobile
- dashboard becomes single column under `xl`
- map height stays fixed but shorter on smaller breakpoints via container
  classes
- vessel cards and install cards remain readable as stacked cards, never
  compressed tables

## Presentation rules

### Live vs historical

- live snapshot metrics are visually distinct cards
- passages are timeline cards, not metric tiles
- media is visual and secondary to map/live status on private pages

### Empty states

- every list-like section gets a real empty state
- empty states should explain what data is missing and what unlocks the feature
- empty states must never reuse generic template copy

### Loading states

- route-level loading relies on Nuxt async data behavior
- map has its own loading/unavailable state via `AppMapKit`
- no spinner-only pages after initial navigation; use meaningful surrounding
  structure where possible

### Error states

- public profile missing: single alert with clear unavailable message
- onboarding save errors: inline alert above the form
- install key failures: toast + preserved page state

## Card system

- `MarineMetricCard`: primary metric primitive
- `VesselSummaryCard`: vessel overview primitive
- `PassageTimeline`: historical narrative primitive
- `MediaStrip`: visual memory primitive
- `InstallationCredentialPanel`: install-management primitive
- `MarineTrackMap`: shared map primitive

## Action hierarchy

- landing: create account, open dashboard
- dashboard: edit profile, public profile, open vessel, manage install
- onboarding: save boat profile
- install detail: generate key, copy command, copy raw key

## Theme and token rules

- primary color family: cyan/ocean
- neutral family: slate
- typography: display face for headings, modern sans for body
- visuals should feel maritime, technical, and calm
- use semantic colors and layer tokens, not arbitrary Tailwind grays or inline
  color styling

## Public/shareable behavior

- public profile pages present only public vessel summaries and install posture
- public route does not expose private install keys or internal-only notes
- captain handle is the public identity anchor
