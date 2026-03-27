import type {
  DashboardOverview,
  InstallationKeySummary,
  InstallationSummary,
  OnboardingPayload,
  PublicExploreResponse,
  PublicProfileResponse,
  PublicVesselDetailResponse,
  VesselDetailResponse,
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

export function usePublicExplore(key = 'myboat-explore') {
  return useFetch<PublicExploreResponse>('/api/public/explore', { key })
}

export function usePublicVesselDetail(username: string, vesselSlug: string) {
  return useFetch<PublicVesselDetailResponse>(
    `/api/public/${username}/${vesselSlug}`,
    { key: `myboat-public-vessel-${username}-${vesselSlug}` },
  )
}

export function useVesselDetail(vesselSlug: string) {
  return useFetch<VesselDetailResponse>(`/api/app/vessels/${vesselSlug}`, {
    key: `myboat-vessel-${vesselSlug}`,
  })
}

export function useInstallationDetail(installationId: string) {
  return useFetch<{
    installation: InstallationSummary
    keys: InstallationKeySummary[]
  }>(`/api/app/installations/${installationId}`, {
    key: `myboat-installation-${installationId}`,
  })
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
