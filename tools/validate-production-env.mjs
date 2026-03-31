import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expectedSiteURL = 'https://mybo.at'
const expectedAuthAuthorityURL = 'https://auth.platform.nard.uk'

const requiredVariables = [
  'SITE_URL',
  'AUTH_AUTHORITY_URL',
  'SUPABASE_AUTH_ANON_KEY',
  'SUPABASE_AUTH_SERVICE_ROLE_KEY',
  'AUTH_PROVIDERS',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'FORGEJO_TOKEN',
]

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

for (const name of requiredVariables) {
  if (!process.env[name]?.trim()) {
    fail(`Missing required environment variable ${name}.`)
  }
}

if (process.env.SITE_URL !== expectedSiteURL) {
  fail(`SITE_URL must be ${expectedSiteURL}, received ${process.env.SITE_URL}.`)
}

if (process.env.AUTH_AUTHORITY_URL !== expectedAuthAuthorityURL) {
  fail(
    `AUTH_AUTHORITY_URL must be ${expectedAuthAuthorityURL}, received ${process.env.AUTH_AUTHORITY_URL}.`,
  )
}

const providers = process.env.AUTH_PROVIDERS.split(',')
  .map((provider) => provider.trim().toLowerCase())
  .filter(Boolean)

if (providers.length !== 2 || !providers.includes('apple') || !providers.includes('email')) {
  fail(`AUTH_PROVIDERS must be exactly apple,email, received ${process.env.AUTH_PROVIDERS}.`)
}

console.log(`✅ Production deploy env validated for ${rootDir}.`)
