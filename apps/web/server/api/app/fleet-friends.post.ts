import type { AisHubSearchResult } from '~/types/myboat'
import { z } from 'zod'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { rememberAisHubResults } from '#server/utils/aishub'
import { upsertFollowedVesselForUser } from '#server/utils/myboat'

const bodySchema = z.object({
  source: z.literal('aishub').default('aishub'),
  matchMode: z.enum(['mmsi', 'name']),
  mmsi: z
    .string()
    .trim()
    .regex(/^\d{9}$/),
  imo: z.string().trim().max(20).optional().nullable(),
  name: z.string().trim().min(1).max(120),
  callSign: z.string().trim().max(40).optional().nullable(),
  destination: z.string().trim().max(120).optional().nullable(),
  lastReportAt: z.string().datetime().optional().nullable(),
  positionLat: z.number().finite().min(-90).max(90).optional().nullable(),
  positionLng: z.number().finite().min(-180).max(180).optional().nullable(),
  shipType: z.number().int().min(0).max(999).optional().nullable(),
  sourceStations: z.array(z.string().trim().min(1).max(12)).max(24).default([]),
})

export default defineUserMutation(
  {
    rateLimit: RATE_LIMIT_POLICIES.authProfile,
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const now = new Date().toISOString()
    const result: AisHubSearchResult = {
      source: body.source,
      matchMode: body.matchMode,
      mmsi: body.mmsi,
      imo: body.imo ?? null,
      name: body.name,
      callSign: body.callSign ?? null,
      destination: body.destination ?? null,
      lastReportAt: body.lastReportAt ?? null,
      positionLat: body.positionLat ?? null,
      positionLng: body.positionLng ?? null,
      shipType: body.shipType ?? null,
      sourceStations: body.sourceStations,
    }

    await rememberAisHubResults(event, [result], now)

    const followedVessel = await upsertFollowedVesselForUser(event, user.id, result, now)

    return {
      ok: true,
      mmsi: body.mmsi,
      followedVessel,
    }
  },
)
