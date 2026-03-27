import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import { gotoAndHydrate } from './helpers'

test.describe('web smoke', () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('web smoke tests require Playwright baseURL to be configured.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('home page renders the MyBoat hero and primary actions', async ({ page }) => {
    await gotoAndHydrate(page, '/')
    await expect(page.getByRole('heading', { name: /Know where the boat is/i })).toBeVisible()
    await expect(page.getByText('Bluewater vessel intelligence')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
    await expect(page).toHaveTitle(/MyBoat/)
  })
})
