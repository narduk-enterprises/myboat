<script setup lang="ts">
import type { PublicExploreItem } from '~/types/myboat'
import { formatRelativeTime } from '~/utils/marine'

definePageMeta({ layout: 'landing' })

const liveFilter = ref<'all' | 'live' | 'recent' | 'stale'>('all')
const vesselTypeFilter = ref<string>('All vessel types')
const regionFilter = ref<string>('All regions')
const store = useMyBoatVesselStore()

const { data, error } = await usePublicExplore()

const explore = computed(() => data.value)
watch(
  () => data.value,
  (nextExplore) => {
    store.setActivePublicVessel(null)

    if (!nextExplore) {
      return
    }

    store.hydratePublicExplore(nextExplore)
  },
  { immediate: true },
)

const items = computed<PublicExploreItem[]>(() => store.getPublicExploreItems())
const featuredItems = computed<PublicExploreItem[]>(() => {
  return (
    explore.value?.featuredItems.map((item) => {
      const entry = store.getPublicEntry(item.profile.username, item.vessel.slug)
      if (!entry?.profile || !entry.vessel || !entry.freshnessState) {
        return item
      }

      return {
        profile: entry.profile,
        vessel: entry.vessel,
        freshnessState: entry.freshnessState,
        lastObservedAt:
          entry.mergedSnapshot?.observedAt || entry.storedSnapshot?.observedAt || null,
      } satisfies PublicExploreItem
    }) ?? []
  )
})

const vesselTypeOptions = computed(() => [
  'All vessel types',
  ...new Set(items.value.map((item) => item.vessel.vesselType).filter(Boolean)),
])

const regionOptions = computed(() => [
  'All regions',
  ...new Set(
    items.value.map((item) => item.vessel.homePort || item.profile.homePort).filter(Boolean),
  ),
])

const filteredItems = computed(() =>
  items.value.filter((item) => {
    const matchesLive = liveFilter.value === 'all' ? true : item.freshnessState === liveFilter.value
    const matchesType =
      vesselTypeFilter.value === 'All vessel types'
        ? true
        : item.vessel.vesselType === vesselTypeFilter.value
    const region = item.vessel.homePort || item.profile.homePort || ''
    const matchesRegion =
      regionFilter.value === 'All regions' ? true : region === regionFilter.value

    return matchesLive && matchesType && matchesRegion
  }),
)

const mapVessels = computed(() => filteredItems.value.map((item) => item.vessel))
const mapPassages = computed(() =>
  filteredItems.value
    .map((item) => item.vessel.latestPassage)
    .filter((passage) => passage !== null),
)

useSeo({
  title: 'Explore public vessels',
  description: 'Browse captain-shared boats by status, type, and region.',
})

useWebPageSchema({
  name: 'Explore public vessels',
  description: 'Browse captain-shared boats by status, type, and region.',
  type: 'CollectionPage',
})

const discoveryRules = [
  {
    title: 'Fresh boats first',
    detail: 'Recently updated boats rise to the top.',
  },
  {
    title: 'Filters stay broad',
    detail: 'Use status, type, and region to narrow fast.',
  },
  {
    title: 'Public pages stay clean',
    detail: 'You see boat context, not private install controls.',
  },
]
</script>

