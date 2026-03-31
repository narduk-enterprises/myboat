<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const route = useRoute()
const username = computed(() => String(route.params.username || ''))
const store = useMyBoatVesselStore()

const { data, error } = await usePublicProfile(username.value)

watch(
  () => data.value,
  (nextProfile) => {
    if (!nextProfile) {
      store.setActivePublicVessel(null)
      return
    }

    store.hydratePublicProfile(nextProfile)
    const primary = nextProfile.vessels.find((vessel) => vessel.isPrimary) ?? nextProfile.vessels[0]
    if (primary) {
      store.setActivePublicVessel(`${nextProfile.profile.username}/${primary.slug}`)
    } else {
      store.setActivePublicVessel(null)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  store.setActivePublicVessel(null)
})

const profile = computed(() => data.value ?? null)
const publicVessels = computed(() => store.getPublicProfileEntries(username.value))

const trafficContextSlug = computed(() => {
  const vessels = profile.value?.vessels ?? []
  const primary = vessels.find((vessel) => vessel.isPrimary) ?? vessels[0]
  return primary?.slug ?? ''
})

const trafficEntry = computed(() =>
  trafficContextSlug.value ? store.getPublicEntry(username.value, trafficContextSlug.value) : null,
)
const rawAisContacts = computed(() => store.serializeAisContacts(trafficEntry.value))
const { contacts: aisContacts } = usePublicEnrichedTrafficContacts(
  username,
  trafficContextSlug,
  rawAisContacts,
)

const trafficMapEnabled = ref(true)
usePublicNearbyTrafficHydrator(
  username,
  trafficContextSlug,
  computed(() => trafficEntry.value?.key ?? null),
  trafficMapEnabled,
)

useMyBoatLiveDemand({
  namespace: 'public',
  consumerId: 'public-profile-map',
  demand: computed(() => ({
    selfLevel: 'detail',
    ais: trafficMapEnabled.value,
  })),
})

const trafficLiveState = computed(() => trafficEntry.value?.live ?? null)

useSeo({
  title: profile.value ? `@${profile.value.profile.username}` : 'Captain profile',
  description:
    'Public MyBoat profile surface with the captain handle, vessel summaries, and current marine status.',
})

useWebPageSchema({
  name: 'Captain profile',
  description:
    'Public MyBoat profile surface with the captain handle, vessel summaries, and current marine status.',
  type: 'CollectionPage',
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="profile">
      <section
        data-testid="public-profile-hero"
        class="public-hero public-hero--compact shadow-overlay rounded-[1.25rem] px-4 py-3.5 sm:px-6 sm:py-4"
      >
        <div
          class="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <div class="min-w-0 space-y-1">
            <div class="marine-kicker w-fit scale-90 origin-left">Public captain log</div>
            <h1 class="truncate font-display text-2xl text-default sm:text-3xl">
              @{{ profile.profile.username }}
            </h1>
            <p
              v-if="profile.profile.headline"
              class="line-clamp-2 text-sm leading-snug text-muted sm:max-w-xl"
            >
              {{ profile.profile.headline }}
            </p>
          </div>
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted sm:shrink-0 sm:justify-end"
          >
            <span class="font-medium text-default">{{ profile.profile.captainName }}</span>
            <template v-if="profile.profile.homePort">
              <span class="text-dimmed" aria-hidden="true">·</span>
              <span>{{ profile.profile.homePort }}</span>
            </template>
            <span class="text-dimmed" aria-hidden="true">·</span>
            <span>
              {{ profile.vessels.length }}
              {{ profile.vessels.length === 1 ? 'vessel' : 'vessels' }}
            </span>
          </div>
        </div>
      </section>

      <div data-testid="public-profile-map">
        <MyBoatSurfaceMap
          :vessels="publicVessels"
          :passages="[]"
          height-class="h-[20rem] sm:h-[24rem] lg:h-[28rem]"
          :show-focus-panel="false"
          :show-layer-toggles="false"
          :show-pin-labels="false"
          :allow-traffic="Boolean(trafficContextSlug)"
          v-model:traffic-enabled="trafficMapEnabled"
          :ais-contacts="aisContacts"
          :has-signal-k-source="Boolean(trafficLiveState?.hasSignalKSource)"
          :live-connection-state="trafficLiveState?.connectionState ?? 'idle'"
          :live-last-delta-at="trafficLiveState?.lastDeltaAt ?? null"
          :show-ais-toggle="Boolean(trafficContextSlug)"
        />
      </div>

      <section
        data-testid="public-vessel-grid"
        class="grid gap-5"
        :class="publicVessels.length > 1 ? 'lg:grid-cols-2' : ''"
      >
        <VesselSummaryCard
          v-for="vessel in publicVessels"
          :key="vessel.id"
          :vessel="vessel"
          :to="`/${profile.profile.username}/${vessel.slug}`"
        />
      </section>

      <BuddyBoatsMap
        v-if="profile.followedVessels.length"
        :vessels="profile.followedVessels"
        title="Buddy boats map"
        description="A wider chart view of the boats this captain follows through AIS Hub."
        height-class="h-[20rem] sm:h-[24rem] lg:h-[28rem]"
      />

      <UCard
        v-if="profile.followedVessels.length"
        class="chart-surface rounded-[1.75rem] shadow-card"
      >
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Fleet friends</h2>
            <p class="mt-1 text-sm text-muted">
              Boats this captain explicitly follows through AIS Hub.
            </p>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-2">
          <FleetFriendCard
            v-for="vessel in profile.followedVessels"
            :key="vessel.id"
            :vessel="vessel"
          />
        </div>
      </UCard>
    </template>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Profile unavailable"
      description="The public profile could not be found or is not currently shared."
    />
  </div>
</template>
