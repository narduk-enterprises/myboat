import type { AisContactSummary } from '~/types/myboat'
import { z } from 'zod'
import { defineUserMutation, withValidatedBody } from '#layer/server/utils/mutation'
import { RATE_LIMIT_POLICIES } from '#layer/server/utils/rateLimit'
import { enrichTrafficContactsForVessel } from '#server/utils/traffic'
import { getVesselBySlug } from '#server/utils/myboat'

const aisContactSchema: z.ZodType<AisContactSummary> = z.object({
  id: z.string().trim().min(1).max(255),
  name: z.string().trim().max(120).nullable(),
  mmsi: z.string().trim().max(32).nullable(),
  shipType: z.number().int().min(0).max(999).nullable(),
  lat: z.number().finite().min(-90).max(90).nullable(),
  lng: z.number().finite().min(-180).max(180).nullable(),
  cog: z.number().finite().nullable(),
  sog: z.number().finite().nullable(),
  heading: z.number().finite().nullable(),
  destination: z.string().trim().max(120).nullable(),
  callSign: z.string().trim().max(40).nullable(),
  length: z.number().finite().nullable(),
  beam: z.number().finite().nullable(),
  draft: z.number().finite().nullable(),
  navState: z.string().trim().max(120).nullable(),
  lastUpdateAt: z.number().finite(),
})

const bodySchema = z.object({
  contacts: z.array(aisContactSchema).max(32),
})

export default defineUserMutation<z.infer<typeof bodySchema>>(
  {
    rateLimit: RATE_LIMIT_POLICIES.authProfile,
    parseBody: withValidatedBody(bodySchema.parse),
  },
  async ({ event, user, body }) => {
    const vesselSlug = getRouterParam(event, 'vesselSlug')

    if (!vesselSlug) {
      throw createError({ statusCode: 400, message: 'Missing vessel slug.' })
    }

    const vessel = await getVesselBySlug(event, user.id, vesselSlug)
    if (!vessel) {
      throw createError({ statusCode: 404, message: 'Vessel not found.' })
    }

    return {
      contacts: await enrichTrafficContactsForVessel(event, vessel.id, body.contacts),
    }
  },
)
