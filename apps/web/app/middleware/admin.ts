/**
 * Admin middleware — redirects non-admin users to the captain dashboard.
 *
 * Layered on top of auth: refreshes the session and checks the isAdmin flag.
 *
 * Usage: `definePageMeta({ middleware: ['admin'] })`
 */
export default defineNuxtRouteMiddleware(async () => {
  const { loggedIn, user, fetch: refreshSession, clear } = useUserSession()

  try {
    await refreshSession()
  } catch {
    await clear()
  }

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  if (!user.value?.isAdmin) {
    return navigateTo('/dashboard')
  }
})
