import { desc, eq, sql } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import { users } from '#layer/server/database/schema'
import { vessels } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useAppDatabase(event)

  const [totalResult, vesselRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(vessels).get(),
    db
      .select({
        id: vessels.id,
        slug: vessels.slug,
        name: vessels.name,
        vesselType: vessels.vesselType,
        homePort: vessels.homePort,
        isPrimary: vessels.isPrimary,
        sharePublic: vessels.sharePublic,
        ownerEmail: users.email,
        ownerName: users.name,
        createdAt: vessels.createdAt,
      })
      .from(vessels)
      .leftJoin(users, eq(vessels.ownerUserId, users.id))
      .orderBy(desc(vessels.createdAt))
      .limit(50)
      .all(),
  ])

  return {
    vessels: vesselRows,
    total: totalResult?.count ?? 0,
  }
})
