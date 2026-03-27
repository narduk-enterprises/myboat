import { and, desc, eq, isNull, ne } from 'drizzle-orm'
import { defineUserMutation } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { vesselInstallations, vessels } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authProfile,
  },
  async ({ event, user }) => {
    const installationId = getRouterParam(event, 'installationId')

    if (!installationId) {
      throw createError({ statusCode: 400, message: 'Missing installation ID.' })
    }

    const db = useAppDatabase(event)
    const now = new Date().toISOString()

    const installation = await db
      .select({
        id: vesselInstallations.id,
        vesselId: vesselInstallations.vesselId,
        isPrimary: vesselInstallations.isPrimary,
      })
      .from(vesselInstallations)
      .innerJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
      .where(
        and(
          eq(vesselInstallations.id, installationId),
          eq(vessels.ownerUserId, user.id),
          isNull(vesselInstallations.archivedAt),
        ),
      )
      .get()

    if (!installation) {
      throw createError({ statusCode: 404, message: 'Installation not found.' })
    }

    await db
      .update(vesselInstallations)
      .set({
        archivedAt: now,
        isPrimary: false,
        connectionState: 'archived',
        updatedAt: now,
      })
      .where(eq(vesselInstallations.id, installation.id))

    let promotedInstallationId: string | null = null

    if (installation.isPrimary) {
      const fallbackInstallation = await db
        .select({ id: vesselInstallations.id })
        .from(vesselInstallations)
        .where(
          and(
            eq(vesselInstallations.vesselId, installation.vesselId),
            isNull(vesselInstallations.archivedAt),
            ne(vesselInstallations.id, installation.id),
          ),
        )
        .orderBy(desc(vesselInstallations.updatedAt))
        .get()

      if (fallbackInstallation) {
        await db
          .update(vesselInstallations)
          .set({
            isPrimary: true,
            updatedAt: now,
          })
          .where(eq(vesselInstallations.id, fallbackInstallation.id))

        promotedInstallationId = fallbackInstallation.id
      }
    }

    return {
      ok: true,
      archivedInstallationId: installation.id,
      promotedInstallationId,
    }
  },
)
