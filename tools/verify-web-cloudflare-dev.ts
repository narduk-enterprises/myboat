import process from 'node:process'
import { resolve } from 'node:path'
import { getPlatformProxy } from 'wrangler'

type WebDevEnv = {
  DB?: D1Database
  KV?: KVNamespace
  VESSEL_LIVE_BROKER?: DurableObjectNamespace
}

const appDir = resolve(process.cwd())
const configPath = resolve(appDir, 'wrangler.dev.json')
const persistPath = resolve(appDir, '.wrangler/state/v3')

async function main() {
  const proxy = await getPlatformProxy<WebDevEnv>({
    configPath,
    persist: {
      path: persistPath,
    },
  })

  try {
    if (!proxy.env.DB || typeof proxy.env.DB.prepare !== 'function') {
      throw new Error('D1 binding `DB` is not available in local Cloudflare dev.')
    }

    if (!proxy.env.KV || typeof proxy.env.KV.get !== 'function') {
      throw new Error('KV binding `KV` is not available in local Cloudflare dev.')
    }

    if (
      !proxy.env.VESSEL_LIVE_BROKER ||
      typeof proxy.env.VESSEL_LIVE_BROKER.idFromName !== 'function'
    ) {
      throw new Error(
        'Durable Object binding `VESSEL_LIVE_BROKER` is not available in local Cloudflare dev.',
      )
    }

    proxy.env.VESSEL_LIVE_BROKER.idFromName('local-dev-smoke')
    console.log('✅ Local Cloudflare dev bindings ready: D1, KV, and VESSEL_LIVE_BROKER.')
  } finally {
    await proxy.dispose()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`❌ ${message}`)
  process.exitCode = 1
})
