import { desc, eq, sql } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import { users } from '#layer/server/database/schema'
import { vesselInstallations, vessels } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useAppDatabase(event)

  const [totalResult, installationRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(vesselInstallations).get(),
    db
      .select({
        id: vesselInstallations.id,
        label: vesselInstallations.label,
        edgeHostname: vesselInstallations.edgeHostname,
        connectionState: vesselInstallations.connectionState,
        lastSeenAt: vesselInstallations.lastSeenAt,
        eventCount: vesselInstallations.eventCount,
        vesselName: vessels.name,
        vesselSlug: vessels.slug,
        ownerEmail: users.email,
        ownerName: users.name,
        createdAt: vesselInstallations.createdAt,
      })
      .from(vesselInstallations)
      .leftJoin(vessels, eq(vesselInstallations.vesselId, vessels.id))
      .leftJoin(users, eq(vessels.ownerUserId, users.id))
      .orderBy(desc(vesselInstallations.createdAt))
      .limit(50)
      .all(),
  ])

  const liveCount = installationRows.filter((row) => row.connectionState === 'live').length

  return {
    installations: installationRows,
    total: totalResult?.count ?? 0,
    liveCount,
  }
})
