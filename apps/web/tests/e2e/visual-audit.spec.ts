import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as Playwright from '@playwright/test'
import {
  captureFullPageAudit,
  captureNamedLocator,
  prepareUiQualityRoot,
  writeUiQualityManifest,
} from '../../../../tools/playwright/ui-quality.mjs'
import {
  createConsoleTracker,
  expectNoHorizontalOverflow,
  gotoAndHydrate,
  loginAsUiTestUser,
  seedUiAuditWorkspace,
} from './helpers'
import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'

const UI_QUALITY_ROOT = path.resolve(
  fileURLToPath(new URL('../../../../output/playwright/ui-quality/', import.meta.url)),
)

async function captureRouteAudit(
  page: Playwright.Page,
  route: string,
  title: string,
  captureElements: (
    directory: string,
    captures: Array<{
      name: string
      path: string
    }>,
  ) => Promise<void>,
) {
  await gotoAndHydrate(page, route)
  return captureFullPageAudit(page, UI_QUALITY_ROOT, route, title, captureElements)
}

async function buildDesktopAudit(page: Playwright.Page) {
  const audits = []

  audits.push(
    await captureRouteAudit(page, '/', 'desktop-home', async (directory, captures) => {
      await captureNamedLocator(
        page,
        page.locator('[data-testid="landing-hero"]'),
        'landing-hero',
        directory,
        captures,
      )
      await captureNamedLocator(
        page,
        page.locator('[data-testid="landing-quick-signals"]'),
        'landing-quick-signals',
        directory,
        captures,
      )
      await captureNamedLocator(
        page,
        page.locator('[data-testid="landing-operational-board"]'),
        'landing-operational-board',
        directory,
        captures,
      )
      await captureNamedLocator(
        page,
        page.locator('[data-testid="landing-surface-grid"]'),
        'landing-surface-grid',
        directory,
        captures,
      )
    }),
  )

  audits.push(
    await captureRouteAudit(page, '/login', 'desktop-login', async (directory, captures) => {
      await captureNamedLocator(
        page,
        page.locator('[data-testid="auth-login-card"]'),
        'auth-login-card',
        directory,
        captures,
      )
    }),
  )

  audits.push(
    await captureRouteAudit(page, '/register', 'desktop-register', async (directory, captures) => {
      await captureNamedLocator(
        page,
        page.locator('[data-testid="auth-dock-aside"]'),
        'auth-dock-aside',
        directory,
        captures,
      )
      await captureNamedLocator(
        page,
        page.locator('[data-testid="auth-dock-panel"]'),
        'auth-dock-panel',
        directory,
        captures,
      )
    }),
  )

  await loginAsUiTestUser(page)
  const seeded = await seedUiAuditWorkspace(page)

  audits.push(
    await captureRouteAudit(
      page,
      seeded.routes.dashboard,
      'desktop-dashboard',
      async (directory, captures) => {
        await captureNamedLocator(
          page,
          page.locator('[data-testid="dashboard-hero"]'),
          'dashboard-hero',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="dashboard-vessel-grid"]'),
          'dashboard-vessel-grid',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="dashboard-install-readiness"]'),
          'dashboard-install-readiness',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="dashboard-recent-moments"]'),
          'dashboard-recent-moments',
          directory,
          captures,
        )
      },
    ),
  )

  audits.push(
    await captureRouteAudit(
      page,
      seeded.routes.onboarding,
      'desktop-onboarding',
      async (directory, captures) => {
        await captureNamedLocator(
          page,
          page.locator('[data-testid="onboarding-explainer"]'),
          'onboarding-explainer',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="onboarding-form"]'),
          'onboarding-form',
          directory,
          captures,
        )
      },
    ),
  )

  audits.push(
    await captureRouteAudit(
      page,
      seeded.routes.vessel,
      'desktop-vessel-detail',
      async (directory, captures) => {
        await captureNamedLocator(
          page,
          page.locator('[data-testid="vessel-detail-map"]'),
          'vessel-detail-map',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="vessel-detail-snapshot-grid"]'),
          'vessel-detail-snapshot-grid',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="vessel-detail-passage-timeline"]'),
          'vessel-detail-passage-timeline',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="vessel-detail-install-links"]'),
          'vessel-detail-install-links',
          directory,
          captures,
        )
      },
    ),
  )

  audits.push(
    await captureRouteAudit(
      page,
      seeded.routes.installation,
      'desktop-installation-detail',
      async (directory, captures) => {
        await captureNamedLocator(
          page,
          page.locator('[data-testid="installation-hero"]'),
          'installation-hero',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="installation-credential-panel"]'),
          'installation-credential-panel',
          directory,
          captures,
        )
      },
    ),
  )

  audits.push(
    await captureRouteAudit(
      page,
      seeded.routes.publicProfile,
      'desktop-public-profile',
      async (directory, captures) => {
        await captureNamedLocator(
          page,
          page.locator('[data-testid="public-profile-hero"]'),
          'public-profile-hero',
          directory,
          captures,
        )
        await captureNamedLocator(
          page,
          page.locator('[data-testid="public-vessel-grid"]'),
          'public-vessel-grid',
          directory,
          captures,
        )
      },
    ),
  )

  return {
    audits,
    seed: seeded,
  }
}

