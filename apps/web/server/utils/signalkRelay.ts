import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import { eq, isNotNull, sql } from 'drizzle-orm'
import { users } from '#layer/server/database/schema'
import { useDatabase } from '#layer/server/utils/database'
import {
  DEFAULT_SIGNALK_RELAY_UPSTREAM_URL,
  resolvePublicInstallationSignalKConfig,
  resolveInstallationSignalKConfig,
  resolveScopedSignalKUrl,
} from '../../shared/signalkRelay'

export function getSignalKRelayUpstreamUrl() {
  return useRuntimeConfig().signalkRelayUpstreamUrl || DEFAULT_SIGNALK_RELAY_UPSTREAM_URL
}

type RelayScopedUser = {
  id: string
  email: string | null | undefined
}

function getSignalKRelayOwnerConfig(event: H3Event) {
  const config = useRuntimeConfig(event)

  return {
    ownerAppleId: config.signalkRelayOwnerAppleId?.trim() || '',
    ownerEmail: config.signalkRelayOwnerEmail?.trim().toLowerCase() || '',
    ownerUserId: config.signalkRelayOwnerUserId?.trim() || '',
  }
}

async function shouldForceRelayForUser(event: H3Event, user: RelayScopedUser) {
  const ownerConfig = getSignalKRelayOwnerConfig(event)
  const normalizedEmail = user.email?.trim().toLowerCase() || ''

  if (ownerConfig.ownerUserId && ownerConfig.ownerUserId === user.id) {
    return true
  }

  if (ownerConfig.ownerEmail && ownerConfig.ownerEmail === normalizedEmail) {
    return true
  }

  const db = useDatabase(event)
  const localUser = await db
    .select({
      appleId: users.appleId,
      id: users.id,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .get()

  if (!localUser?.appleId) {
    return false
  }

  if (ownerConfig.ownerAppleId) {
    return ownerConfig.ownerAppleId === localUser.appleId
  }

  const appleUserCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(isNotNull(users.appleId))
    .get()

  return (appleUserCount?.count || 0) === 1
}

function resolveSignalKUrlForUser(options: {
  appOrigin: string
  currentSignalKUrl?: string | null
  forceRelay: boolean
}) {
  const { appOrigin, currentSignalKUrl = null, forceRelay } = options

  if (forceRelay) {
    return resolveScopedSignalKUrl({
      appOrigin,
      currentSignalKUrl,
      forceRelay: true,
    })
  }

  return currentSignalKUrl
}

function buildInstallationSignalKConfig(options: {
  appOrigin: string
  currentSignalKUrl?: string | null
  forceRelay: boolean
}) {
  const relaySignalKUrl = resolveSignalKUrlForUser({
    appOrigin: options.appOrigin,
    currentSignalKUrl: null,
    forceRelay: options.forceRelay,
  })

  return resolveInstallationSignalKConfig({
    currentSignalKUrl: options.currentSignalKUrl,
    relaySignalKUrl,
  })
}

export async function getDefaultSignalKUrlForUser(event: H3Event, user: RelayScopedUser) {
  const appOrigin = getRequestURL(event).origin
  const forceRelay = await shouldForceRelayForUser(event, user)

  return resolveSignalKUrlForUser({
    appOrigin,
    currentSignalKUrl: null,
    forceRelay,
  })
}

export async function applySignalKRelayDefault<T extends { signalKUrl: string | null }>(
  event: H3Event,
  user: RelayScopedUser,
  installation: T,
) {
  const appOrigin = getRequestURL(event).origin
  const forceRelay = await shouldForceRelayForUser(event, user)

  return {
    ...installation,
    ...buildInstallationSignalKConfig({
      appOrigin,
      currentSignalKUrl: installation.signalKUrl,
      forceRelay,
    }),
  }
}

export async function applySignalKRelayDefaults<T extends { signalKUrl: string | null }>(
  event: H3Event,
  user: RelayScopedUser,
  installations: T[],
) {
  const appOrigin = getRequestURL(event).origin
  const forceRelay = await shouldForceRelayForUser(event, user)

  return installations.map((installation) => ({
    ...installation,
    ...buildInstallationSignalKConfig({
      appOrigin,
      currentSignalKUrl: installation.signalKUrl,
      forceRelay,
    }),
  }))
}

export function applyPublicSignalKDefaults<T extends { signalKUrl: string | null }>(
  event: H3Event,
  installations: T[],
) {
  const appOrigin = getRequestURL(event).origin

  return installations.map((installation) => ({
    ...installation,
    ...resolvePublicInstallationSignalKConfig({
      appOrigin,
      currentSignalKUrl: installation.signalKUrl,
    }),
  }))
}
