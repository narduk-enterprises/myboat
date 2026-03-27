import { desc, eq, sql } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import { users } from '#layer/server/database/schema'
import { vesselInstallations, vesselLiveSnapshots, vessels } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useAppDatabase(event)

  const [snapshotCount, snapshotRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(vesselLiveSnapshots).get(),
    db
      .select({
        vesselId: vesselLiveSnapshots.vesselId,
        source: vesselLiveSnapshots.source,
        observedAt: vesselLiveSnapshots.observedAt,
        positionLat: vesselLiveSnapshots.positionLat,
        positionLng: vesselLiveSnapshots.positionLng,
        speedOverGround: vesselLiveSnapshots.speedOverGround,
        updatedAt: vesselLiveSnapshots.updatedAt,
        vesselName: vessels.name,
        ownerEmail: users.email,
        eventCount: vesselInstallations.eventCount,
      })
      .from(vesselLiveSnapshots)
      .leftJoin(vessels, eq(vesselLiveSnapshots.vesselId, vessels.id))
      .leftJoin(users, eq(vessels.ownerUserId, users.id))
      .leftJoin(vesselInstallations, eq(vesselInstallations.vesselId, vessels.id))
      .orderBy(desc(vesselLiveSnapshots.updatedAt))
      .limit(50)
      .all(),
  ])

  return {
    snapshots: snapshotRows,
    total: snapshotCount?.count ?? 0,
  }
})
