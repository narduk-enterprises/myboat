export function useCompactViewport(query = '(max-width: 1023px)') {
  const isCompactViewport = shallowRef(false)

  let mediaQuery: MediaQueryList | null = null

  function syncViewportState() {
    isCompactViewport.value = mediaQuery?.matches ?? false
  }

  onMounted(() => {
    if (!import.meta.client) {
      return
    }

    mediaQuery = window.matchMedia(query)
    syncViewportState()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewportState)
      return
    }

    mediaQuery.addListener(syncViewportState)
  })

  onBeforeUnmount(() => {
    if (!mediaQuery) {
      return
    }

    if (typeof mediaQuery.removeEventListener === 'function') {
      mediaQuery.removeEventListener('change', syncViewportState)
    } else {
      mediaQuery.removeListener(syncViewportState)
    }
  })

  return isCompactViewport
}