<template>
  <div class="space-y-8">
    <section class="public-hero px-6 py-10 shadow-overlay sm:px-10">
      <div class="relative z-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div class="space-y-4">
          <div class="marine-kicker w-fit">Public explore</div>
          <div>
            <h1 class="font-display text-5xl text-default sm:text-6xl">Explore public boats</h1>
            <p class="mt-3 max-w-2xl text-lg text-muted">
              Browse captain-shared boats by status, type, and home port, then open the full public
              page.
            </p>
          </div>
        </div>

        <UCard class="chart-surface rounded-[1.75rem]">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="metric-shell rounded-[1.35rem] p-4">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Captains</p>
              <p class="mt-3 font-display text-xl text-default">
                {{ explore?.stats.publicCaptainCount ?? 0 }}
              </p>
            </div>
            <div class="metric-shell rounded-[1.35rem] p-4">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Public vessels</p>
              <p class="mt-3 font-display text-xl text-default">
                {{ explore?.stats.publicVesselCount ?? 0 }}
              </p>
            </div>
            <div class="metric-shell rounded-[1.35rem] p-4">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Live now</p>
              <p class="mt-3 font-display text-xl text-default">
                {{ explore?.stats.liveVesselCount ?? 0 }}
              </p>
            </div>
            <div class="metric-shell rounded-[1.35rem] p-4">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Recent</p>
              <p class="mt-3 font-display text-xl text-default">
                {{ explore?.stats.recentVesselCount ?? 0 }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 class="font-display text-2xl text-default">Map view</h2>
              <p class="mt-1 text-sm text-muted">
                Filter by status, type, or region before you open a boat.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-3">
              <USelectMenu v-model="liveFilter" :items="['all', 'live', 'recent', 'stale']" />
              <USelectMenu v-model="vesselTypeFilter" :items="vesselTypeOptions" />
              <USelectMenu v-model="regionFilter" :items="regionOptions" />
            </div>
          </div>
        </template>

        <MyBoatSurfaceMap
          v-if="filteredItems.length"
          :vessels="mapVessels"
          :passages="mapPassages"
          height-class="h-[22rem] sm:h-[28rem] lg:h-[34rem]"
          :show-focus-panel="false"
          :show-layer-toggles="false"
          :show-pin-labels="false"
        />

        <MarineEmptyState
          v-else-if="!error"
          icon="i-lucide-compass"
          title="No vessels match these filters"
          description="Try a broader region or a less restrictive live-status filter."
          compact
        />

        <UAlert
          v-else
          color="error"
          variant="soft"
          title="Explore unavailable"
          description="Public discovery could not be loaded right now."
        />
      </UCard>

      <div class="space-y-6">
        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Featured boats</h2>
              <p class="mt-1 text-sm text-muted">Recently updated boats surface first.</p>
            </div>
          </template>

          <div v-if="featuredItems.length" class="space-y-4">
            <article
              v-for="item in featuredItems.slice(0, 3)"
              :key="`${item.profile.username}-${item.vessel.id}`"
              class="rounded-[1.4rem] border border-default/70 bg-default/70 p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-display text-xl text-default">{{ item.vessel.name }}</p>
                  <p class="mt-1 text-sm text-muted">
                    @{{ item.profile.username }}
                    <span v-if="item.vessel.homePort"> · {{ item.vessel.homePort }}</span>
                  </p>
                </div>
                <UBadge color="primary" variant="soft">{{ item.freshnessState }}</UBadge>
              </div>

              <p class="mt-3 text-sm leading-6 text-muted">
                {{
                  item.vessel.summary ||
                  item.profile.headline ||
                  'Public boat with recent telemetry and trip history.'
                }}
              </p>

              <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div class="metric-shell rounded-2xl px-3 py-2">
                  <p class="text-xs uppercase tracking-wide text-muted">Observed</p>
                  <p class="mt-1 font-semibold text-default">
                    {{ formatRelativeTime(item.lastObservedAt) }}
                  </p>
                </div>
                <div class="metric-shell rounded-2xl px-3 py-2">
                  <p class="text-xs uppercase tracking-wide text-muted">Type</p>
                  <p class="mt-1 font-semibold text-default">
                    {{ item.vessel.vesselType || 'Bluewater vessel' }}
                  </p>
                </div>
              </div>

              <div class="mt-4 flex justify-end">
                <UButton
                  :to="`/${item.profile.username}/${item.vessel.slug}`"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-arrow-right"
                >
                  Open vessel
                </UButton>
              </div>
            </article>
          </div>

          <MarineEmptyState
            v-else
            icon="i-lucide-radio"
            title="No featured boats yet"
            description="Boats with fresh telemetry or recent trips show up here."
            compact
          />
        </UCard>

        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default">What you&apos;ll see</h2>
              <p class="mt-1 text-sm text-muted">A quick read on how discovery works.</p>
            </div>
          </template>

          <div class="space-y-3">
            <article
              v-for="rule in discoveryRules"
              :key="rule.title"
              class="rounded-[1.2rem] border border-default/70 bg-default/60 px-4 py-3"
            >
              <p class="font-medium text-default">{{ rule.title }}</p>
              <p class="mt-1 text-sm text-muted">{{ rule.detail }}</p>
            </article>
          </div>
        </UCard>
      </div>
    </section>

    <section class="space-y-4">
      <div>
        <h2 class="font-display text-2xl text-default">All public boats</h2>
        <p class="mt-1 text-sm text-muted">Every boat currently shared in MyBoat.</p>
      </div>

      <div v-if="filteredItems.length" class="grid gap-5 lg:grid-cols-2">
        <VesselSummaryCard
          v-for="item in filteredItems"
          :key="`${item.profile.username}-${item.vessel.id}`"
          :vessel="item.vessel"
          :to="`/${item.profile.username}/${item.vessel.slug}`"
        />
      </div>

      <MarineEmptyState
        v-else-if="!error"
        icon="i-lucide-ship"
        title="No public vessels yet"
        description="Once captains opt into public discovery, they will appear here."
      />
    </section>
  </div>
</template>
