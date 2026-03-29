import type {
  AisHubSearchResponse,
  AisHubSearchResult,
  AisHubSyncStatus,
  DashboardOverview,
  FollowedVesselImportItem,
  FollowedVesselImportResponse,
  FollowedVesselRefreshResponse,
  FollowedVesselSummary,
  InstallationDetailResponse,
  InstallationKeySummary,
  OnboardingPayload,
  PublicExploreResponse,
  PublicProfileResponse,
  PublicVesselDetailResponse,
  VesselDetailResponse,
  VesselMediaImportResponse,
  VesselMediaUpdatePayload,
} from '~/types/myboat'

export function useDashboardOverview(key = 'myboat-dashboard') {
  return useFetch<DashboardOverview>('/api/app/dashboard', {
    key,
  })
}

export function usePublicProfile(username: string) {
  return useFetch<PublicProfileResponse>(`/api/public/${username}`, {
    key: `myboat-public-${username}`,
  })
}

export function usePublicExplore() {
  return useFetch<PublicExploreResponse>('/api/public/explore', {
    key: 'myboat-public-explore',
  })
}

export function usePublicVesselDetail(username: string, vesselSlug: string) {
  return useFetch<PublicVesselDetailResponse>(`/api/public/${username}/${vesselSlug}`, {
    key: `myboat-public-vessel-${username}-${vesselSlug}`,
  })
}

const PUBLIC_VESSEL_REFRESH_MS = 10_000

export async function useLivePublicVesselDetail(username: string, vesselSlug: string) {
  let refreshTimer: number | null = null

  function clearRefreshTimer() {
    if (!refreshTimer) {
      return
    }

    clearInterval(refreshTimer)
    refreshTimer = null
  }

  onMounted(() => {
    if (!import.meta.client) {
      return
    }

    refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return
      }

      void refreshDetail()
    }, PUBLIC_VESSEL_REFRESH_MS)
  })

  onBeforeUnmount(() => {
    clearRefreshTimer()
  })

  const request = await usePublicVesselDetail(username, vesselSlug)
  const lastRefreshCompletedAt = shallowRef<string | null>(
    request.data.value ? new Date().toISOString() : null,
  )

  async function refreshDetail() {
    await request.refresh()
    lastRefreshCompletedAt.value = new Date().toISOString()
  }

  return {
    ...request,
    refreshDetail,
    refreshIntervalMs: PUBLIC_VESSEL_REFRESH_MS,
    lastRefreshCompletedAt: readonly(lastRefreshCompletedAt),
  }
}

export function useVesselDetail(vesselSlug: string) {
  return useFetch<VesselDetailResponse>(`/api/app/vessels/${vesselSlug}`, {
    key: `myboat-vessel-${vesselSlug}`,
  })
}

export function useInstallationDetail(installationId: string) {
  return useFetch<InstallationDetailResponse>(`/api/app/installations/${installationId}`, {
    key: `myboat-installation-${installationId}`,
  })
}

export function useUpdateVesselMedia(vesselSlug: string) {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function updateMedia(mediaId: string, payload: VesselMediaUpdatePayload) {
    pending.value = true

    try {
      return await appFetch<{ ok: true }>('/api/app/vessels/' + vesselSlug + '/media/' + mediaId, {
        method: 'PATCH',
        body: payload,
      })
    } finally {
      pending.value = false
    }
  }

  return {
    pending: readonly(pending),
    updateMedia,
  }
}

export function useImportVesselMedia(vesselSlug: string) {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function importMedia(payload: {
    items: Array<{
      passageId?: string | null
      title: string
      caption?: string | null
      imageUrl: string
      sharePublic?: boolean
      sourceKind?: 'manual' | 'apple_photos_seed'
      sourceAssetId?: string | null
      sourceFingerprint?: string | null
      matchStatus?: 'attached' | 'review'
      matchScore?: number | null
      matchReason?: string | null
      isCover?: boolean
      lat?: number | null
      lng?: number | null
      capturedAt?: string | null
    }>
  }) {
    pending.value = true

    try {
      return await appFetch<VesselMediaImportResponse>(
        '/api/app/vessels/' + vesselSlug + '/media/import',
        {
          method: 'POST',
          body: payload,
        },
      )
    } finally {
      pending.value = false
    }
  }

  return {
    importMedia,
    pending: readonly(pending),
  }
}

export function useSaveOnboarding() {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function saveOnboarding(payload: OnboardingPayload) {
    pending.value = true

    try {
      return await appFetch<{ redirectTo: string }>('/api/app/onboarding', {
        method: 'POST',
        body: payload,
      })
    } finally {
      pending.value = false
    }
  }

  return {
    pending: readonly(pending),
    saveOnboarding,
  }
}

export function useSearchAisHubVessels() {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function search(query: string) {
    pending.value = true

    try {
      return await appFetch<AisHubSearchResponse>('/api/app/aishub/search', {
        query: { q: query },
      })
    } finally {
      pending.value = false
    }
  }

  return {
    pending: readonly(pending),
    search,
  }
}

export function useAdminAisHubSyncStatus() {
  return useFetch<AisHubSyncStatus>('/api/admin/aishub/sync', {
    key: 'myboat-admin-aishub-sync',
  })
}

export function useRunAdminAisHubSync() {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function runSync() {
    pending.value = true

    try {
      return await appFetch<AisHubSyncStatus>('/api/admin/aishub/sync', {
        method: 'POST',
      })
    } finally {
      pending.value = false
    }
  }

  return {
    pending: readonly(pending),
    runSync,
  }
}

export function useFollowVessel() {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function followVessel(vessel: AisHubSearchResult) {
    pending.value = true

    try {
      return await appFetch<{ ok: true; mmsi: string; followedVessel: FollowedVesselSummary }>(
        '/api/app/fleet-friends',
        {
          method: 'POST',
          body: vessel,
        },
      )
    } finally {
      pending.value = false
    }
  }

  return {
    followVessel,
    pending: readonly(pending),
  }
}

export function useImportFollowedVessels() {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function importFollowedVessels(items: FollowedVesselImportItem[]) {
    pending.value = true

    try {
      return await appFetch<FollowedVesselImportResponse>('/api/app/fleet-friends/import', {
        method: 'POST',
        body: { items },
      })
    } finally {
      pending.value = false
    }
  }

  return {
    importFollowedVessels,
    pending: readonly(pending),
  }
}

export function useRemoveFollowedVessel() {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function removeFollowedVessel(followedVessel: Pick<FollowedVesselSummary, 'id'>) {
    pending.value = true

    try {
      return await appFetch<{ ok: true }>(`/api/app/fleet-friends/${followedVessel.id}`, {
        method: 'DELETE',
      })
    } finally {
      pending.value = false
    }
  }

  return {
    removeFollowedVessel,
    pending: readonly(pending),
  }
}

export function useRefreshFollowedVessels() {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function refreshFollowedVessels() {
    pending.value = true

    try {
      return await appFetch<FollowedVesselRefreshResponse>('/api/app/fleet-friends/refresh', {
        method: 'POST',
      })
    } finally {
      pending.value = false
    }
  }

  return {
    refreshFollowedVessels,
    pending: readonly(pending),
  }
}

export function useCreateInstallationKey(installationId: string) {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)

  async function createInstallationKey() {
    pending.value = true

    try {
      return await appFetch<InstallationKeySummary>(
        `/api/app/installations/${installationId}/keys`,
        {
          method: 'POST',
        },
      )
    } finally {
      pending.value = false
    }
  }

  return {
    createInstallationKey,
    pending: readonly(pending),
  }
}
