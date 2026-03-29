/// <reference types="@cloudflare/workers-types" />
import { AISHUB_ROLLING_SYNC_CRON, runAisHubRollingSync } from '#server/utils/aishub-sync'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    if (controller.cron !== AISHUB_ROLLING_SYNC_CRON) {
      return
    }

    const d1 = (env as { DB?: D1Database })?.DB
    if (!d1) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          scope: 'aishub-sync',
          message: 'Skipping scheduled AIS Hub sync because the DB binding is unavailable.',
        }),
      )
      return
    }

    const runtimeConfig = useRuntimeConfig()
    await runAisHubRollingSync(d1, runtimeConfig.aisHubKey)
  })
})
