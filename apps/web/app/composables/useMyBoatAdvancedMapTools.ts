import type { MaybeRefOrGetter } from 'vue'
import type { VesselSnapshotSummary } from '~/types/myboat'
import {
  buildHeadingAidFeatureCollection,
  buildMeasureFeatureCollection,
  buildMeasureResult,
  buildRangeRingFeatureCollection,
  mapStyleFromSurfaceDefaults,
  mergeFeatureCollections,
  resolveMyBoatMapToolCapabilities,
  type MyBoatMapMeasurePoint,
  type MyBoatMapStyle,
  type MyBoatMapToolsProfile,
} from '~/components/myboat/maps/advanced-tools'

interface UseMyBoatAdvancedMapToolsOptions {
  defaultShowsPointsOfInterest?: MaybeRefOrGetter<boolean>
  focusSnapshot: MaybeRefOrGetter<VesselSnapshotSummary | null | undefined>
  profile: MaybeRefOrGetter<MyBoatMapToolsProfile>
}

function resolveFocusSnapshot(input: MaybeRefOrGetter<VesselSnapshotSummary | null | undefined>) {
  return resolveMaybe(input) ?? null
}

function resolveSurfaceDefaultMapStyle(input?: MaybeRefOrGetter<boolean>) {
  return mapStyleFromSurfaceDefaults(resolveMaybe(input) ?? true)
}

function resolveMaybe<T>(input: MaybeRefOrGetter<T> | undefined): T | undefined {
  if (typeof input === 'function') {
    return (input as () => T)()
  }

  if (input && typeof input === 'object' && 'value' in input) {
    return (input as { value: T }).value
  }

  return input as T | undefined
}

export function useMyBoatAdvancedMapTools(options: UseMyBoatAdvancedMapToolsOptions) {
  const route = useRoute()
  const { preferences } = useMarinePreferences()

  const hasUserSelectedMapStyle = shallowRef(false)
  const mapStyle = shallowRef<MyBoatMapStyle>('standard')
  const measureMode = shallowRef(false)
  const measurePoints = shallowRef<MyBoatMapMeasurePoint[]>([])
  const showHeadingLine = shallowRef(false)
  const showRangeRings = shallowRef(false)

  const capabilities = computed(() =>
    resolveMyBoatMapToolCapabilities(resolveMaybe(options.profile) ?? 'none'),
  )
  const preferredMapStyle = computed(
    () =>
      preferences.value.defaultMapStyle ??
      resolveSurfaceDefaultMapStyle(options.defaultShowsPointsOfInterest),
  )
  const hasLivePosition = computed(() => {
    const snapshot = resolveFocusSnapshot(options.focusSnapshot)
    return (
      snapshot?.positionLat !== null &&
      snapshot?.positionLat !== undefined &&
      snapshot?.positionLng !== null &&
      snapshot?.positionLng !== undefined
    )
  })
  const canShowHeadingLine = computed(() => {
    const snapshot = resolveFocusSnapshot(options.focusSnapshot)
    return (
      capabilities.value.headingLine &&
      hasLivePosition.value &&
      snapshot?.headingMagnetic !== null &&
      snapshot?.headingMagnetic !== undefined
    )
  })
  const canShowRangeRings = computed(() => capabilities.value.rangeRings && hasLivePosition.value)
  const measureResult = computed(() => buildMeasureResult(measurePoints.value))
  const toolGeojson = computed(() =>
    mergeFeatureCollections(
      showRangeRings.value
        ? buildRangeRingFeatureCollection(resolveFocusSnapshot(options.focusSnapshot))
        : null,
      showHeadingLine.value
        ? buildHeadingAidFeatureCollection(resolveFocusSnapshot(options.focusSnapshot))
        : null,
      measurePoints.value.length === 2 ? buildMeasureFeatureCollection(measurePoints.value) : null,
    ),
  )
  const isCustomMapStyle = computed(() => mapStyle.value !== preferredMapStyle.value)
  const hasActiveIndicator = computed(
    () =>
      isCustomMapStyle.value ||
      measureMode.value ||
      showRangeRings.value ||
      showHeadingLine.value ||
      measurePoints.value.length > 0,
  )

  function resetMeasure() {
    measureMode.value = false
    measurePoints.value = []
  }

  function toggleMeasureMode() {
    if (!capabilities.value.measure) {
      return
    }

    if (measureMode.value) {
      resetMeasure()
      return
    }

    measureMode.value = true
    measurePoints.value = []
  }

  function handleMapClick(coords: { lat: number; lng: number }) {
    if (!capabilities.value.measure || !measureMode.value) {
      return
    }

    if (measurePoints.value.length >= 2) {
      measurePoints.value = []
    }

    measurePoints.value = [...measurePoints.value, coords]
  }

  function setMapStyle(style: MyBoatMapStyle) {
    if (!capabilities.value.basemap) {
      return
    }

    hasUserSelectedMapStyle.value = true
    mapStyle.value = style
  }
  function toggleRangeRings() {
    if (!canShowRangeRings.value) {
      return
    }

    showRangeRings.value = !showRangeRings.value
  }

  function toggleHeadingLine() {
    if (!canShowHeadingLine.value) {
      return
    }

    showHeadingLine.value = !showHeadingLine.value
  }

  watch(
    preferredMapStyle,
    (style) => {
      if (!hasUserSelectedMapStyle.value) {
        mapStyle.value = style
      }
    },
    { immediate: true },
  )

  watch(canShowHeadingLine, (available) => {
    if (!available) {
      showHeadingLine.value = false
    }
  })

  watch(canShowRangeRings, (available) => {
    if (!available) {
      showRangeRings.value = false
    }
  })

  watch(
    capabilities,
    (nextCapabilities) => {
      if (!nextCapabilities.measure) {
        resetMeasure()
      }
      if (!nextCapabilities.headingLine) {
        showHeadingLine.value = false
      }
      if (!nextCapabilities.rangeRings) {
        showRangeRings.value = false
      }
    },
    { deep: false },
  )

  watch(
    () => route.fullPath,
    () => {
      resetMeasure()
      showHeadingLine.value = false
      showRangeRings.value = false
    },
  )

  return {
    canShowHeadingLine,
    canShowRangeRings,
    capabilities,
    handleMapClick,
    hasActiveIndicator,
    isCustomMapStyle,
    mapStyle: readonly(mapStyle),
    measureMode: readonly(measureMode),
    measurePoints: readonly(measurePoints),
    measureResult,
    resetMeasure,
    setMapStyle,
    showHeadingLine,
    showRangeRings,
    toggleHeadingLine,
    toggleMeasureMode,
    toggleRangeRings,
    toolGeojson,
  }
}
