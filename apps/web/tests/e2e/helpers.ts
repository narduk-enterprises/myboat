import type { Page, TestInfo } from '@playwright/test'
import { expect, waitForHydration } from './fixtures'

const MUTATION_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
} as const

const IGNORED_CONSOLE_ISSUES = [
  /Failed to load resource: net::ERR_SSL_PROTOCOL_ERROR.*googletagmanager\.com/i,
  /Failed to load resource: net::ERR_SSL_PROTOCOL_ERROR.*cloudflareinsights\.com/i,
]

export type UiAuditSeedResult = {
  username: string
  vesselSlug: string
  installationId: string
  routes: {
    dashboard: string
    onboarding: string
    vessel: string
    installation: string
    publicProfile: string
  }
}

async function postJson<TResponse>(page: Page, path: string, body: Record<string, unknown> = {}) {
  const response = await page.context().request.post(path, {
    data: body,
    headers: MUTATION_HEADERS,
  })

  expect(response.ok(), `Expected ${path} to succeed, received ${response.status()}.`).toBeTruthy()
  return (await response.json()) as TResponse
}

export async function gotoAndHydrate(page: Page, path: string) {
  let response: Awaited<ReturnType<Page['goto']>> | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await page.goto(path, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      })
      break
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('ERR_ABORTED') || attempt === 1) {
        throw error
      }

      await page.waitForTimeout(500)
    }
  }

  expect(response?.ok(), `Expected ${path} to return an OK response`).toBeTruthy()
  await waitForHydration(page)
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(page.locator('main')).toBeVisible()
}

export async function capturePage(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  })
}

export async function loginAsUiTestUser(page: Page) {
  return postJson<{ user: { id: string; email: string } | null }>(page, '/api/auth/login-test')
}

export async function seedUiAuditWorkspace(page: Page) {
  return postJson<UiAuditSeedResult>(page, '/api/app/testing/seed-sample')
}

export async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body

    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: body?.scrollWidth ?? 0,
    }
  })

  const widest = Math.max(metrics.scrollWidth, metrics.bodyScrollWidth)
  expect(
    widest,
    `Expected no horizontal overflow, but measured ${widest}px against ${metrics.clientWidth}px viewport width.`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1)
}

export function createConsoleTracker(page: Page) {
  const issues: string[] = []

  page.on('console', (message) => {
    const type = message.type()
    const text = message.text()

    if (
      (type === 'error' || type === 'warning') &&
      !IGNORED_CONSOLE_ISSUES.some((pattern) => pattern.test(text))
    ) {
      issues.push(`[console:${type}] ${text}`)
    }
  })

  page.on('pageerror', (error) => {
    issues.push(`[pageerror] ${error.message}`)
  })

  return {
    async expectClean() {
      expect(issues, issues.join('\n')).toEqual([])
    },
  }
}
