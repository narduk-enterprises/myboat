import { getCaptainProfileByUsername, getPublicVesselByUsernameAndSlug } from '#server/utils/myboat'
import { getPassagePlaybackBundleForVessel } from '#server/utils/passagePlayback'

export default defineEventHandler(async (event) => {
  const username = getRouterParam(event, 'username')
  const vesselSlug = getRouterParam(event, 'vesselSlug')
  const passageId = getRouterParam(event, 'passageId')

  if (!username || !vesselSlug || !passageId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing public playback route params.' })
  }

  const [profileRow, vesselRow] = await Promise.all([
    getCaptainProfileByUsername(event, username),
    getPublicVesselByUsernameAndSlug(event, username, vesselSlug),
  ])

  if (!profileRow?.shareProfile || !vesselRow) {
    throw createError({ statusCode: 404, statusMessage: 'Public vessel not found.' })
  }

  const bundle = await getPassagePlaybackBundleForVessel(event, vesselRow.id, passageId)
  if (!bundle) {
    throw createError({ statusCode: 404, statusMessage: 'Playback bundle unavailable.' })
  }

  return bundle
})
