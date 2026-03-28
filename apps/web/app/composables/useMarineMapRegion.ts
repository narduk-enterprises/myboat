interface MarineMapRegion {
  centerLat: number
  centerLng: number
  latDelta: number
  lngDelta: number
}

function buildStorageKey(rawKey: string | null | undefined) {
  if (!rawKey) return null

  const normalized = rawKey
    .trim()
    .replaceAll(/[^\w:/-]+/g, '-')
    .replaceAll(/-+/g, '-')

  return normalized ? `myboat:map-region:${normalized}` : null
}

export function useMarineMapRegion(resolveKey: () => string | null | undefined) {
  const storageKey = computed(() => buildStorageKey(resolveKey()))
  const savedRegion = shallowRef<MarineMapRegion | null>(null)

  function getSavedRegion() {
    try {
      if (!import.meta.client || !storageKey.value) return null
      const raw = localStorage.getItem(storageKey.value)
      return raw ? (JSON.parse(raw) as MarineMapRegion) : null
    } catch {
      return null
    }
  }

  function saveRegion(region: MarineMapRegion) {
    try {
      if (!import.meta.client || !storageKey.value) return
      localStorage.setItem(storageKey.value, JSON.stringify(region))
      savedRegion.value = region
    } catch {
      /* localStorage is optional for this feature */
    }
  }

  function clearSavedRegion() {
    try {
      if (!import.meta.client || !storageKey.value) return
      localStorage.removeItem(storageKey.value)
      savedRegion.value = null
    } catch {
      /* localStorage is optional for this feature */
    }
  }

  function onRegionChange(region: MarineMapRegion) {
    saveRegion(region)
  }

  onMounted(() => {
    savedRegion.value = getSavedRegion()
  })

  watch(storageKey, () => {
    savedRegion.value = getSavedRegion()
  })

  return {
    savedRegion: readonly(savedRegion),
    getSavedRegion,
    saveRegion,
    clearSavedRegion,
    onRegionChange,
  }
}
