export type VesselLiveRouteMatch =
  | {
      namespace: 'auth'
      vesselSlug: string
    }
  | {
      namespace: 'public'
      username: string
      vesselSlug: string
    }

const AUTH_LIVE_ROUTE_RE = /^\/api\/app\/vessels\/([^/]+)\/live$/
const PUBLIC_LIVE_ROUTE_RE = /^\/api\/public\/([^/]+)\/([^/]+)\/live$/

export function matchVesselLiveRoute(pathname: string): VesselLiveRouteMatch | null {
  const authMatch = pathname.match(AUTH_LIVE_ROUTE_RE)
  if (authMatch) {
    return {
      namespace: 'auth',
      vesselSlug: authMatch[1]!,
    }
  }

  const publicMatch = pathname.match(PUBLIC_LIVE_ROUTE_RE)
  if (publicMatch) {
    return {
      namespace: 'public',
      username: publicMatch[1]!,
      vesselSlug: publicMatch[2]!,
    }
  }

  return null
}

export function toVesselDetailPath(route: VesselLiveRouteMatch) {
  if (route.namespace === 'auth') {
    return `/api/app/vessels/${route.vesselSlug}`
  }

  return `/api/public/${route.username}/${route.vesselSlug}`
}
