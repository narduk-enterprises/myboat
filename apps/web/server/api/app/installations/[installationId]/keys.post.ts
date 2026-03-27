import { and, eq } from 'drizzle-orm'
import { apiKeys } from '#layer/server/database/schema'
import { generateApiKey } from '#layer/server/utils/auth'
import { defineUserMutation } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import {
  vesselInstallationApiKeys,
  vesselInstallations,
  vessels,
} from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authApiKeys,
  },
  async ({ event, user }) => {
    const installationId = getRouterParam(event, 'installationId')

    if (!installationId) {
      throw createError({ statusCode: 400, message: 'Missing installation ID.' })
    }

    const db = useAppDatabase(event)
    const installation = await db
      .select({
        id: vesselInstallations.id,
        label: vesselInstallations.label,
      })
      .from(vesselInstallations)
      .innerJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
      .where(and(eq(vesselInstallations.id, installationId), eq(vessels.ownerUserId, user.id)))
      .get()

    if (!installation) {
      throw createError({ statusCode: 404, message: 'Installation not found.' })
    }

    const { rawKey, keyHash, keyPrefix } = await generateApiKey()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await db.insert(apiKeys).values({
      id,
      userId: user.id,
      name: `${installation.label} ingest key`,
      keyHash,
      keyPrefix,
      createdAt: now,
    })

    await db.insert(vesselInstallationApiKeys).values({
      apiKeyId: id,
      installationId: installation.id,
      createdAt: now,
    })

    return {
      id,
      name: `${installation.label} ingest key`,
      keyPrefix,
      rawKey,
      createdAt: now,
      lastUsedAt: null,
    }
  },
)
