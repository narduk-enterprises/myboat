<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Sharing · Settings',
  description: 'Control public profile visibility and per-vessel sharing flags.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Sharing settings',
  description: 'Control public profile visibility and per-vessel sharing flags.',
})

const { data } = await useDashboardOverview('myboat-settings-sharing')
const profile = computed(() => data.value?.profile ?? null)
const vessels = computed(() => data.value?.vessels ?? [])
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-3">
      <UButton
        to="/dashboard/settings"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        size="sm"
      >
        Settings
      </UButton>
    </div>

    <UPageHero
      title="Sharing"
      description="Decide what is visible to the public. Profile and vessel sharing are controlled separately."
    />

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div class="space-y-6">
        <UCard class="chart-surface rounded-[1.75rem]">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default">Captain profile</h2>
              <p class="mt-1 text-sm text-muted">
                Your public profile at <span class="font-medium text-default">/{{ profile?.username || 'your-handle' }}</span>.
              </p>
            </div>
          </template>

          <div v-if="profile">
            <div class="flex items-center justify-between gap-4 rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <div>
                <p class="font-medium text-default">Public visibility</p>
                <p class="mt-1 text-sm text-muted">
                  When enabled, anyone with your handle URL can view your captain profile and shared vessels.
                </p>
              </div>
              <UBadge color="success" variant="soft">Active</UBadge>
            </div>

            <p class="mt-4 text-sm text-muted">
              To change profile visibility, use the <NuxtLink to="/dashboard/onboarding" class="font-medium text-default underline underline-offset-2">boat setup</NuxtLink> page where all identity fields can be updated together.
            </p>
          </div>

          <MarineEmptyState
            v-else
            icon="i-lucide-user-round"
            title="Profile not set up"
            description="Complete boat setup to activate public sharing and configure your captain handle."
            compact
          >
            <UButton to="/dashboard/onboarding" color="primary">Start boat setup</UButton>
          </MarineEmptyState>
        </UCard>

        <UCard class="chart-surface rounded-[1.75rem]">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default">Vessel sharing</h2>
              <p class="mt-1 text-sm text-muted">
                Each vessel can be shared publicly or kept private. Public vessels appear on your captain profile.
              </p>
            </div>
          </template>

          <div v-if="vessels.length" class="space-y-3">
            <div
              v-for="vessel in vessels"
              :key="vessel.id"
              class="flex items-center justify-between gap-4 rounded-2xl border border-default bg-elevated/60 px-4 py-4"
            >
              <div>
                <p class="font-medium text-default">{{ vessel.name }}</p>
                <p class="mt-1 text-sm text-muted">
                  {{ vessel.vesselType || 'No type' }} · {{ vessel.homePort || 'No home port' }}
                </p>
              </div>
              <UBadge
                :color="vessel.sharePublic ? 'success' : 'neutral'"
                variant="soft"
              >
                {{ vessel.sharePublic ? 'Public' : 'Private' }}
              </UBadge>
            </div>

            <p class="mt-2 text-sm text-muted">
              To toggle vessel sharing, edit the vessel in <NuxtLink to="/dashboard/onboarding" class="font-medium text-default underline underline-offset-2">boat setup</NuxtLink>.
            </p>
          </div>

          <MarineEmptyState
            v-else
            icon="i-lucide-ship"
            title="No vessels registered"
            description="Add a vessel in boat setup to configure public sharing."
            compact
          >
            <UButton to="/dashboard/onboarding" color="primary">Add vessel</UButton>
          </MarineEmptyState>
        </UCard>
      </div>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-xl text-default">How sharing works</h2>
          </div>
        </template>

        <div class="space-y-4 text-sm text-muted">
          <p>Your captain profile is publicly accessible at <span class="font-medium text-default">mybo.at/your-handle</span>. Anyone with that link can view your shared vessels, passages, media, and live telemetry.</p>
          <p>Vessels marked <span class="font-medium text-default">Public</span> appear on your profile with their latest snapshot, passage history, and media items. Private vessels are hidden from all public surfaces.</p>
          <p>Ingest keys and installation details are always private regardless of vessel sharing status.</p>
          <div class="mt-4 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.2em] text-primary">Privacy note</p>
            <p class="mt-2 text-sm text-muted">Live GPS position and real-time telemetry from public vessels are visible to any viewer. Disable public sharing if you want complete position privacy.</p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
