import type { AisContactSummary, VesselCardSummary, VesselSnapshotSummary } from '~/types/myboat'
import type { PassagePlaybackBundle } from '~/types/passagePlayback'
import {
  buildPlaybackEvents,
  clamp,
  DEFAULT_TRAFFIC_FRESHNESS_MS,
  findNearestTrafficSample,
  formatElapsed,
  haversineNm,
  interpolateSample,
  parseWindowMs,
  PLAYBACK_SPEED_OPTIONS,
  prepareSelfSamples,
} from '~/utils/passagePlayback'

export interface PassagePlaybackScope {
  access: 'auth' | 'public'
  username?: string | null
  vesselSlug?: string | null
}

export interface PassagePlaybackMetrics {
  timestampLabel: string
  elapsedLabel: string
  sog: number | null
  speedThroughWater: number | null
  cog: number | null
  heading: number | null
  windTrueSpeedKts: number | null
  windTrueDirectionDeg: number | null
  depth: number | null
  distanceRemainingNm: number
  avgSogSoFar: number | null
  maxSogSoFar: number | null
}

function buildPlaybackPath(passageId: string, scope: PassagePlaybackScope) {
  if (scope.access === 'public') {
    return `/api/public/${scope.username}/${scope.vesselSlug}/passages/${passageId}/playback`
  }

  return `/api/app/passages/${passageId}/playback`
}

export function usePassagePlaybackBundle(
  passageId: Ref<string | null> | ComputedRef<string | null>,
  scope: Ref<PassagePlaybackScope> | ComputedRef<PassagePlaybackScope>,
) {
  const appFetch = useAppFetch()

  return useAsyncData(
    () => {
      const id = passageId.value || 'none'
      const value = scope.value
      return `myboat-passage-playback:${value.access}:${value.username || 'auth'}:${value.vesselSlug || 'direct'}:${id}`
    },
    async () => {
      const id = passageId.value
      if (!id) {
        return null
      }

      return await appFetch<PassagePlaybackBundle>(buildPlaybackPath(id, scope.value))
    },
    {
      watch: [passageId, scope],
      default: () => null,
    },
  )
}

