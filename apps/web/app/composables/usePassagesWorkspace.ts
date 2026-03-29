import type { PassageSummary } from '~/types/myboat'
import {
  buildPassageSelectionQuery,
  filterPassages,
  resolveSelectedPassageId,
  sortPassages,
  type PassageWorkspaceSortMode,
} from '~/utils/passages-workspace'

export function usePassagesWorkspace(options: {
  passages: Ref<PassageSummary[]> | ComputedRef<PassageSummary[]>
  queryKey?: string
}) {
  const route = useRoute()
  const router = useRouter()
  const queryKey = options.queryKey || 'p'
  const searchQuery = shallowRef('')
  const sortMode = shallowRef<PassageWorkspaceSortMode>('date')
  const selectedPassageId = shallowRef<string | null>(null)

  const allPassages = computed(() => options.passages.value || [])

  watch(
    () => route.query[queryKey],
    (value) => {
      selectedPassageId.value = typeof value === 'string' ? value : null
    },
    { immediate: true },
  )

  watch(
    allPassages,
    (passages) => {
      const resolvedSelection = resolveSelectedPassageId(passages, selectedPassageId.value)
      if (resolvedSelection !== selectedPassageId.value) {
        selectedPassageId.value = resolvedSelection
      }
    },
    { immediate: true },
  )

  watch(selectedPassageId, async (value) => {
    const currentValue = typeof route.query[queryKey] === 'string' ? route.query[queryKey] : null
    if (currentValue === value) {
      return
    }

    await router.replace({
      query: buildPassageSelectionQuery(route.query, value, queryKey),
    })
  })

  const filteredPassages = computed(() => filterPassages(allPassages.value, searchQuery.value))
  const displayedPassages = computed(() => sortPassages(filteredPassages.value, sortMode.value))
  const selectedPassage = computed(
    () => allPassages.value.find((passage) => passage.id === selectedPassageId.value) || null,
  )
  const mapPassages = computed(() =>
    selectedPassage.value ? [selectedPassage.value] : allPassages.value,
  )

  function clearSelectedPassage() {
    selectedPassageId.value = null
  }

  function toggleSelectedPassage(id: string) {
    selectedPassageId.value = selectedPassageId.value === id ? null : id
  }

  return {
    allPassages,
    clearSelectedPassage,
    displayedPassages,
    filteredPassages,
    mapPassages,
    searchQuery,
    selectedPassage,
    selectedPassageId,
    sortMode,
    toggleSelectedPassage,
  }
}
