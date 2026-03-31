<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'
import type { DashboardOverview, VesselDetailResponse } from '~/types/myboat'

const props = defineProps<{
  overview: DashboardOverview
}>()

const route = useRoute()
const router = useRouter()
const appFetch = useAppFetch()
const store = useMyBoatVesselStore()

const availableVessels = computed(() => props.overview.vessels)
const selectedVesselSlug = computed(() => {
  const requestedSlug = typeof route.query.vessel === 'string' ? route.query.vessel : null
  if (requestedSlug && availableVessels.value.some((vessel) => vessel.slug === requestedSlug)) {
    return requestedSlug
  }

  const activeSlug = store.authActiveEntry.value?.vessel?.slug
  if (activeSlug && availableVessels.value.some((vessel) => vessel.slug === activeSlug)) {
    return activeSlug
  }

  return (
    availableVessels.value.find((vessel) => vessel.isPrimary)?.slug ||
    availableVessels.value[0]?.slug ||
    null
  )
})

const { data, error, pending } = await useAsyncData(
  () => `myboat-dashboard-passages:${selectedVesselSlug.value || 'none'}`,
  () => {
    if (!selectedVesselSlug.value) {
      return Promise.resolve(null)
    }

    return appFetch<VesselDetailResponse>(`/api/app/vessels/${selectedVesselSlug.value}`)
  },
  { watch: [selectedVesselSlug] },
)

watch(
  () => data.value,
  (value) => {
    if (!value) {
      return
    }

    store.hydrateAuthVesselDetail(value)
    store.setActiveAuthVessel(value.vessel.id)
  },
  { immediate: true },
)

const detail = computed(() => {
  if (!selectedVesselSlug.value) {
    return null
  }

  return store.getAuthDetailBySlug(selectedVesselSlug.value) || data.value || null
})
const selectedPlaybackReadyCount = computed(
  () => detail.value?.passages.filter((passage) => passage.playbackAvailable).length || 0,
)
const selectedTrackCount = computed(
  () => detail.value?.passages.filter((passage) => Boolean(passage.trackGeojson)).length || 0,
)
const passagesContextCards = computed(() => [
  {
    label: 'Current vessel',
    value: detail.value?.vessel.name || 'Pending',
    note:
      [detail.value?.vessel.vesselType, detail.value?.vessel.homePort]
        .filter(Boolean)
        .join(' · ') || 'Choose the vessel whose route archive should own the workspace.',
  },
  {
    label: 'Recorded passages',
    value: String(detail.value?.passages.length || 0),
    note: detail.value?.passages.length
      ? 'The current archive stays searchable in the companion rail.'
      : 'Routes appear here after the first recorded trip is stored.',
  },
  {
    label: 'Track geometry',
    value: String(selectedTrackCount.value),
    note: selectedTrackCount.value
      ? 'Stored geometry is ready to focus directly on the map.'
      : 'Track-backed passages have not been stored yet.',
  },
  {
    label: 'Playback ready',
    value: String(selectedPlaybackReadyCount.value),
    note: selectedPlaybackReadyCount.value
      ? 'Replay-capable passages can open directly beside the archive rail.'
      : 'Replay bundles will appear here once playback data is stored.',
  },
])

function selectVessel(slug: string) {
  if (slug === selectedVesselSlug.value) {
    return
  }

  const nextQuery: LocationQueryRaw = {
    ...route.query,
    vessel: slug,
  }

  delete nextQuery.p

  void router.replace({ query: nextQuery })
}
</script>

<template>
  <div data-testid="dashboard-passages-surface" class="space-y-6">
    <OperatorRouteMasthead
      eyebrow="Passages"
      title="Route archive and playback workspace"
      description="Keep the selected vessel, active route focus, and playback state in one operational surface instead of splitting them across separate pages."
    >
      <template #actions>
        <UButton
          v-if="detail"
          :to="`/dashboard/vessels/${detail.vessel.slug}`"
          color="neutral"
          variant="soft"
          icon="i-lucide-radar"
        >
          Open live view
        </UButton>

        <UButton
          v-if="detail?.profile.username"
          :to="`/${detail.profile.username}/${detail.vessel.slug}/passages`"
          color="neutral"
          variant="soft"
          icon="i-lucide-share-2"
        >
          Public log
        </UButton>
      </template>

      <template #meta>
        <div class="space-y-4">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="card in passagesContextCards"
              :key="card.label"
              class="rounded-[1.15rem] border border-default/70 bg-elevated/70 px-4 py-3"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                {{ card.label }}
              </p>
              <p class="mt-2 font-display text-lg text-default">{{ card.value }}</p>
              <p class="mt-1 text-xs text-muted">{{ card.note }}</p>
            </div>
          </div>

          <div v-if="availableVessels.length > 1" class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
              Switch vessel
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="vessel in availableVessels"
                :key="vessel.id"
                :color="selectedVesselSlug === vessel.slug ? 'primary' : 'neutral'"
                :variant="selectedVesselSlug === vessel.slug ? 'soft' : 'outline'"
                size="xs"
                @click="selectVessel(vessel.slug)"
              >
                {{ vessel.name }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </OperatorRouteMasthead>

    <template v-if="pending">
      <USkeleton class="h-[24rem] rounded-[1.75rem]" />
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="item in 4" :key="item" class="h-32 rounded-[1.5rem]" />
      </div>
    </template>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Passages unavailable"
      description="The captain passage workspace could not be loaded right now."
    />

    <PassagesWorkspace
      v-else-if="detail"
      :vessel="detail.vessel"
      :passages="detail.passages"
      :waypoints="detail.waypoints"
      :media="detail.media"
      title="Captain passage log"
      description="Switch vessels when needed, search the route log, and focus one saved track without leaving the captain workspace."
      :map-persist-key="`dashboard-passages:${detail.vessel.slug}`"
      :show-header="false"
    />
  </div>
</template>
