import { requireAuth } from '#layer/server/utils/auth'
import { getHistoryCatalog } from '#server/utils/history'
import { getVesselBySlug } from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const vesselSlug = getRouterParam(event, 'vesselSlug')
  if (!vesselSlug) {
    throw createError({ statusCode: 400, message: 'Missing vessel slug.' })
  }

  const vessel = await getVesselBySlug(event, user.id, vesselSlug)
  if (!vessel) {
    throw createError({ statusCode: 404, message: 'Vessel not found.' })
  }

  return getHistoryCatalog('owner')
})
