import type { MaybeRefOrGetter, Ref } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MapKit JS is provided by Apple's CDN and does not ship usable runtime typings
declare const mapkit: any

interface MapKitAnnotationRef {
  coordinate: unknown
}

interface MapKitSelectableSurface extends MapKitMapSurface {
  selectedAnnotation?: MapKitAnnotationRef | null
  addEventListener?: (name: string, handler: (event: unknown) => void) => void
  removeEventListener?: (name: string, handler: (event: unknown) => void) => void
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
  createCalloutElement?: (pin: T) => { element: HTMLElement; cleanup?: () => void }
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
  const calloutCleanupRefs = new Map<string, (() => void) | undefined>()
  const renderedCoords = new Map<string, { lat: number; lng: number }>()
  const renderedFingerprints = new Map<string, string>()
  const activeMap = shallowRef<MapKitSelectableSurface | null>(null)
  let deselectHandler: ((event: unknown) => void) | null = null
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
    calloutCleanupRefs.get(id)?.()
    calloutCleanupRefs.delete(id)
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

  function syncSelectedAnnotation() {
    const targetMap = activeMap.value
    if (!targetMap || !options.createCalloutElement) {
      return
    }

    targetMap.selectedAnnotation = options.selectedId.value
      ? (annotationRefs.get(options.selectedId.value) ?? null)
      : null
  }

  function bindSelectionEvents(targetMap: MapKitSelectableSurface | null) {
    if (!targetMap?.addEventListener || !options.createCalloutElement || deselectHandler) {
      return
    }

    deselectHandler = () => {
      queueMicrotask(() => {
        if (activeMap.value?.selectedAnnotation != null) {
          return
        }

        const selectedId = options.selectedId.value
        if (selectedId && annotationRefs.has(selectedId)) {
          options.selectedId.value = null
        }
      })
    }

    targetMap.addEventListener('deselect', deselectHandler)
  }

  function unbindSelectionEvents(targetMap: MapKitSelectableSurface | null = activeMap.value) {
    if (!targetMap?.removeEventListener || !deselectHandler) {
      return
    }

    targetMap.removeEventListener('deselect', deselectHandler)
    deselectHandler = null
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
          const nextSelectedId = options.selectedId.value === pin.id ? null : pin.id
          options.selectedId.value = nextSelectedId
          if (options.createCalloutElement) {
            const targetMap = activeMap.value
            if (targetMap) {
              targetMap.selectedAnnotation = nextSelectedId ? annotation : null
            }
          }
        })

        cleanupRefs.set(pin.id, cleanup)
        return wrapper
      },
      {
        anchorOffset: new DOMPoint(0, -annotationSize.height / 2),
        calloutEnabled: Boolean(options.createCalloutElement),
        animates: false,
        size: annotationSize,
        data: { id: pin.id },
        ...(options.createCalloutElement
          ? {
              callout: {
                calloutElementForAnnotation: () => {
                  const currentPin =
                    options.pins.value.find((candidate) => candidate.id === pin.id) ?? pin
                  const { element, cleanup } = options.createCalloutElement!(currentPin)
                  calloutCleanupRefs.get(pin.id)?.()
                  calloutCleanupRefs.set(pin.id, cleanup)
                  return element
                },
              },
            }
          : {}),
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

    syncSelectedAnnotation()
  }

  function syncMapReference() {
    const targetMap = options.map.value as MapKitSelectableSurface | null

    if (targetMap === activeMap.value) {
      return targetMap
    }

    unbindSelectionEvents(activeMap.value)
    clearAll(activeMap.value)
    activeMap.value = targetMap
    bindSelectionEvents(targetMap)
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

    syncSelectedAnnotation()
  }

  watch(
    [() => options.map.value, () => options.enabled.value],
    () => {
      syncPins()
    },
    { immediate: true },
  )

  // Watch the pins ref directly — `options` is a plain object, so a getter like
  // `() => options.pins.value` can fail to re-run when the computed list is replaced.
  watch(
    options.pins,
    () => {
      syncPins()
    },
    { deep: true },
  )

  watch(
    () => options.selectedId.value,
    () => {
      rebuildAll()
      syncSelectedAnnotation()
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
    unbindSelectionEvents(activeMap.value)
    clearAll(activeMap.value)
    activeMap.value = null
  })
}
