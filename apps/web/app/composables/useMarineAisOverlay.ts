import type { MaybeRefOrGetter, Ref } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit JS is provided by Apple's CDN and does not ship usable runtime typings
declare const mapkit: any

interface MapKitAnnotationRef {
  coordinate: unknown
}

export interface MapKitMapSurface {
  addAnnotation(annotation: MapKitAnnotationRef): void
  removeAnnotation(annotation: MapKitAnnotationRef): void
}

interface MarineAisOverlayOptions<T extends { id: string; lat: number; lng: number }> {
  map: Readonly<Ref<MapKitMapSurface | null>>
  pins: Readonly<Ref<T[]>>
  enabled: Readonly<Ref<boolean>>
  selectedId: Ref<string | null>
  createPinElement: (pin: T, isSelected: boolean) => { element: HTMLElement; cleanup?: () => void }
  renderFingerprint?: (pin: T, isSelected: boolean) => string
  renderKey?: Readonly<Ref<string | number>>
  movementThresholdMeters?: number
  annotationSize?: MaybeRefOrGetter<{ width: number; height: number }>
}

const DEFAULT_AIS_ANNOTATION_SIZE = { width: 24, height: 24 } as const
const DEFAULT_MOVEMENT_THRESHOLD_METERS = 15.24

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMeters = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useMarineAisOverlay<T extends { id: string; lat: number; lng: number }>(
  options: MarineAisOverlayOptions<T>,
) {
  const annotationRefs = new Map<string, MapKitAnnotationRef>()
  const cleanupRefs = new Map<string, (() => void) | undefined>()
  const renderedCoords = new Map<string, { lat: number; lng: number }>()
  const renderedFingerprints = new Map<string, string>()
  const activeMap = shallowRef<MapKitMapSurface | null>(null)
  const resolvedAnnotationSize = computed(() => {
    if (options.annotationSize === undefined) {
      return DEFAULT_AIS_ANNOTATION_SIZE
    }

    return toValue(options.annotationSize)
  })
  const movementThresholdMeters =
    options.movementThresholdMeters ?? DEFAULT_MOVEMENT_THRESHOLD_METERS
  const renderKey = computed(() => options.renderKey?.value ?? 'default')

  function clearPin(id: string, targetMap: MapKitMapSurface | null = activeMap.value) {
    const annotation = annotationRefs.get(id)
    if (annotation && targetMap) {
      targetMap.removeAnnotation(annotation)
    }

    cleanupRefs.get(id)?.()
    cleanupRefs.delete(id)
    annotationRefs.delete(id)
    renderedCoords.delete(id)
    renderedFingerprints.delete(id)
  }

  function clearAll(targetMap: MapKitMapSurface | null = activeMap.value) {
    const ids = Array.from(annotationRefs.keys())
    for (const id of ids) {
      clearPin(id, targetMap)
    }
  }

  function buildFingerprint(pin: T) {
    return options.renderFingerprint?.(pin, options.selectedId.value === pin.id) ?? ''
  }

  function createAnnotation(pin: T) {
    const annotationSize = resolvedAnnotationSize.value
    const annotation = new mapkit.Annotation(
      new mapkit.Coordinate(pin.lat, pin.lng),
      () => {
        const { element, cleanup } = options.createPinElement(
          pin,
          options.selectedId.value === pin.id,
        )
        const wrapper = document.createElement('div')
        wrapper.setAttribute('data-map-pin', '')
        wrapper.style.cursor = 'pointer'
        wrapper.appendChild(element)
        wrapper.addEventListener('click', (event) => {
          event.stopPropagation()
          options.selectedId.value = options.selectedId.value === pin.id ? null : pin.id
        })

        cleanupRefs.set(pin.id, cleanup)
        return wrapper
      },
      {
        anchorOffset: new DOMPoint(0, -annotationSize.height / 2),
        calloutEnabled: false,
        animates: false,
        size: annotationSize,
        data: { id: pin.id },
      },
    ) as MapKitAnnotationRef

    return annotation
  }

  function addPin(pin: T, targetMap: MapKitMapSurface) {
    const annotation = createAnnotation(pin)
    targetMap.addAnnotation(annotation)
    annotationRefs.set(pin.id, annotation)
    renderedCoords.set(pin.id, { lat: pin.lat, lng: pin.lng })
    renderedFingerprints.set(pin.id, buildFingerprint(pin))
  }

  function rebuildAll() {
    const targetMap = activeMap.value
    if (!targetMap || !options.enabled.value) {
      return
    }

    clearAll(targetMap)

    for (const pin of options.pins.value) {
      addPin(pin, targetMap)
    }
  }

  function syncMapReference() {
    const targetMap = options.map.value

    if (targetMap === activeMap.value) {
      return targetMap
    }

    clearAll(activeMap.value)
    activeMap.value = targetMap
    return targetMap
  }

  function syncPins() {
    const targetMap = syncMapReference()

    if (!targetMap || !options.enabled.value) {
      if (options.selectedId.value && annotationRefs.has(options.selectedId.value)) {
        options.selectedId.value = null
      }

      clearAll(targetMap)
      return
    }

    const visiblePins = options.pins.value
    const visibleIds = new Set(visiblePins.map((pin) => pin.id))

    for (const id of Array.from(annotationRefs.keys())) {
      if (!visibleIds.has(id)) {
        clearPin(id, targetMap)
      }
    }

    for (const pin of visiblePins) {
      const existing = annotationRefs.get(pin.id)

      if (!existing) {
        addPin(pin, targetMap)
        continue
      }

      const nextFingerprint = buildFingerprint(pin)
      if (renderedFingerprints.get(pin.id) !== nextFingerprint) {
        clearPin(pin.id, targetMap)
        addPin(pin, targetMap)
        continue
      }

      const lastCoord = renderedCoords.get(pin.id)
      if (
        lastCoord &&
        haversineMeters(lastCoord.lat, lastCoord.lng, pin.lat, pin.lng) >= movementThresholdMeters
      ) {
        existing.coordinate = new mapkit.Coordinate(pin.lat, pin.lng)
        renderedCoords.set(pin.id, { lat: pin.lat, lng: pin.lng })
      }
    }
  }

  watch(
    [() => options.map.value, () => options.enabled.value],
    () => {
      syncPins()
    },
    { immediate: true },
  )

  watch(
    () => options.pins.value,
    () => {
      syncPins()
    },
    { deep: false },
  )

  watch(
    () => options.selectedId.value,
    () => {
      rebuildAll()
    },
  )

  watch(renderKey, () => {
    rebuildAll()
  })

  watch(
    resolvedAnnotationSize,
    () => {
      rebuildAll()
    },
    { deep: true },
  )

  onBeforeUnmount(() => {
    clearAll(activeMap.value)
    activeMap.value = null
  })
}
