import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { apiKeys } from '#layer/server/database/schema'
import {
  vesselInstallationApiKeys,
  vesselInstallations,
  vessels,
} from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export interface IngestInstallationBinding {
  apiKeyId: string
  installationId: string
  vesselId: string
  ownerUserId: string
  installationType: string
  isPrimary: boolean
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function requireIngestInstallationBinding(event: H3Event) {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Missing ingest bearer token.' })
  }

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey) {
    throw createError({ statusCode: 401, message: 'Missing ingest bearer token.' })
  }

  const keyHash = await sha256(rawKey)
  const db = useAppDatabase(event)

  const installationBinding = await db
    .select({
      apiKeyId: apiKeys.id,
      installationId: vesselInstallationApiKeys.installationId,
      vesselId: vesselInstallations.vesselId,
      ownerUserId: vessels.ownerUserId,
      installationType: vesselInstallations.installationType,
      isPrimary: vesselInstallations.isPrimary,
    })
    .from(apiKeys)
    .innerJoin(vesselInstallationApiKeys, eq(apiKeys.id, vesselInstallationApiKeys.apiKeyId))
    .innerJoin(
      vesselInstallations,
      eq(vesselInstallationApiKeys.installationId, vesselInstallations.id),
    )
    .innerJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .get()

  if (!installationBinding) {
    throw createError({ statusCode: 401, message: 'Invalid ingest key.' })
  }

  return installationBinding satisfies IngestInstallationBinding
}
