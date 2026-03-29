import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import {
  createConsoleTracker,
  gotoAndHydrate,
  loginAsUiTestUser,
  seedUiAuditWorkspace,
} from './helpers'

test.describe('passages workspace', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('passages e2e tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('captain nav resolves to the vessel passage workspace and syncs passage selection', async ({
    page,
  }) => {
    await loginAsUiTestUser(page)
    const seeded = await seedUiAuditWorkspace(page)
    const consoleTracker = createConsoleTracker(page)

    await gotoAndHydrate(page, seeded.routes.dashboard)
    await page
      .getByRole('navigation', { name: 'Section navigation' })
      .getByRole('link', { name: 'Passages' })
      .click()

    await expect(page).toHaveURL(
      new RegExp(`/dashboard/vessels/${seeded.vesselSlug}/passages(?:\\?.*)?$`),
    )
    await expect(page.locator('[data-testid="passages-workspace"]')).toBeVisible()

    const secondRow = page.locator('[data-testid="passage-workspace-row"]').nth(1)
    const passageId = await secondRow.getAttribute('data-passage-id')
    expect(passageId).toBeTruthy()

    await secondRow.click()
    await expect(page).toHaveURL(new RegExp(`[?&]p=${passageId}(&|$)`))
    await expect(page.locator('[data-testid="passage-playback-deck"]')).toBeVisible()
    await expect(page.locator('[data-testid="passage-playback-slider"]')).toBeVisible()

    await consoleTracker.expectClean()
  })

  test('public vessel page opens the dedicated passage log and keeps the selection in the query', async ({
    page,
  }) => {
    await loginAsUiTestUser(page)
    const seeded = await seedUiAuditWorkspace(page)
    await page.context().clearCookies()
    const consoleTracker = createConsoleTracker(page)

    await gotoAndHydrate(page, `/${seeded.username}/${seeded.vesselSlug}`)
    await page.getByRole('link', { name: 'Open all passages' }).click()

    await expect(page).toHaveURL(
      new RegExp(`/${seeded.username}/${seeded.vesselSlug}/passages(?:\\?.*)?$`),
    )
    await expect(page.locator('[data-testid="public-vessel-passages-view"]')).toBeVisible()

    const firstRow = page.locator('[data-testid="passage-workspace-row"]').first()
    const passageId = await firstRow.getAttribute('data-passage-id')
    expect(passageId).toBeTruthy()

    await firstRow.click()
    await expect(page).toHaveURL(new RegExp(`[?&]p=${passageId}(&|$)`))
    await expect(page.locator('[data-testid="passage-playback-deck"]')).toBeVisible()
    await expect(page.locator('[data-testid="passage-playback-slider"]')).toBeVisible()

    await consoleTracker.expectClean()
  })
})
