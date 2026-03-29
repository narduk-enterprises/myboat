import { proxyVesselLiveUpgrade } from '#server/utils/liveBroker'
import { getPublicVesselByUsernameAndSlug } from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')
  const vesselSlug = getRouterParam(event, 'vesselSlug')

  if (!username || !vesselSlug) {
    throw createError({
      statusCode: 400,
      message: 'Missing public vessel route params.',
    })
  }

  const vessel = await getPublicVesselByUsernameAndSlug(event, username, vesselSlug)
  if (!vessel) {
    throw createError({
      statusCode: 404,
      message: 'Public vessel not found.',
    })
  }

  return proxyVesselLiveUpgrade(event, vessel.id)
})
