import type { Ref } from 'vue'
import type { AisContactSummary } from '~/types/myboat'
import type {
  PublicTrafficContactDetailResponse,
  TrafficNearbyResponse,
  VesselTrafficContactDetailResponse,
} from '~/types/traffic'
import { mergeTrafficContactSummary, needsTrafficContactEnrichment } from '~/utils/traffic'

const TRAFFIC_NEARBY_REFRESH_MS = 20_000

function buildTrafficEnrichmentKey(contacts: AisContactSummary[]) {
  return contacts
    .map((contact) =>
      [
        contact.id,
        contact.name ? '1' : '0',
        contact.shipType ?? 'x',
        contact.callSign ? '1' : '0',
        contact.destination ? '1' : '0',
        contact.length ?? 'x',
        contact.beam ?? 'x',
        contact.draft ?? 'x',
      ].join(':'),
    )
    .sort()
    .join('|')
}

function useEnrichedTrafficContacts(options: {
  endpoint: Readonly<Ref<string | null>>
  contacts: Readonly<Ref<AisContactSummary[]>>
}) {
  const appFetch = useAppFetch()
  const pending = shallowRef(false)
  const enrichedById = shallowRef<Record<string, AisContactSummary>>({})
  const enrichmentKey = computed(() => buildTrafficEnrichmentKey(options.contacts.value))
  let activeRequestId = 0

  watch(
    [options.endpoint, enrichmentKey],
    async ([endpoint]) => {
      if (!import.meta.client || !endpoint) {
        activeRequestId += 1
        pending.value = false
        enrichedById.value = {}
        return
      }

      const contacts = options.contacts.value
      if (!contacts.some(needsTrafficContactEnrichment)) {
        activeRequestId += 1
        pending.value = false
        enrichedById.value = {}
        return
      }

      const requestId = ++activeRequestId
      pending.value = true

      try {
        const response = await appFetch<{ contacts: AisContactSummary[] }>(endpoint, {
          method: 'POST',
          body: {
            contacts,
          },
        })

        if (requestId !== activeRequestId) {
          return
        }

        enrichedById.value = Object.fromEntries(
          (response.contacts || []).map((contact) => [contact.id, contact]),
        )
      } catch {
        if (requestId === activeRequestId) {
          enrichedById.value = {}
        }
      } finally {
        if (requestId === activeRequestId) {
          pending.value = false
        }
      }
    },
    { immediate: true },
  )

  const contacts = computed(() =>
    options.contacts.value.map((contact) =>
      mergeTrafficContactSummary(contact, enrichedById.value[contact.id]),
    ),
  )

  return {
    contacts,
    pending: readonly(pending),
  }
}

function useNearbyTrafficHydrator(options: {
  endpoint: Readonly<Ref<string | null>>
  enabled: Readonly<Ref<boolean>>
  namespace: 'auth' | 'public'
  entryKey: Readonly<Ref<string | null | undefined>>
}) {
  const appFetch = useAppFetch()
  const store = useMyBoatVesselStore()
  const pending = shallowRef(false)
  let activeRequestId = 0
  let refreshTimer: number | null = null

  function clearRefreshTimer() {
    if (!refreshTimer) {
      return
    }

    clearInterval(refreshTimer)
    refreshTimer = null
  }

  async function refreshNearbyTraffic() {
    if (!import.meta.client || !options.enabled.value) {
      return
    }

    const endpoint = options.endpoint.value
    const entryKey = options.entryKey.value
    if (!endpoint || !entryKey) {
      return
    }

    const requestId = ++activeRequestId
    pending.value = true

    try {
      const response = await appFetch<TrafficNearbyResponse>(endpoint)
      if (requestId !== activeRequestId) {
        return
      }

      store.replaceAisContacts(options.namespace, entryKey, response.contacts || [])
    } catch {
      // Keep the live websocket state intact when snapshot refresh fails.
    } finally {
      if (requestId === activeRequestId) {
        pending.value = false
      }
    }
  }

  function syncRefreshTimer(enabled: boolean) {
    clearRefreshTimer()

    if (!import.meta.client || !enabled) {
      return
    }

    refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return
      }

      void refreshNearbyTraffic()
    }, TRAFFIC_NEARBY_REFRESH_MS)
  }

  watch(
    [options.endpoint, options.enabled, options.entryKey],
    ([endpoint, enabled, entryKey]) => {
      activeRequestId += 1
      syncRefreshTimer(Boolean(endpoint && entryKey && enabled))

      if (!(endpoint && entryKey && enabled)) {
        pending.value = false
        return
      }

      void refreshNearbyTraffic()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    activeRequestId += 1
    pending.value = false
    clearRefreshTimer()
  })

  return {
    pending: readonly(pending),
    refreshNearbyTraffic,
  }
}

export function useAuthEnrichedTrafficContacts(
  vesselSlug: Readonly<Ref<string | null | undefined>>,
  contacts: Readonly<Ref<AisContactSummary[]>>,
) {
  const endpoint = computed(() =>
    vesselSlug.value ? `/api/app/vessels/${vesselSlug.value}/traffic/enrich` : null,
  )

  return useEnrichedTrafficContacts({
    endpoint,
    contacts,
  })
}

export function useAuthNearbyTrafficHydrator(
  vesselSlug: Readonly<Ref<string | null | undefined>>,
  entryKey: Readonly<Ref<string | null | undefined>>,
  enabled: Readonly<Ref<boolean>>,
) {
  const endpoint = computed(() =>
    vesselSlug.value ? `/api/app/vessels/${vesselSlug.value}/traffic/nearby` : null,
  )

  return useNearbyTrafficHydrator({
    endpoint,
    enabled,
    entryKey,
    namespace: 'auth',
  })
}

export function usePublicEnrichedTrafficContacts(
  username: Readonly<Ref<string | null | undefined>>,
  vesselSlug: Readonly<Ref<string | null | undefined>>,
  contacts: Readonly<Ref<AisContactSummary[]>>,
) {
  const endpoint = computed(() =>
    username.value && vesselSlug.value
      ? `/api/public/${username.value}/${vesselSlug.value}/traffic/enrich`
      : null,
  )

  return useEnrichedTrafficContacts({
    endpoint,
    contacts,
  })
}

export function usePublicNearbyTrafficHydrator(
  username: Readonly<Ref<string | null | undefined>>,
  vesselSlug: Readonly<Ref<string | null | undefined>>,
  entryKey: Readonly<Ref<string | null | undefined>>,
  enabled: Readonly<Ref<boolean>>,
) {
  const endpoint = computed(() =>
    username.value && vesselSlug.value
      ? `/api/public/${username.value}/${vesselSlug.value}/traffic/nearby`
      : null,
  )

  return useNearbyTrafficHydrator({
    endpoint,
    enabled,
    entryKey,
    namespace: 'public',
  })
}

export function useAuthTrafficContactDetail(vesselSlug: string, contactId: string) {
  return useFetch<VesselTrafficContactDetailResponse>(
    `/api/app/vessels/${vesselSlug}/traffic/${encodeURIComponent(contactId)}`,
    {
      key: `myboat-traffic-${vesselSlug}-${contactId}`,
    },
  )
}

export function usePublicTrafficContactDetail(
  username: string,
  vesselSlug: string,
  contactId: string,
) {
  return useFetch<PublicTrafficContactDetailResponse>(
    `/api/public/${username}/${vesselSlug}/traffic/${encodeURIComponent(contactId)}`,
    {
      key: `myboat-public-traffic-${username}-${vesselSlug}-${contactId}`,
    },
  )
}
