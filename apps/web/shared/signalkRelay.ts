export const SIGNALK_RELAY_PATH = '/api/signalk/relay'
export const DEFAULT_SIGNALK_RELAY_UPSTREAM_URL =
  'wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all'

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

  if (
    relaySignalKUrl &&
    (!currentSignalKUrl ||
      currentSignalKUrl === relaySignalKUrl ||
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

export function resolvePublicInstallationSignalKConfig(options: {
  appOrigin: string
  currentSignalKUrl?: string | null
}) {
  const currentSignalKUrl = normalizeSignalKUrl(options.currentSignalKUrl)

  if (currentSignalKUrl && isTideyePublicSignalKUrl(currentSignalKUrl)) {
    return resolveInstallationSignalKConfig({
      currentSignalKUrl,
      relaySignalKUrl: resolveSignalKRelayUrl(options.appOrigin),
    })
  }

  return {
    signalKUrl: null,
    collectorSignalKUrl: null,
    relaySignalKUrl: null,
    signalKAccessMode: 'unset' as const,
  }
}

export function resolveScopedSignalKUrl(options: {
  appOrigin: string
  currentSignalKUrl?: string | null
  forceRelay?: boolean
}) {
  const { appOrigin, currentSignalKUrl = null, forceRelay = false } = options

  if (forceRelay) {
    return resolveSignalKRelayUrl(appOrigin)
  }

  return currentSignalKUrl
}