export function usePassagePlaybackController(
  bundle: Ref<PassagePlaybackBundle | null> | ComputedRef<PassagePlaybackBundle | null>,
) {
  const isPlaying = shallowRef(false)
  const playbackRate = shallowRef(PLAYBACK_SPEED_OPTIONS[1]!)
  const currentMs = shallowRef(0)
  let frameHandle: number | null = null
  let lastFrameAt = 0

  const preparedSamples = computed(() => prepareSelfSamples(bundle.value?.self.samples || []))
  const startedMs = computed(() => preparedSamples.value[0]?.ms ?? 0)
  const endedMs = computed(() => preparedSamples.value.at(-1)?.ms ?? startedMs.value)
  const durationMs = computed(() => Math.max(0, endedMs.value - startedMs.value))
  const events = computed(() => buildPlaybackEvents(preparedSamples.value))

  const activeSample = computed(() => interpolateSample(preparedSamples.value, currentMs.value))
  const progressRatio = computed(() =>
    durationMs.value <= 0 ? 0 : clamp((currentMs.value - startedMs.value) / durationMs.value, 0, 1),
  )

  const trafficFreshnessMs = computed(() =>
    Math.max(
      parseWindowMs(bundle.value?.traffic.window),
      parseWindowMs(bundle.value?.self.window),
      DEFAULT_TRAFFIC_FRESHNESS_MS,
    ),
  )

  const playbackSnapshot = computed<VesselSnapshotSummary | null>(() => {
    const sample = activeSample.value
    if (!sample) {
      return null
    }

    return {
      observedAt: sample.t,
      positionLat: sample.lat,
      positionLng: sample.lon,
      headingMagnetic: sample.headingTrue,
      speedOverGround: sample.sog,
      speedThroughWater: sample.speedThroughWater ?? null,
      windSpeedApparent: sample.windAppSpeedKts ?? sample.windTrueSpeedKts ?? null,
      windAngleApparent: sample.windAppAngleDeg ?? null,
      depthBelowTransducer: sample.depth ?? null,
      waterTemperatureKelvin: sample.waterTempC != null ? sample.waterTempC + 273.15 : null,
      batteryVoltage: null,
      engineRpm: sample.portRpm ?? sample.starboardRpm ?? null,
      statusNote: 'Playback sample from stored passage archive.',
      source: 'passage_playback',
      vesselId: undefined,
      updatedAt: sample.t,
    }
  })

  const aisContacts = computed<AisContactSummary[]>(() => {
    const sample = activeSample.value
    if (!sample || !bundle.value) {
      return []
    }

    const contacts: AisContactSummary[] = []

    for (const vessel of bundle.value.traffic.vessels) {
      const nearest = findNearestTrafficSample(vessel, currentMs.value, trafficFreshnessMs.value)
      if (!nearest) {
        continue
      }

      const displayName =
        vessel.profile.name ||
        vessel.profile.shipTypeName ||
        `MMSI ${vessel.profile.mmsi.slice(-4)}`

      contacts.push({
        id: `traffic:${vessel.profile.mmsi}`,
        name: displayName,
        mmsi: vessel.profile.mmsi,
        shipType: vessel.profile.shipTypeId,
        lat: nearest.lat,
        lng: nearest.lon,
        cog: nearest.cog,
        sog: nearest.sog,
        heading: nearest.hdg,
        destination: vessel.profile.destination,
        callSign: null,
        length: vessel.profile.lengthM,
        beam: vessel.profile.beamM,
        draft: vessel.profile.draftM,
        navState: vessel.profile.shipTypeName,
        lastUpdateAt: Date.parse(nearest.t),
      })
    }

    return contacts
      .sort((left, right) => {
        const leftDistance = haversineNm(sample.lat, sample.lon, left.lat || 0, left.lng || 0)
        const rightDistance = haversineNm(sample.lat, sample.lon, right.lat || 0, right.lng || 0)
        return leftDistance - rightDistance
      })
      .slice(0, 16)
  })

  const nearbyTraffic = computed(() => aisContacts.value.slice(0, 5))

  const metrics = computed<PassagePlaybackMetrics | null>(() => {
    const sample = activeSample.value
    const currentBundle = bundle.value
    if (!sample || !currentBundle) {
      return null
    }

    return {
      timestampLabel: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(sample.t)),
      elapsedLabel: formatElapsed(sample.ms - startedMs.value),
      sog: sample.sog,
      speedThroughWater: sample.speedThroughWater ?? null,
      cog: sample.cog,
      heading: sample.headingTrue,
      windTrueSpeedKts: sample.windTrueSpeedKts ?? null,
      windTrueDirectionDeg: sample.windTrueDirectionDeg ?? null,
      depth: sample.depth ?? null,
      distanceRemainingNm: Math.max(
        0,
        (currentBundle.summary.distanceNm || 0) - sample.cumulativeDistanceNm,
      ),
      avgSogSoFar: sample.avgSogSoFar,
      maxSogSoFar: sample.maxSogSoFar,
    }
  })

  function setCurrentMs(nextMs: number) {
    currentMs.value = clamp(nextMs, startedMs.value, endedMs.value)
  }

  function seekToRatio(ratio: number) {
    setCurrentMs(startedMs.value + durationMs.value * clamp(ratio, 0, 1))
  }

  function seekToEvent(eventMs: number) {
    setCurrentMs(eventMs)
  }

  function resetPlayback() {
    isPlaying.value = false
    setCurrentMs(startedMs.value)
  }

  function togglePlayback() {
    if (!preparedSamples.value.length) {
      return
    }

    if (currentMs.value >= endedMs.value) {
      currentMs.value = startedMs.value
    }

    isPlaying.value = !isPlaying.value
  }

  function setPlaybackRate(nextRate: number) {
    playbackRate.value = nextRate
  }

  function stopFrameLoop() {
    if (frameHandle != null && import.meta.client) {
      window.cancelAnimationFrame(frameHandle)
    }

    frameHandle = null
    lastFrameAt = 0
  }

  function scheduleFrame() {
    if (!import.meta.client || !isPlaying.value || frameHandle != null) {
      return
    }

    frameHandle = window.requestAnimationFrame(onFrame)
  }

  function onFrame(timestamp: number) {
    frameHandle = null
    if (!isPlaying.value) {
      return
    }

    if (!lastFrameAt) {
      lastFrameAt = timestamp
    }

    const deltaMs = timestamp - lastFrameAt
    lastFrameAt = timestamp
    const nextMs = currentMs.value + deltaMs * playbackRate.value

    if (nextMs >= endedMs.value) {
      currentMs.value = endedMs.value
      isPlaying.value = false
      stopFrameLoop()
      return
    }

    currentMs.value = nextMs
    scheduleFrame()
  }

  watch(
    preparedSamples,
    (samples) => {
      if (!samples.length) {
        currentMs.value = 0
        isPlaying.value = false
        stopFrameLoop()
        return
      }

      if (
        !currentMs.value ||
        currentMs.value < samples[0]!.ms ||
        currentMs.value > samples.at(-1)!.ms
      ) {
        currentMs.value = samples[0]!.ms
      }
    },
    { immediate: true },
  )

  watch(isPlaying, (playing) => {
    if (!playing) {
      stopFrameLoop()
      return
    }

    scheduleFrame()
  })

  onBeforeUnmount(() => {
    stopFrameLoop()
  })

  return {
    activeSample,
    aisContacts,
    currentMs,
    events,
    isPlaying,
    metrics,
    nearbyTraffic,
    playbackRate,
    playbackRateOptions: PLAYBACK_SPEED_OPTIONS,
    playbackSnapshot,
    progressRatio,
    resetPlayback,
    seekToEvent,
    seekToRatio,
    setPlaybackRate,
    togglePlayback,
  }
}

export function usePlaybackVessel(
  vessel: VesselCardSummary | null,
  snapshot: VesselSnapshotSummary | null,
) {
  if (!vessel || !snapshot) {
    return vessel
  }

  return {
    ...vessel,
    liveSnapshot: {
      ...snapshot,
      vesselId: vessel.id,
    },
    latestPassage: vessel.latestPassage,
  } satisfies VesselCardSummary
}
