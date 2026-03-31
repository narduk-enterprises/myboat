import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localNuxtPort = Number(process.env.NUXT_PORT || 3000)
const localSiteUrl = `http://localhost:${Number.isFinite(localNuxtPort) ? localNuxtPort : 3000}`
const canonicalSiteUrl = process.env.SITE_URL || 'https://mybo.at'
const publicAppUrl = process.env.SITE_URL || localSiteUrl
const localCloudflareDevConfigPath = process.env.NUXT_CLOUDFLARE_DEV_CONFIG_PATH
  ? resolve(__dirname, process.env.NUXT_CLOUDFLARE_DEV_CONFIG_PATH)
  : resolve(__dirname, 'wrangler.dev.json')
const cloudflareDevConfigPath = existsSync(localCloudflareDevConfigPath)
  ? localCloudflareDevConfigPath
  : resolve(__dirname, 'wrangler.json')
const cloudflareDevPersistDir = resolve(__dirname, '.wrangler/state/v3')

const configuredAuthBackend = process.env.AUTH_BACKEND
const authBackend =
  configuredAuthBackend === 'supabase' || configuredAuthBackend === 'local'
    ? configuredAuthBackend
    : process.env.AUTH_AUTHORITY_URL && process.env.SUPABASE_AUTH_ANON_KEY
      ? 'supabase'
      : 'local'
const authAuthorityUrl = process.env.AUTH_AUTHORITY_URL || ''
const appOrmTablesEntry = './server/database/app-schema.ts'

function parseAuthProviders(value: string | undefined) {
  return (value || 'apple,email')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider, index, providers) => provider && providers.indexOf(provider) === index)
}

