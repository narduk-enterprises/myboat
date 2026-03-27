<script setup lang="ts">
import type { PassageSummary } from '~/types/myboat'

const { data } = await usePublicExplore()

useSeo({
  title: 'Explore vessels',
  description:
    'Discover public vessels, check live marine status, and follow passages from captains on MyBoat.',
})

useWebPageSchema({
  name: 'Explore vessels',
  description:
    'Discover public vessels, check live marine status, and follow passages from captains on MyBoat.',
  type: 'CollectionPage',
})

const filterLiveOnly = ref(false)
const filterVesselType = ref('')
const filterRegion = ref('')

const vessels = computed(() => data.value?.vessels ?? [])

const vesselTypes = computed(() => {
  const types = new Set<string>()
  for (const v of vessels.value) {
    if (v.vesselType) types.add(v.vesselType)
  }
  return [...types].sort()
})

const filteredVessels = computed(() => {
  let result = vessels.value

  if (filterLiveOnly.value) {
    result = result.filter((v) => v.liveSnapshot?.positionLat != null)
  }

  if (filterVesselType.value) {
    result = result.filter((v) => v.vesselType === filterVesselType.value)
  }

  if (filterRegion.value.trim()) {
    const query = filterRegion.value.toLowerCase()
    result = result.filter((v) => v.homePort?.toLowerCase().includes(query))
  }

  return result
})

const mapPassages = computed<PassageSummary[]>(() =>
  filteredVessels.value
    .map((v) => v.latestPassage)
    .filter((p): p is PassageSummary => p !== null),
)

const vesselTypeOptions = computed(() => [
  { label: 'All vessel types', value: '' },
  ...vesselTypes.value.map((t) => ({ label: t, value: t })),
])
</script>

<template>
  <div class="space-y-8">
    <section class="public-hero px-6 py-10 shadow-overlay sm:px-10">
      <div class="relative z-10 space-y-6">
        <div class="marine-kicker w-fit">Public fleet discovery</div>

        <div>
          <h1 class="font-display text-5xl text-default">Explore vessels</h1>
          <p class="mt-3 max-w-2xl text-lg text-muted">
            Browse public vessels, check live marine status, and follow passages from captains on
            MyBoat.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <label class="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <USwitch v-model="filterLiveOnly" size="sm" />
            <span>Live only</span>
          </label>

          <USelect
            v-if="vesselTypes.length"
            v-model="filterVesselType"
            :items="vesselTypeOptions"
            size="sm"
            class="w-52"
          />

          <UInput
            v-model="filterRegion"
            placeholder="Filter by home port…"
            size="sm"
            leading-icon="i-lucide-map-pin"
            class="w-56"
          />
        </div>
      </div>
    </section>

    <MarineTrackMap
      :vessels="filteredVessels"
      :passages="mapPassages"
      height-class="h-[30rem]"
    />

    <template v-if="filteredVessels.length">
      <section class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="vessel in filteredVessels" :key="vessel.id" class="flex flex-col gap-2">
          <NuxtLink
            :to="`/${vessel.captainUsername}`"
            class="px-1 text-xs text-muted transition-colors hover:text-default"
          >
            @{{ vessel.captainUsername }}
          </NuxtLink>
          <VesselSummaryCard
            :vessel="vessel"
            :to="`/${vessel.captainUsername}/${vessel.slug}`"
            class="flex-1"
          />
        </div>
      </section>
    </template>

    <MarineEmptyState
      v-else
      icon="i-lucide-anchor"
      title="No public vessels match your filters"
      description="Try adjusting the live status, vessel type, or home port filters to discover more vessels."
    />
  </div>
</template>
