import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npmrcPath = path.join(rootDir, '.npmrc')
const lockfilePath = path.join(rootDir, 'pnpm-lock.yaml')
const registryBase = 'https://code.platform.nard.uk/api/packages/narduk-enterprises/npm/'
const registryHostPrefix = '//code.platform.nard.uk/api/packages/narduk-enterprises/npm/'
const registryMetadataBase = 'https://code.platform.nard.uk/api/packages/narduk-enterprises/npm'
const defaultPackageName = '@narduk-enterprises/eslint-config'

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

const npmrc = fs.readFileSync(npmrcPath, 'utf8')
const npmrcLines = npmrc
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)

if (!npmrc.includes(`@narduk-enterprises:registry=${registryBase}`)) {
  fail(`.npmrc must scope @narduk-enterprises to ${registryBase}.`)
}

for (const line of npmrcLines) {
  if (line === `registry=${registryBase}`) {
    fail(`.npmrc must not override the full npm registry to ${registryBase}.`)
  }

  if (line === '@narduk-enterprises:registry=https://npm.pkg.github.com') {
    fail('.npmrc must not route @narduk-enterprises packages through npm.pkg.github.com.')
  }

  if (line.startsWith('//npm.pkg.github.com/:_authToken=')) {
    fail('.npmrc must not commit a GitHub Packages auth token.')
  }
}

const forgejoToken = process.env.FORGEJO_TOKEN?.trim()
if (!forgejoToken) {
  fail('FORGEJO_TOKEN is required for package verification.')
}

const lockfile = fs.readFileSync(lockfilePath, 'utf8')
const versionMatch = lockfile.match(/'@narduk-enterprises\/eslint-config@([^']+)'/)
if (!versionMatch?.[1]) {
  fail(`Could not resolve ${defaultPackageName} version from pnpm-lock.yaml.`)
}

const version = versionMatch[1]
const metadataURL = `${registryMetadataBase}/${encodeURIComponent(defaultPackageName)}`
const metadataResponse = await fetch(metadataURL, {
  headers: {
    Authorization: `token ${forgejoToken}`,
    Accept: 'application/json',
  },
})

if (!metadataResponse.ok) {
  fail(`Package metadata request failed with ${metadataResponse.status} for ${defaultPackageName}.`)
}

const metadata = await metadataResponse.json()
const dist = metadata?.versions?.[version]?.dist

if (!dist?.tarball || typeof dist.tarball !== 'string') {
  fail(`Package metadata for ${defaultPackageName}@${version} does not include a tarball URL.`)
}

if (!dist.tarball.startsWith(registryBase)) {
  fail(`Tarball URL must come from ${registryBase}, received ${dist.tarball}.`)
}

const tarballResponse = await fetch(dist.tarball, {
  headers: {
    Authorization: `token ${forgejoToken}`,
    Accept: 'application/octet-stream',
  },
})

if (!tarballResponse.ok) {
  fail(`Tarball fetch failed with ${tarballResponse.status} for ${defaultPackageName}@${version}.`)
}

const npmTokenLine = `${registryHostPrefix}:_authToken=`
if (npmrc.includes(npmTokenLine)) {
  fail(`.npmrc must not commit ${npmTokenLine} entries.`)
}

console.log(
  `✅ Forgejo package source verified for ${defaultPackageName}@${version} via ${dist.tarball}.`,
)
