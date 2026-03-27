import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { resolveSignalKRelayOrigin } from './shared/signalkRelay'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localNuxtPort = Number(process.env.NUXT_PORT || 3000)
const localSiteUrl = `http://localhost:${Number.isFinite(localNuxtPort) ? localNuxtPort : 3000}`
const canonicalSiteUrl = process.env.SITE_URL || 'https://mybo.at'
const publicAppUrl = process.env.SITE_URL || localSiteUrl
const relayCspConnectSrc = [
  process.env.CSP_CONNECT_SRC || '',
  resolveSignalKRelayOrigin(publicAppUrl),
]
  .filter(Boolean)
  .join(', ')

const configuredAuthBackend = process.env.AUTH_BACKEND
const authBackend =
  configuredAuthBackend === 'supabase' || configuredAuthBackend === 'local'
    ? configuredAuthBackend
    : process.env.AUTH_AUTHORITY_URL && process.env.SUPABASE_AUTH_ANON_KEY
      ? 'supabase'
      : 'local'
const authAuthorityUrl = process.env.AUTH_AUTHORITY_URL || ''

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

  // The app references its local components without directory prefixes
  // (AppBrandMark, AuthDock, OnboardingForm, MarineTrackMap, etc.), so expose
  // the full app/components tree with prefixless auto-imports.
  components: [{ path: resolve(__dirname, 'app/components'), pathPrefix: false }],

  // nitro-cloudflare-dev proxies D1 bindings to the local dev server
  modules: ['nitro-cloudflare-dev'],

  nitro: {
    experimental: {
      websocket: true,
    },
    cloudflareDev: {
      configPath: resolve(__dirname, 'wrangler.json'),
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
    authBackend,
    authAuthorityUrl,
    authAnonKey: process.env.SUPABASE_AUTH_ANON_KEY || '',
    authServiceRoleKey: process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY || '',
    authStorageKey: process.env.AUTH_STORAGE_KEY || 'web-auth',
    signalkRelayUpstreamUrl:
      process.env.SIGNALK_RELAY_UPSTREAM_URL ||
      'wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=none',
    signalkRelayOwnerAppleId: process.env.SIGNALK_RELAY_OWNER_APPLE_ID || '',
    signalkRelayOwnerEmail: process.env.SIGNALK_RELAY_OWNER_EMAIL || '',
    signalkRelayOwnerUserId: process.env.SIGNALK_RELAY_OWNER_USER_ID || '',
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
      authRedirectPath: '/dashboard/',
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
      cspConnectSrc: relayCspConnectSrc,
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
