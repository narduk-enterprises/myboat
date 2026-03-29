import type { MyBoatAisPin, MyBoatMapInstallation } from '~/components/myboat/maps/map-support'
import { buildNearbyAisPins } from '~/components/myboat/maps/map-support'
import type { VesselCardSummary, VesselSnapshotSummary } from '~/types/myboat'

interface UseMyBoatNearbyAisOptions {
  enabled: Readonly<Ref<boolean>>
  focusSnapshot: Readonly<Ref<VesselSnapshotSummary | null>>
  installations: Readonly<Ref<MyBoatMapInstallation[]>>
  primaryVessel: Readonly<Ref<VesselCardSummary | null>>
}

function normalizeSignalKSocketUrl(rawUrl: string | null | undefined) {
  const normalized = rawUrl?.trim()
  if (!normalized) {
    return null
  }

  try {
    const baseOrigin = import.meta.client ? window.location.origin : 'http://localhost:3000'
    const url = new URL(normalized, baseOrigin)

    if (url.protocol === 'http:') {
      url.protocol = 'ws:'
    } else if (url.protocol === 'https:') {
      url.protocol = 'wss:'
    }

    return url.toString()
  } catch {
    return normalized.startsWith('ws://') || normalized.startsWith('wss://') ? normalized : null
  }
}

function buildDefaultSignalKSocketUrl() {
  if (!import.meta.client) {
    return null
  }

  return normalizeSignalKSocketUrl('/api/signalk/relay')
}

export function useMyBoatNearbyAis(options: UseMyBoatNearbyAisOptions) {
  const defaultSignalKSocketUrl = shallowRef<string | null>(null)

  const signalKUrlCandidates = computed(() => {
    const candidates = new Set<string>()

    for (const installation of options.installations.value) {
      for (const rawUrl of [
        installation.collectorSignalKUrl,
        installation.relaySignalKUrl,
        installation.signalKUrl,
      ]) {
        const normalized = normalizeSignalKSocketUrl(rawUrl)
        if (normalized) {
          candidates.add(normalized)
        }
      }
    }

    if (defaultSignalKSocketUrl.value) {
      candidates.add(defaultSignalKSocketUrl.value)
    }

    return Array.from(candidates)
  })

  const feedEnabled = computed(
    () => import.meta.client && options.enabled.value && signalKUrlCandidates.value.length > 0,
  )

  const {
    contacts: aisContacts,
    connectionState,
    lastDeltaAt,
    activeUrl,
  } = useSignalKAisFeed({
    enabled: feedEnabled,
    urls: signalKUrlCandidates,
  })

  const aisPins = computed<MyBoatAisPin[]>(() =>
    feedEnabled.value
      ? buildNearbyAisPins({
          contacts: aisContacts.value,
          focusSnapshot: options.focusSnapshot.value,
          primaryVesselName: options.primaryVessel.value?.name || null,
        })
      : [],
  )

  onMounted(() => {
    defaultSignalKSocketUrl.value = buildDefaultSignalKSocketUrl()
  })

  return {
    activeUrl,
    aisPins,
    connectionState,
    hasSignalKSource: computed(() => signalKUrlCandidates.value.length > 0),
    lastDeltaAt,
    signalKUrlCandidates,
  }
}
