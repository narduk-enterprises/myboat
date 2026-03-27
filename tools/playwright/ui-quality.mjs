import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'

export function slugify(value) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/(^-|-$)/g, '')
}

export function prepareUiQualityRoot(rootDir) {
  rmSync(rootDir, { recursive: true, force: true })
  mkdirSync(rootDir, { recursive: true })
}

export function writeUiQualityManifest(rootDir, manifest) {
  writeFileSync(
    path.join(rootDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
}

async function captureLocatorScreenshot(page, locator, screenshotPath) {
  await locator.evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ block: 'center', inline: 'center' })
    }
  })
  await page.waitForTimeout(150)
  await locator.screenshot({ path: screenshotPath })
}

async function withStickyChromeSuppressed(page, fn) {
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.id = 'playwright-ui-quality-suppress-sticky'
    style.textContent = `
      header.sticky,
      nav.sticky,
      section.sticky,
      [class*=" sticky"],
      [class^="sticky"] {
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
    document.head.append(style)
  })

  try {
    await fn()
  } finally {
    await page.evaluate(() => {
      document.getElementById('playwright-ui-quality-suppress-sticky')?.remove()
    })
  }
}

export async function captureNamedLocator(page, locator, name, directory, captures, options = {}) {
  await expect(locator).toBeVisible()
  const screenshotPath = path.join(directory, `${slugify(name)}.png`)

  if (options.suppressStickyChrome === false) {
    await captureLocatorScreenshot(page, locator, screenshotPath)
  } else {
    await withStickyChromeSuppressed(page, async () => {
      await captureLocatorScreenshot(page, locator, screenshotPath)
    })
  }

  captures.push({ name, path: screenshotPath })
}

export async function captureFullPageAudit(page, rootDir, route, title, captureElements) {
  const directory = path.join(rootDir, slugify(title))
  mkdirSync(directory, { recursive: true })

  const pageScreenshot = path.join(directory, 'page-full.png')
  await page.screenshot({
    path: pageScreenshot,
    fullPage: true,
  })

  const elementScreenshots = []
  await captureElements(directory, elementScreenshots)

  return {
    id: slugify(title),
    route,
    title,
    pageScreenshot,
    elementScreenshots,
  }
}