const authProviders =
  authBackend === 'supabase' ? parseAuthProviders(process.env.AUTH_PROVIDERS) : ['email']
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Extend the published Narduk Nuxt Layer
  extends: ['@narduk-enterprises/narduk-nuxt-template-layer'],

  alias: {
    '#server/app-orm-tables': fileURLToPath(new URL(appOrmTablesEntry, import.meta.url)),
  },

  // The app references its local components without directory prefixes
  // (AppBrandMark, AuthDock, OnboardingForm, MyBoatSurfaceMap, etc.), so
  // expose the full app/components tree with prefixless auto-imports.
  components: [{ path: resolve(__dirname, 'app/components'), pathPrefix: false }],

  // nitro-cloudflare-dev proxies D1 bindings to the local dev server
  modules: ['@pinia/nuxt', 'nitro-cloudflare-dev'],

  nitro: {
    experimental: {
      websocket: true,
    },
    cloudflareDev: {
      configPath: cloudflareDevConfigPath,
      persistDir: cloudflareDevPersistDir,
      ...(process.env.NUXT_WRANGLER_ENVIRONMENT
        ? { environment: process.env.NUXT_WRANGLER_ENVIRONMENT }
        : {}),
    },
  },

  future: {
    compatibilityVersion: 4,
  },

  devServer: {
    port: Number.isFinite(localNuxtPort) ? localNuxtPort : 3000,
  },

  runtimeConfig: {
    // AIS Hub uses the `username` query param in its API URL; the canonical
    // Doppler secret name for that credential is `AIS_HUB_KEY`.
    aisHubKey: process.env.AIS_HUB_KEY || '',
    authBackend,
    authAuthorityUrl,
    authAnonKey: process.env.SUPABASE_AUTH_ANON_KEY || '',
    authServiceRoleKey: process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || '',
    authStorageKey: process.env.AUTH_STORAGE_KEY || 'web-auth',
    historyOwnerFreeMaxDays: Number(process.env.MYBOAT_HISTORY_OWNER_FREE_MAX_DAYS || 7),
    historyOwnerPaidMaxDays: Number(process.env.MYBOAT_HISTORY_OWNER_PAID_MAX_DAYS || 90),
    historyPaidUserIds: process.env.MYBOAT_HISTORY_PAID_USER_IDS || '',
    historyPublicMaxDays: Number(process.env.MYBOAT_HISTORY_PUBLIC_MAX_DAYS || 30),
    influxBucketCoreFree: process.env.INFLUX_BUCKET_CORE_FREE || process.env.INFLUX_BUCKET || '',
    influxBucketCorePaid:
      process.env.INFLUX_BUCKET_CORE_PAID ||
      process.env.INFLUX_BUCKET_CORE_FREE ||
      process.env.INFLUX_BUCKET ||
      '',
    influxBucketCoreRollup1h: process.env.INFLUX_BUCKET_CORE_ROLLUP_1H || '',
    influxBucketDebug: process.env.INFLUX_BUCKET_DEBUG || process.env.INFLUX_BUCKET || '',
    influxBucketDetailFree: process.env.INFLUX_BUCKET_DETAIL_FREE || '',
    influxBucketDetailPaid:
      process.env.INFLUX_BUCKET_DETAIL_PAID || process.env.INFLUX_BUCKET_DETAIL_FREE || '',
    influxBucketDetailRollup1h: process.env.INFLUX_BUCKET_DETAIL_ROLLUP_1H || '',
    influxQueryToken: process.env.INFLUX_QUERY_TOKEN || process.env.INFLUX_TOKEN || '',
    influxQueryUrl: process.env.INFLUX_QUERY_URL || process.env.INFLUX_WRITE_URL || '',
    influxWriteUrl: process.env.INFLUX_WRITE_URL || '',
    influxOrg: process.env.INFLUX_ORG || '',
    influxBucket: process.env.INFLUX_BUCKET || '',
    influxToken: process.env.INFLUX_WRITE_TOKEN || process.env.INFLUX_TOKEN || '',
    localBoatHostname: process.env.LOCAL_BOAT_HOSTNAME || 'myboat.local',
    localBrokerOrigin: process.env.MYBOAT_LOCAL_BROKER_ORIGIN || '',
    signalKHttpUrl: process.env.SIGNALK_HTTP_URL || '',
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
    posthogOwnerDistinctId: process.env.POSTHOG_OWNER_DISTINCT_ID || '',
    // Server-only (admin API routes)
    googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || '',
    posthogApiKey: process.env.POSTHOG_PERSONAL_API_KEY || '',
    gaPropertyId: process.env.GA_PROPERTY_ID || '',
    posthogProjectId: process.env.POSTHOG_PROJECT_ID || '',
    public: {
      authBackend,
      authAuthorityUrl,
      authLoginPath: '/login',
      authRegisterPath: '/register',
      authCallbackPath: '/auth/callback',
      authConfirmPath: '/auth/confirm',
      authResetPath: '/reset-password',
      authLogoutPath: '/logout',
      authRedirectPath: '/dashboard',
      authProviders,
      authPublicSignup: process.env.AUTH_PUBLIC_SIGNUP !== 'false',
      authRequireMfa: process.env.AUTH_REQUIRE_MFA === 'true',
      authTurnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
      appUrl: publicAppUrl,
      appName: process.env.APP_NAME || 'MyBoat',
      // Analytics (client-side tracking)
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
      cspConnectSrc: process.env.CSP_CONNECT_SRC || '',
      localBoatHostname: process.env.LOCAL_BOAT_HOSTNAME || 'myboat.local',
      localBrokerOrigin: process.env.MYBOAT_LOCAL_BROKER_ORIGIN || '',
      // IndexNow
      indexNowKey: process.env.INDEXNOW_KEY || '',
    },
  },

  site: {
    url: canonicalSiteUrl,
    name: 'MyBoat',
    description:
      'Public vessel identity, live telemetry, passages, media, and edge installs in one coherent marine platform.',
    defaultLocale: 'en',
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'MyBoat',
      url: canonicalSiteUrl,
      logo: '/logo.svg',
    },
  },

  colorMode: {
    preference: 'light',
  },

  image: {
    cloudflare: {
      baseURL: canonicalSiteUrl,
    },
  },
})
