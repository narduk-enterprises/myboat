import { expect, test, waitForBaseUrlReady, warmUpApp } from './fixtures'
import { gotoAndHydrate } from './helpers'

/**
 * Seeded public captain (apps/web/drizzle/seed.sql): @captain-tideye / vessel tideye.
 * Nearby traffic API must not return duplicate MMSI or duplicate contact ids (regression
 * for stacked “ghost” AIS pins).
 *
 * Opening the app via a LAN host (e.g. http://192.168.x.x:3216/...) while
 * MYBOAT_LOCAL_BROKER_ORIGIN points at http://127.0.0.1:8791 breaks live AIS on other
 * devices: the browser will open ws://127.0.0.1:8791 on *that* device, not the dev machine.
 */
const CAPTAIN_USERNAME = 'captain-tideye'
const SEEDED_VESSEL_SLUG = 'tideye'

test.describe('public captain profile (captain-tideye)', () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    if (!baseURL) {
      throw new Error('Playwright baseURL is required.')
    }

    await waitForBaseUrlReady(baseURL)
    await warmUpApp(browser, baseURL)
  })

  test('profile page renders hero, map region, and vessel card', async ({ page }) => {
    await gotoAndHydrate(page, `/${CAPTAIN_USERNAME}`)

    await expect(page.getByTestId('public-profile-hero')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: new RegExp(`@${CAPTAIN_USERNAME}`, 'i') }),
    ).toBeVisible()
    await expect(page.getByTestId('public-profile-map')).toBeVisible()
    await expect(page.getByTestId('public-vessel-grid')).toBeVisible()
  })

  test('traffic nearby JSON has unique contact ids and unique MMSIs', async ({ page, baseURL }) => {
    const url = new URL(
      `/api/public/${CAPTAIN_USERNAME}/${SEEDED_VESSEL_SLUG}/traffic/nearby`,
      baseURL!,
    ).toString()

    const response = await page.request.get(url)
    expect(response.ok(), `Expected 200 from ${url}, got ${response.status()}`).toBeTruthy()

    const body = (await response.json()) as {
      contacts: Array<{ id: string; mmsi: string | null }>
    }

    const contacts = body.contacts ?? []
    const ids = contacts.map((c) => c.id)
    const mmsis = contacts.map((c) => c.mmsi?.trim()).filter((m): m is string => Boolean(m))

    expect(
      new Set(ids).size,
      `Duplicate AIS contact ids: ${ids.length} contacts, ${new Set(ids).size} unique`,
    ).toBe(ids.length)
    expect(
      new Set(mmsis).size,
      `Duplicate MMSI in nearby payload: ${mmsis.length} with mmsi, ${new Set(mmsis).size} unique`,
    ).toBe(mmsis.length)
  })
})
