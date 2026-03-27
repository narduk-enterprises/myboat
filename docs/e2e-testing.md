# E2E Testing

## Shared Baseline

The starter uses a shared Playwright baseline:

- shared fixtures and auth contracts live in
  `layers/narduk-nuxt-layer/testing/e2e/`
- `apps/web/tests/e2e/` keeps the app's thin local specs
- local `fixtures.ts` files should re-export the shared layer fixtures instead
  of duplicating readiness and auth helpers

The split is intentional:

- the layer owns reusable fixtures, auth contracts, and stable selectors
- the app owns wrapper specs, app-specific flows, and custom assertions

## Current Starter Layout

- root `playwright.config.ts` defines a single Playwright project for `apps/web`
- `apps/web/tests/e2e/` is the baseline for local smoke and auth coverage
- `.template-reference/playwright.config.ts` mirrors the same baseline for sync
  and drift checks

## How To Extend Coverage

1. Import fixtures from the local `tests/e2e/fixtures.ts`.
2. Keep the shared smoke and auth baseline unless the app intentionally replaces
   it.
3. Add local specs for product-specific flows such as onboarding, billing,
   dashboards, or admin tools.
4. Promote reusable readiness or auth helpers back into the layer instead of
   copying them across apps.

## Running Tests

- Full starter suite: `pnpm test:e2e`
- App-only entrypoint: `pnpm test:e2e:web`
- Small smoke pass: `pnpm test:e2e:smoke`
- Visual audit capture: `pnpm test:e2e:ui`
- Visual audit analysis: `pnpm test:e2e:ui:analyze`

## Screenshot Audit Loop

MyBoat adds a route-by-route screenshot audit for public and private product
surfaces.

- screenshots write to `output/playwright/ui-quality/`
- `manifest.json` records the audited routes plus minimum screenshot thresholds
- `summary.json` and `summary.md` are produced by the analyzer and act as the
  machine-readable gate for overnight UI polish runs
- private route screenshots use the dev-only `login-test` and `seed-sample`
  endpoints so the same captain, vessel, installation, and media state render on
  every run

The screenshot loop is intended for iterative visual cleanup:

1. Review the latest screenshot folder and analyzer summary.
2. Do a light review of any already-open branch changes before starting a new
   polish pass.
3. Pick one bounded UI cluster.
4. Make the change.
5. Re-run `pnpm test:e2e:ui` and `pnpm test:e2e:ui:analyze`.
6. Run `pnpm test:e2e:smoke`.
7. Ship with `pnpm run ship`.
8. Re-run `pnpm test:e2e:smoke`.
9. Update the dated proof README under `docs/build-proofs/`.

## Agent Expectations

When adding or changing features:

- add unit tests for core logic where appropriate
- add E2E coverage for critical user-visible flows
- keep tests robust enough to run against both local and deployed environments
  when practical
