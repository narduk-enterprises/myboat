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
    const hero = page.locator('[data-testid="landing-hero"]')

    await expect(hero).toBeVisible()
    await expect(page.getByRole('heading', { name: /Know where the boat is/i })).toBeVisible()
    await expect(hero.getByText('Bluewater vessel intelligence')).toBeVisible()
    await expect(hero.getByRole('link', { name: 'Create account' })).toBeVisible()
    await expect(hero.getByRole('link', { name: 'Sign in' })).toBeVisible()
    await expect(page).toHaveTitle(/MyBoat/)
  })
})
