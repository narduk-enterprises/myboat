import { requireAuth } from '#layer/server/utils/auth'
import { getInstallationDetail } from '#server/utils/myboat'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const installationId = getRouterParam(event, 'installationId')

  if (!installationId) {
    throw createError({ statusCode: 400, message: 'Missing installation ID.' })
  }

  const detail = await getInstallationDetail(event, user.id, installationId)

  if (!detail) {
    throw createError({ statusCode: 404, message: 'Installation not found.' })
  }

  return detail
})
