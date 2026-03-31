import { defineStore } from 'pinia'
import type {
  AisContactSummary,
  MediaItemSummary,
  PassageSummary,
  VesselCardSummary,
  WaypointSummary,
} from '~/types/myboat'
import type { PassagePlaybackBundle } from '~/types/passagePlayback'
import type { PlaybackSelectionEvent } from '~/types/playbackViewer'
import type { PassagePlaybackMetrics } from '~/composables/usePassagePlayback'
import { usePlaybackVessel } from '~/composables/usePassagePlayback'
import {
  buildPlaybackEvents,
  clamp,
  DEFAULT_TRAFFIC_FRESHNESS_MS,
  findNearestTrafficSample,
  formatElapsed,
  interpolateSample,
  parseWindowMs,
  PLAYBACK_SPEED_OPTIONS,
  prepareSelfSamples,
} from '~/utils/passagePlayback'
import { buildPassageDisplayRoute, buildPassageDisplayTitle } from '~/utils/passage-display'

function formatPlaybackTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function buildMetrics(
  sample: ReturnType<typeof interpolateSample>,
  summaryDistanceNm: number,
  startedMs: number,
) {
  if (!sample) {
    return null
  }

  return {
    timestampLabel: formatPlaybackTimestamp(sample.t),
    elapsedLabel: formatElapsed(sample.ms - startedMs),
    sog: sample.sog,
    speedThroughWater: sample.speedThroughWater ?? null,
    cog: sample.cog,
    heading: sample.headingTrue,
    windTrueSpeedKts: sample.windTrueSpeedKts ?? null,
    windTrueDirectionDeg: sample.windTrueDirectionDeg ?? null,
    depth: sample.depth ?? null,
    distanceRemainingNm: Math.max(0, summaryDistanceNm - sample.cumulativeDistanceNm),
    avgSogSoFar: sample.avgSogSoFar,
    maxSogSoFar: sample.maxSogSoFar,
  } satisfies PassagePlaybackMetrics
}

function findNearestMedia(media: MediaItemSummary[], ms: number) {
  let nearest: MediaItemSummary | null = null
  let nearestDelta = Number.POSITIVE_INFINITY

  for (const item of media) {
    if (!item.capturedAt) {
      continue
    }

    const itemMs = Date.parse(item.capturedAt)
    if (!Number.isFinite(itemMs)) {
      continue
    }

    const delta = Math.abs(itemMs - ms)
    if (delta < nearestDelta) {
      nearest = item
      nearestDelta = delta
    }
  }

  return nearest
}

