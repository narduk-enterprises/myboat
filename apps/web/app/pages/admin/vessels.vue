<script setup lang="ts">
import { formatRelativeTime } from '~/utils/marine'
import type { AuthUser } from '~/composables/useAuthApi'

definePageMeta({ layout: 'admin', middleware: ['auth'] })

useSeo({
  title: 'Admin vessels',
  description: 'Operator vessel overview for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin vessels',
  description: 'Operator vessel overview for MyBoat.',
})

const session = useUserSession()
const currentUser = computed(() => session.user.value as AuthUser | null)
const { data } = await useDashboardOverview('myboat-admin-vessels')

const overview = computed(() => data.value)
const primaryVesselName = computed(() => overview.value?.vessels.find((vessel) => vessel.isPrimary)?.name || 'Pending')
const publicVesselCount = computed(() => overview.value?.vessels.filter((vessel) => vessel.sharePublic).length || 0)
const passageCount = computed(() => overview.value?.stats.passageCount ?? 0)
const mediaCount = computed(() => overview.value?.stats.mediaCount ?? 0)

watchEffect(() => {
  if (session.loggedIn.value && currentUser.value && !currentUser.value.isAdmin) {
    void navigateTo('/dashboard', { replace: true })
  }
})
</script>

<template>
  <div v-if="overview" class="space-y-8">
    <UPageHero
      title="Vessels"
      description="Review vessel visibility, live state, and primary-source posture."
    >
      <template #links>
        <UButton to="/admin" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to admin
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MarineMetricCard
        label="Primary vessel"
        :value="primaryVesselName"
        icon="i-lucide-ship"
      />
      <MarineMetricCard
        label="Public vessels"
        :value="String(publicVesselCount)"
        icon="i-lucide-share-2"
      />
      <MarineMetricCard
        label="Passages"
        :value="String(passageCount)"
        icon="i-lucide-route"
      />
      <MarineMetricCard
        label="Media items"
        :value="String(mediaCount)"
        icon="i-lucide-camera"
      />
    </div>

    <section class="grid gap-5 lg:grid-cols-2">
      <VesselSummaryCard v-for="vessel in overview.vessels" :key="vessel.id" :vessel="vessel" />
    </section>

    <UCard class="border-default/80 bg-default/90 shadow-card">
      <template #header>
        <div>
          <h2 class="font-display text-2xl text-default">Visibility notes</h2>
          <p class="mt-1 text-sm text-muted">Public vs private posture for each vessel at a glance.</p>
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-2">
        <div
          v-for="vessel in overview.vessels"
          :key="`${vessel.id}-visibility`"
          class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-medium text-default">{{ vessel.name }}</p>
              <p class="mt-1 text-xs text-muted">
                {{ vessel.isPrimary ? 'Primary vessel' : 'Secondary vessel' }}
              </p>
            </div>
            <UBadge :color="vessel.sharePublic ? 'success' : 'neutral'" variant="soft">
              {{ vessel.sharePublic ? 'Public' : 'Private' }}
            </UBadge>
          </div>
          <p class="mt-2 text-xs text-muted">
            {{
              vessel.liveSnapshot?.observedAt
                ? `Live snapshot observed ${formatRelativeTime(vessel.liveSnapshot.observedAt)}`
                : 'No live snapshot yet'
            }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
