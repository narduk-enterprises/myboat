import type { AisHubSearchResult } from '~/types/myboat'
import { z } from 'zod'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { rememberAisHubResults, refreshAisHubResultsByMmsis } from '#server/utils/aishub'
import { upsertFollowedVesselsForUser } from '#server/utils/myboat'

const importItemSchema = z.object({
  mmsi: z
    .string()
    .trim()
    .regex(/^\d{9}$/),
  name: z.string().trim().min(1).max(120),
  imo: z.string().trim().max(20).optional().nullable(),
  callSign: z.string().trim().max(40).optional().nullable(),
  destination: z.string().trim().max(120).optional().nullable(),
})

const bodySchema = z.object({
  items: z.array(importItemSchema).min(1).max(200),
})

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authProfile,
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const now = new Date().toISOString()
    const uniqueItems = body.items.filter(
      (item, index, collection) =>
        collection.findIndex((candidate) => candidate.mmsi === item.mmsi) === index,
    )
    const refreshedLookup = await refreshAisHubResultsByMmsis(
      event,
      uniqueItems.map((item) => item.mmsi),
      { bestEffort: true },
    )
    const refreshedResults = new Map(
      refreshedLookup.results.map((result) => [result.mmsi, result]),
    )

    const importResults: AisHubSearchResult[] = uniqueItems.map((item) => {
      const stored = refreshedResults.get(item.mmsi)

      if (stored) {
        return stored
      }

      return {
        source: 'aishub',
        matchMode: 'mmsi',
        mmsi: item.mmsi,
        imo: item.imo ?? null,
        name: item.name,
        callSign: item.callSign ?? null,
        destination: item.destination ?? null,
        lastReportAt: null,
        positionLat: null,
        positionLng: null,
        shipType: null,
        sourceStations: [],
      }
    })

    await rememberAisHubResults(event, importResults, now)

    return {
      ok: true,
      imported: await upsertFollowedVesselsForUser(event, user.id, importResults, now),
    }
  },
)
