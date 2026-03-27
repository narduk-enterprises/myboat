# MyBoat UI Proofs - 2026-03-27

## Purpose

This proof pack is the overnight handoff surface for the MyBoat screenshot audit
loop. Each run should refresh the visual artifacts, note what changed, and leave
the next best target clearly named.

## Artifact Paths

- Visual audit screenshots: `output/playwright/ui-quality/`
- Analyzer JSON: `output/playwright/ui-quality/summary.json`
- Analyzer markdown: `output/playwright/ui-quality/summary.md`

## Route Map

- `desktop-home` -> `/`
- `desktop-login` -> `/login`
- `desktop-register` -> `/register`
- `desktop-dashboard` -> `/dashboard`
- `desktop-onboarding` -> `/dashboard/onboarding`
- `desktop-vessel-detail` -> `/dashboard/vessels/:vesselSlug`
- `desktop-installation-detail` -> `/dashboard/installations/:installationId`
- `desktop-public-profile` -> `/:username`
- `mobile-home` -> `/`
- `mobile-login` -> `/login`
- `mobile-register` -> `/register`
- `mobile-onboarding` -> `/dashboard/onboarding`
- `mobile-public-profile` -> `/:username`

## Review Checklist

- Above-the-fold hierarchy is obvious on every audited route.
- CTA priority is clear on the landing and auth surfaces.
- Text remains legible over gradients and image-backed panels.
- Desktop spacing feels intentional instead of empty or washed out.
- Mobile screenshots show no horizontal overflow or cramped card stacks.
- Private routes look like product surfaces, not template remnants.
- The next cycle runs a light review on already-open branch changes.
- Pre-ship smoke passes before the loop deploys the latest polish.
- Post-ship smoke passes after deployment completes.

## Overnight Log

- 2026-03-27: Initialized the overnight UI loop, seeded deterministic visual
  audit data, added route-level screenshot capture, and strengthened the auth
  shell for the first polish pass.
- 2026-03-27: Updated the loop so the next cycle does a light branch review,
  runs a dedicated smoke test, and ships only after the audit plus smoke are
  green.

## Next Target

- Auth desktop polish remains the first overnight target because the visual
  audit now has dedicated critical crops for the auth aside and panel.
