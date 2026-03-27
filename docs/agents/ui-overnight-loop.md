# UI Overnight Loop

This repository uses a screenshot-driven overnight UI loop for MyBoat visual
polish. The loop is deliberately serial: one run, one cluster, one bounded
change set, one visual audit.

## Branch And Budget

- Use branch `codex/ui-overnight-loop`.
- Treat each run as a 25 minute work window.
- Reserve the final 5 minutes for reruns, proof updates, and the
  commit-or-no-commit decision.

## Start-Of-Run Checks

Before making any UI change:

1. Confirm the current branch is `codex/ui-overnight-loop`.
2. If the branch already has unshipped changes, do a light review first: inspect
   the diff, call out obvious UI regressions or test gaps, and decide whether
   the next cycle should polish-and-ship the existing work or leave a blocked
   note.
3. Confirm the worktree is clean before starting a new polish pass. If it is not
   clean after the light review, stop and leave a blocked note instead of
   stacking new edits.
4. Confirm `output/playwright/ui-quality/summary.json` exists, or create it by
   running the visual audit and analyzer.
5. Confirm `docs/build-proofs/<local-date>/README.md` exists, or create it from
   the current template.

## Visual Audit Inputs

The overnight loop relies on deterministic visual data:

- `POST /api/auth/login-test` signs Playwright into a dev-only audit captain.
- `POST /api/app/testing/seed-sample` creates the audit profile, vessel,
  installation, passages, waypoints, and media used by private screenshots.
- Stable screenshot targets live on audited pages via `data-testid` hooks.

## Route Inventory

Desktop audit routes:

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/dashboard/onboarding`
- `/dashboard/vessels/:vesselSlug`
- `/dashboard/installations/:installationId`
- `/:username`

Mobile audit routes:

- `/`
- `/login`
- `/register`
- `/dashboard/onboarding`
- `/:username`

## Cluster Order

Runs should work in this order unless the latest proof log makes a better next
target obvious:

1. `auth`
2. `landing`
3. `onboarding`
4. `dashboard`
5. `vessel-detail`
6. `installation-detail`
7. `public-profile`

## Required Commands

Every substantive UI pass must end with:

- `pnpm test:e2e:ui`
- `pnpm test:e2e:ui:analyze`
- `pnpm test:e2e:smoke`

Use the analyzer output as the machine gate and the screenshot folders as the
human review surface.

If the visual audit and smoke both pass, ship the branch:

- `pnpm run ship`

After ship completes, rerun the smoke path once more before the run counts as
green:

- `pnpm test:e2e:smoke`

## Commit Gate

Commit only if all of the following are true:

- no console errors or page errors were emitted during the audit
- no mobile horizontal overflow was detected
- the analyzer passed
- a light review of outstanding branch changes found no obvious blockers
- the smoke test passed before ship
- the smoke test passed after ship
- screenshots and proof notes were refreshed
- the diff stays inside the intended UI cluster

Commit messages should use:

- `ui-loop: <cluster> polish`

## Proof Log

Append a short note to `docs/build-proofs/<local-date>/README.md` after each
successful run:

- what changed
- what visibly improved
- whether ship succeeded
- which cluster should be next

If a run is blocked, record the blocker instead of pretending the loop made
progress.