export const usePlaybackStore = defineStore('playback', () => {
  const bundle = shallowRef<PassagePlaybackBundle | null>(null)
  const passage = shallowRef<PassageSummary | null>(null)
  const vessel = shallowRef<VesselCardSummary | null>(null)
  const media = shallowRef<MediaItemSummary[]>([])
  const waypoints = shallowRef<WaypointSummary[]>([])

  const currentTime = shallowRef(0)
  const isPlaying = shallowRef(false)
  const speedMultiplier = shallowRef(PLAYBACK_SPEED_OPTIONS[1]!)
  const selectedEvent = shallowRef<PlaybackSelectionEvent | null>(null)
  const hoveredTime = shallowRef<number | null>(null)

  let frameHandle: number | null = null
  let lastFrameAt = 0

  const preparedSamples = computed(() => prepareSelfSamples(bundle.value?.self.samples || []))
  const startedMs = computed(() => preparedSamples.value[0]?.ms ?? 0)
  const endedMs = computed(() => preparedSamples.value.at(-1)?.ms ?? startedMs.value)
  const durationMs = computed(() => Math.max(0, endedMs.value - startedMs.value))
  const hasPlayback = computed(() => preparedSamples.value.length > 1)
  const progressRatio = computed(() =>
    durationMs.value <= 0
      ? 0
      : clamp((currentTime.value - startedMs.value) / durationMs.value, 0, 1),
  )

  const activeSample = computed(() =>
    hasPlayback.value ? interpolateSample(preparedSamples.value, currentTime.value) : null,
  )
  const selectedSample = computed(() =>
    selectedEvent.value?.ms != null && hasPlayback.value
      ? interpolateSample(preparedSamples.value, selectedEvent.value.ms)
      : null,
  )
  const hoveredSample = computed(() =>
    hoveredTime.value != null && hasPlayback.value
      ? interpolateSample(preparedSamples.value, hoveredTime.value)
      : null,
  )
  const displayMode = computed<'event' | 'live' | 'scrubbed'>(() => {
    if (selectedEvent.value) {
      return 'event'
    }

    return isPlaying.value ? 'live' : 'scrubbed'
  })
  const displaySample = computed(() => selectedSample.value || activeSample.value)
  const hoverMetrics = computed(() =>
    hoveredSample.value
      ? buildMetrics(hoveredSample.value, bundle.value?.summary.distanceNm || 0, startedMs.value)
      : null,
  )
  const metrics = computed(() =>
    buildMetrics(displaySample.value, bundle.value?.summary.distanceNm || 0, startedMs.value),
  )
  const speedOptions = computed(() => PLAYBACK_SPEED_OPTIONS)

  const title = computed(() => buildPassageDisplayTitle(passage.value))
  const subtitle = computed(() => buildPassageDisplayRoute(passage.value))
  const trafficFreshnessMs = computed(() =>
    Math.max(
      parseWindowMs(bundle.value?.traffic.window),
      parseWindowMs(bundle.value?.self.window),
      DEFAULT_TRAFFIC_FRESHNESS_MS,
    ),
  )

  const playbackSnapshot = computed(() => {
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

  const playbackVessel = computed(() => usePlaybackVessel(vessel.value, playbackSnapshot.value))

  const aisContacts = computed<AisContactSummary[]>(() => {
    const sample = activeSample.value
    if (!sample || !bundle.value) {
      return []
    }

    const contacts: AisContactSummary[] = []

    for (const trafficVessel of bundle.value.traffic.vessels) {
      const nearest = findNearestTrafficSample(
        trafficVessel,
        currentTime.value,
        trafficFreshnessMs.value,
      )
      if (!nearest) {
        continue
      }

      const displayName =
        trafficVessel.profile.name ||
        trafficVessel.profile.shipTypeName ||
        `MMSI ${trafficVessel.profile.mmsi.slice(-4)}`

      contacts.push({
        id: `traffic:${trafficVessel.profile.mmsi}`,
        name: displayName,
        mmsi: trafficVessel.profile.mmsi,
        shipType: trafficVessel.profile.shipTypeId,
        lat: nearest.lat,
        lng: nearest.lon,
        cog: nearest.cog,
        sog: nearest.sog,
        heading: nearest.hdg,
        destination: trafficVessel.profile.destination,
        callSign: null,
        length: trafficVessel.profile.lengthM,
        beam: trafficVessel.profile.beamM,
        draft: trafficVessel.profile.draftM,
        navState: trafficVessel.profile.shipTypeName,
        lastUpdateAt: Date.parse(nearest.t),
      })
    }

    return contacts.slice(0, 16)
  })

  const timelineMarkers = computed<PlaybackSelectionEvent[]>(() => {
    const markers: PlaybackSelectionEvent[] = []

    for (const event of buildPlaybackEvents(preparedSamples.value)) {
      markers.push({
        id: `milestone:${event.id}`,
        kind: 'milestone',
        title: event.label,
        shortLabel: event.shortLabel,
        ms: event.ms,
        timestamp: new Date(event.ms).toISOString(),
      })
    }

    for (const item of media.value) {
      if (!item.capturedAt) {
        continue
      }

      const ms = Date.parse(item.capturedAt)
      if (!Number.isFinite(ms)) {
        continue
      }

      markers.push({
        id: `photo:${item.id}`,
        kind: 'photo',
        title: item.title,
        shortLabel: 'Photo',
        ms,
        timestamp: item.capturedAt,
        note: item.caption,
        imageUrl: item.imageUrl,
        lat: item.lat,
        lng: item.lng,
      })
    }

    for (const item of waypoints.value) {
      if (!item.visitedAt) {
        continue
      }

      const ms = Date.parse(item.visitedAt)
      if (!Number.isFinite(ms)) {
        continue
      }

      markers.push({
        id: `waypoint:${item.id}`,
        kind: 'waypoint',
        title: item.title,
        shortLabel: 'Mark',
        ms,
        timestamp: item.visitedAt,
        note: item.note,
        meta: item.kind.replaceAll('_', ' '),
        lat: item.lat,
        lng: item.lng,
      })
    }

    return markers.sort((left, right) => (left.ms || 0) - (right.ms || 0))
  })

  const featuredMedia = computed(() => {
    if (selectedEvent.value?.kind === 'photo') {
      return media.value.find((item) => `photo:${item.id}` === selectedEvent.value?.id) || null
    }

    if (!displaySample.value) {
      return media.value.find((item) => item.isCover) || media.value[0] || null
    }

    return (
      findNearestMedia(media.value, displaySample.value.ms) ||
      media.value.find((item) => item.isCover) ||
      media.value[0] ||
      null
    )
  })

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
    const nextMs = currentTime.value + deltaMs * speedMultiplier.value

    if (nextMs >= endedMs.value) {
      currentTime.value = endedMs.value
      isPlaying.value = false
      stopFrameLoop()
      return
    }

    currentTime.value = nextMs
    scheduleFrame()
  }

  function setTime(nextTime: number) {
    if (!hasPlayback.value) {
      return
    }

    currentTime.value = clamp(nextTime, startedMs.value, endedMs.value)
  }

  function seekToRatio(ratio: number) {
    setTime(startedMs.value + durationMs.value * clamp(ratio, 0, 1))
  }

  function setHoveredTimeValue(nextTime: number | null) {
    if (!hasPlayback.value || nextTime == null) {
      hoveredTime.value = null
      return
    }

    hoveredTime.value = clamp(nextTime, startedMs.value, endedMs.value)
  }

  function clearSelection() {
    selectedEvent.value = null
  }

  function selectEvent(event: PlaybackSelectionEvent | null) {
    selectedEvent.value = event
    if (!event) {
      return
    }

    isPlaying.value = false
    stopFrameLoop()

    if (event.ms != null && Number.isFinite(event.ms)) {
      setTime(event.ms)
    }
  }

  function togglePlayback() {
    if (!hasPlayback.value) {
      return
    }

    selectedEvent.value = null

    if (currentTime.value >= endedMs.value) {
      currentTime.value = startedMs.value
    }

    isPlaying.value = !isPlaying.value
    if (!isPlaying.value) {
      stopFrameLoop()
      return
    }

    scheduleFrame()
  }

  function setSpeed(nextSpeed: number) {
    speedMultiplier.value = nextSpeed
  }

  function resetPlayback() {
    isPlaying.value = false
    stopFrameLoop()
    selectedEvent.value = null
    hoveredTime.value = null

    if (hasPlayback.value) {
      currentTime.value = startedMs.value
    } else {
      currentTime.value = 0
    }
  }

  function hydrate(options: {
    bundle: PassagePlaybackBundle | null
    passage: PassageSummary | null
    vessel: VesselCardSummary | null
    media?: MediaItemSummary[]
    waypoints?: WaypointSummary[]
  }) {
    const passageChanged = options.passage?.id !== passage.value?.id

    bundle.value = options.bundle
    passage.value = options.passage
    vessel.value = options.vessel
    media.value = options.media || []
    waypoints.value = options.waypoints || []

    if (!options.bundle || !options.bundle.self.samples.length) {
      resetPlayback()
      return
    }

    if (
      passageChanged ||
      currentTime.value < startedMs.value ||
      currentTime.value > endedMs.value
    ) {
      currentTime.value = startedMs.value
    }

    if (passageChanged) {
      selectedEvent.value = null
      hoveredTime.value = null
      isPlaying.value = false
      stopFrameLoop()
    }
  }

  onScopeDispose(() => {
    stopFrameLoop()
  })

  return {
    aisContacts,
    bundle,
    clearSelection,
    currentTime,
    displayMode,
    durationMs,
    endTime: endedMs,
    featuredMedia,
    hasPlayback,
    hoverMetrics,
    hoveredTime,
    hydrate,
    isPlaying,
    metrics,
    passage,
    playbackSnapshot,
    playbackVessel,
    progressRatio,
    resetPlayback,
    seekToRatio,
    selectEvent,
    selectedEvent,
    setHoveredTime: setHoveredTimeValue,
    setSpeed,
    setTime,
    speedMultiplier,
    speedOptions,
    startTime: startedMs,
    subtitle,
    timelineMarkers,
    title,
    togglePlayback,
  }
})
