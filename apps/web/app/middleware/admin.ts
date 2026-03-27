export default defineNuxtRouteMiddleware(async () => {
  const config = useRuntimeConfig()
  const { loggedIn, user, fetch: refreshSession, clear } = useUserSession()

  try {
    await refreshSession()
  } catch {
    await clear()
  }

  if (!loggedIn.value) {
    return navigateTo(config.public.authLoginPath)
  }

  if (!user.value?.isAdmin) {
    return navigateTo('/dashboard', { replace: true })
  }
})