async function buildMobileAudit(browser: Playwright.Browser, baseURL: string) {
  const context = await browser.newContext({
    ...Playwright.devices['iPhone 13'],
    baseURL,
  })
  const page = await context.newPage()
  const tracker = createConsoleTracker(page)
  const audits = []

  try {
    audits.push(await captureRouteAudit(page, '/', 'mobile-home', async () => {}))
    await expectNoHorizontalOverflow(page)

    audits.push(await captureRouteAudit(page, '/login', 'mobile-login', async () => {}))
    await expectNoHorizontalOverflow(page)

    audits.push(await captureRouteAudit(page, '/register', 'mobile-register', async () => {}))
    await expectNoHorizontalOverflow(page)

    await loginAsUiTestUser(page)
    const mobileSeed = await seedUiAuditWorkspace(page)

    audits.push(
      await captureRouteAudit(
        page,
        mobileSeed.routes.onboarding,
        'mobile-onboarding',
        async () => {},
      ),
    )
    await expectNoHorizontalOverflow(page)

    audits.push(
      await captureRouteAudit(
        page,
        mobileSeed.routes.publicProfile,
        'mobile-public-profile',
        async () => {},
      ),
    )
    await expectNoHorizontalOverflow(page)

    await tracker.expectClean()
  } finally {
    await context.close()
  }

  return audits
}

test.describe('visual audit', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(180_000)

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('visual audit requires Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
    prepareUiQualityRoot(UI_QUALITY_ROOT)
  })

  test('captures route-level screenshots for key public and private product surfaces', async ({
    browser,
    baseURL,
    page,
  }) => {
    if (!baseURL) {
      throw new Error('visual audit requires Playwright baseURL to be configured.')
    }

    const tracker = createConsoleTracker(page)
    const { audits: desktopAudits } = await buildDesktopAudit(page)
    const mobileAudits = await buildMobileAudit(browser, baseURL)

    await tracker.expectClean()

    writeUiQualityManifest(UI_QUALITY_ROOT, {
      app: 'myboat',
      generatedAt: new Date().toISOString(),
      minimumScreenshotCount: 30,
      minimumFullPageCount: 13,
      criticalScreenshots: [
        {
          path: 'desktop-home/landing-hero.png',
          minAvgChannelStdev: 5,
          minBytes: 20_000,
        },
        {
          path: 'desktop-login/auth-login-card.png',
          minAvgChannelStdev: 4.5,
          minBytes: 12_000,
        },
        {
          path: 'desktop-register/auth-dock-aside.png',
          minAvgChannelStdev: 4.5,
          minBytes: 14_000,
        },
      ],
      audits: [...desktopAudits, ...mobileAudits],
    })

    expect([...desktopAudits, ...mobileAudits].length).toBeGreaterThanOrEqual(13)
  })
})
