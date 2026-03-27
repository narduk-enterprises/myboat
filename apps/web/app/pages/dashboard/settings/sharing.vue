<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Sharing',
  description: 'Public profile and vessel sharing posture for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Sharing',
  description: 'Public profile and vessel sharing posture for MyBoat.',
})

const { data, pending } = await useDashboardOverview('myboat-settings-sharing')

const overview = computed(() => data.value)
const publicVessels = computed(() => overview.value?.vessels.filter((vessel) => vessel.sharePublic) || [])
const privateVessels = computed(() => overview.value?.vessels.filter((vessel) => !vessel.sharePublic) || [])

watchEffect(() => {
  if (overview.value && !overview.value.profile) {
    void navigateTo('/dashboard/onboarding', { replace: true })
  }
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-56 rounded-[2rem]" />
      <div class="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <USkeleton class="h-72 rounded-[1.75rem]" />
        <USkeleton class="h-72 rounded-[1.75rem]" />
      </div>
      <USkeleton class="h-[26rem] rounded-[1.75rem]" />
    </template>

    <template v-else-if="overview">
    <UPageHero
      title="Sharing"
      description="Review public profile posture, vessel visibility, and discoverability."
    >
      <template #links>
        <UButton to="/dashboard/settings" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to settings
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Current posture</h2>
            <p class="mt-1 text-sm text-muted">
              Public captain pages and public vessel pages are what followers can reach today.
            </p>
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Public profile</p>
            <p class="mt-3 font-display text-xl text-default">
              /{{ overview.profile?.username || 'pending' }}
            </p>
          </div>
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Public vessels</p>
            <p class="mt-3 font-display text-xl text-default">{{ publicVessels.length }}</p>
          </div>
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Private vessels</p>
            <p class="mt-3 font-display text-xl text-default">{{ privateVessels.length }}</p>
          </div>
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Discoverable</p>
            <p class="mt-3 font-display text-xl text-default">
              {{ publicVessels.length ? 'Yes' : 'No' }}
            </p>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Launch modes</h2>
            <p class="mt-1 text-sm text-muted">
              The launch model is private, delayed, or exact, with vessel-specific presets.
            </p>
          </div>
        </template>

        <div class="space-y-4 text-sm text-muted">
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="font-medium text-default">Private</p>
            <p class="mt-1">Nothing public except what you explicitly publish through a profile.</p>
          </div>
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="font-medium text-default">Delayed</p>
            <p class="mt-1">Public followers see a delayed and area-level live posture.</p>
          </div>
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="font-medium text-default">Exact</p>
            <p class="mt-1">Exact live sharing is allowed per vessel, with a captain-selectable bundle.</p>
          </div>
        </div>
      </UCard>
    </div>

    <section class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-display text-2xl text-default">Vessel visibility</h2>
          <p class="mt-1 text-sm text-muted">
            These are the vessels that are currently public versus private.
          </p>
        </div>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <VesselSummaryCard v-for="vessel in publicVessels" :key="vessel.id" :vessel="vessel" />

        <UCard
          v-for="vessel in privateVessels"
          :key="vessel.id"
          class="border-dashed border-default/70 bg-default/70 shadow-card"
        >
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="font-display text-xl text-default">{{ vessel.name }}</p>
                <p class="mt-1 text-sm text-muted">Private vessel, not discoverable in explore.</p>
              </div>
              <UBadge color="neutral" variant="soft">Private</UBadge>
            </div>
            <p class="text-sm text-muted">
              Open the vessel page to review its current live posture and historical records.
            </p>
            <UButton :to="`/dashboard/vessels/${vessel.slug}`" color="neutral" variant="soft">
              Open vessel
            </UButton>
          </div>
        </UCard>
      </div>
    </section>
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Sharing unavailable"
      description="We could not load the sharing controls right now."
    />
  </div>
</template>
