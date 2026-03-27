export const SIGNALK_RELAY_PATH = '/api/signalk/relay'
export const DEFAULT_SIGNALK_RELAY_UPSTREAM_URL =
  'wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=none'
export const DEMO_ACCOUNT_EMAIL = 'demo@example.com'
export const DEFAULT_LOCAL_DEMO_SIGNALK_URL = `ws://localhost:3000${SIGNALK_RELAY_PATH}`

export type SignalKAccessMode = 'direct' | 'relay' | 'unset'

function normalizeSignalKUrl(url: string | null | undefined) {
  const normalizedUrl = url?.trim()
  return normalizedUrl ? normalizedUrl : null
}

function isTideyePublicSignalKUrl(url: string | null) {
  if (!url) {
    return false
  }

  try {
    const currentUrl = new URL(url)
    const upstreamUrl = new URL(DEFAULT_SIGNALK_RELAY_UPSTREAM_URL)

    return currentUrl.origin === upstreamUrl.origin && currentUrl.pathname === upstreamUrl.pathname
  } catch {
    return url === DEFAULT_SIGNALK_RELAY_UPSTREAM_URL
  }
}

export function isDemoAccountEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === DEMO_ACCOUNT_EMAIL
}

export function resolveSignalKRelayUrl(baseUrl: string, relayPath = SIGNALK_RELAY_PATH) {
  const relayUrl = new URL(relayPath, baseUrl)

  if (relayUrl.protocol === 'http:') {
    relayUrl.protocol = 'ws:'
  } else if (relayUrl.protocol === 'https:') {
    relayUrl.protocol = 'wss:'
  }

  return relayUrl.toString()
}

export function resolveSignalKRelayOrigin(baseUrl: string) {
  const relayOrigin = new URL(baseUrl)

  if (relayOrigin.protocol === 'http:') {
    relayOrigin.protocol = 'ws:'
  } else if (relayOrigin.protocol === 'https:') {
    relayOrigin.protocol = 'wss:'
  }

  relayOrigin.pathname = ''
  relayOrigin.search = ''
  relayOrigin.hash = ''

  return relayOrigin.toString().replace(/\/$/, '')
}

export function resolveInstallationSignalKConfig(options: {
  currentSignalKUrl?: string | null
  relaySignalKUrl?: string | null
}) {
  const currentSignalKUrl = normalizeSignalKUrl(options.currentSignalKUrl)
  const relaySignalKUrl = normalizeSignalKUrl(options.relaySignalKUrl)
  const relayFallbackTargets = new Set(
    [DEFAULT_LOCAL_DEMO_SIGNALK_URL, relaySignalKUrl].filter((value): value is string =>
      Boolean(value),
    ),
  )

  if (
    relaySignalKUrl &&
    (!currentSignalKUrl ||
      relayFallbackTargets.has(currentSignalKUrl) ||
      isTideyePublicSignalKUrl(currentSignalKUrl))
  ) {
    return {
      signalKUrl: currentSignalKUrl,
      collectorSignalKUrl: relaySignalKUrl,
      relaySignalKUrl,
      signalKAccessMode: 'relay' as const,
    }
  }

  if (currentSignalKUrl) {
    return {
      signalKUrl: currentSignalKUrl,
      collectorSignalKUrl: currentSignalKUrl,
      relaySignalKUrl,
      signalKAccessMode: 'direct' as const,
    }
  }

  return {
    signalKUrl: null,
    collectorSignalKUrl: null,
    relaySignalKUrl,
    signalKAccessMode: 'unset' as const,
  }
}

export function resolveScopedSignalKUrl(options: {
  appOrigin: string
  currentSignalKUrl?: string | null
  fallbackToRelay?: boolean
  forceRelay?: boolean
}) {
  const {
    appOrigin,
    currentSignalKUrl = null,
    fallbackToRelay = false,
    forceRelay = false,
  } = options

  if (forceRelay) {
    return resolveSignalKRelayUrl(appOrigin)
  }

  if (
    fallbackToRelay &&
    (!currentSignalKUrl || currentSignalKUrl === DEFAULT_LOCAL_DEMO_SIGNALK_URL)
  ) {
    return resolveSignalKRelayUrl(appOrigin)
  }

  return currentSignalKUrl
}

export function resolveDemoSignalKUrl(options: {
  appOrigin: string
  currentSignalKUrl?: string | null
  isDev: boolean
  userEmail?: string | null
}) {
  const { appOrigin, currentSignalKUrl = null, isDev, userEmail } = options

  if (!isDev || !isDemoAccountEmail(userEmail)) {
    return currentSignalKUrl
  }

  return resolveScopedSignalKUrl({
    appOrigin,
    currentSignalKUrl,
    fallbackToRelay: true,
  })
}
