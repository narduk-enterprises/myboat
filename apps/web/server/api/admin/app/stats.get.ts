import { sql } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import {
  mediaItems,
  passages,
  publicProfiles,
  vesselInstallations,
  vesselInstallationApiKeys,
  vessels,
} from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useAppDatabase(event)

  const [
    profileCount,
    vesselCount,
    installationCount,
    keyCount,
    passageCount,
    mediaCount,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(publicProfiles).get(),
    db.select({ count: sql<number>`count(*)` }).from(vessels).get(),
    db.select({ count: sql<number>`count(*)` }).from(vesselInstallations).get(),
    db.select({ count: sql<number>`count(*)` }).from(vesselInstallationApiKeys).get(),
    db.select({ count: sql<number>`count(*)` }).from(passages).get(),
    db.select({ count: sql<number>`count(*)` }).from(mediaItems).get(),
  ])

  return {
    captainProfiles: profileCount?.count ?? 0,
    vessels: vesselCount?.count ?? 0,
    installations: installationCount?.count ?? 0,
    ingestKeys: keyCount?.count ?? 0,
    passages: passageCount?.count ?? 0,
    mediaItems: mediaCount?.count ?? 0,
  }
})
