<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Settings',
  description: 'Captain profile, security, preferences, and sharing controls for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Settings',
  description: 'Captain profile, security, preferences, and sharing controls for MyBoat.',
})

const { data, pending } = await useDashboardOverview('myboat-settings-index')

const overview = computed(() => data.value)
const primaryVessel = computed(
  () => overview.value?.vessels.find((vessel) => vessel.isPrimary) || overview.value?.vessels[0] || null,
)
const primaryInstall = computed(
  () =>
    overview.value?.installations.find((installation) => installation.vesselId === primaryVessel.value?.id) ||
    overview.value?.installations[0] ||
    null,
)
const publicVesselCount = computed(
  () => overview.value?.vessels.filter((vessel) => vessel.sharePublic).length || 0,
)

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
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <USkeleton
          v-for="item in 4"
          :key="item"
          class="h-32 rounded-[1.5rem]"
        />
      </div>
      <div class="grid gap-5 lg:grid-cols-2">
        <USkeleton
          v-for="item in 4"
          :key="item"
          class="h-64 rounded-[1.75rem]"
        />
      </div>
    </template>

    <template v-else-if="overview">
      <section class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8">
        <div class="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="space-y-4">
            <div class="marine-kicker w-fit">Captain controls</div>
            <div>
              <h1 class="font-display text-4xl tracking-tight text-default sm:text-5xl">
                Tune the account, vessel defaults, and public posture
              </h1>
              <p class="mt-3 max-w-3xl text-base leading-7 text-muted">
                Profile identity, security, local display preferences, and sharing policy stay here so
                onboarding can stay focused on the first production setup.
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <UButton to="/dashboard" color="neutral" variant="soft" icon="i-lucide-arrow-left">
              Back to dashboard
            </UButton>
            <UButton
              v-if="overview.profile"
              :to="`/${overview.profile.username}`"
              color="primary"
              icon="i-lucide-share-2"
            >
              Open public profile
            </UButton>
          </div>
        </div>
      </section>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MarineMetricCard
        label="Captain profile"
        :value="overview.profile ? 'Ready' : 'Missing'"
        icon="i-lucide-id-card"
        hint="Public handle and captain identity."
      />
      <MarineMetricCard
        label="Primary vessel"
        :value="primaryVessel?.name || 'Pending'"
        icon="i-lucide-ship"
        hint="The vessel that anchors the public story."
      />
      <MarineMetricCard
        label="Primary install"
        :value="primaryInstall?.label || 'Pending'"
        icon="i-lucide-cpu"
        hint="The current live source for the fleet."
      />
      <MarineMetricCard
        label="Public vessels"
        :value="String(publicVesselCount)"
        icon="i-lucide-share-2"
        hint="Discoverable vessels in public surfaces."
      />
    </div>

    <section class="grid gap-5 lg:grid-cols-2">
      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Profile</h2>
            <p class="mt-1 text-sm text-muted">
              Edit the captain identity that powers your public handle and dashboard identity.
            </p>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">
            Keep your public handle, captain name, and profile copy current. This page uses the
            same canonical setup records as onboarding.
          </p>

          <div class="flex flex-wrap gap-3">
            <UButton to="/dashboard/settings/profile" color="primary" icon="i-lucide-user-round">
              Edit captain profile
            </UButton>
            <UButton to="/dashboard/onboarding" color="neutral" variant="soft" icon="i-lucide-anchor">
              Re-run setup
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Security</h2>
            <p class="mt-1 text-sm text-muted">
              Password changes and MFA live here for the owner account.
            </p>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">
            Keep the account secure with a stronger password and multi-factor authentication.
          </p>

          <div class="flex flex-wrap gap-3">
            <UButton
              to="/dashboard/settings/security"
              color="primary"
              icon="i-lucide-shield-check"
            >
              Open security
            </UButton>
            <UButton to="/dashboard/settings/sharing" color="neutral" variant="soft" icon="i-lucide-globe">
              Review sharing
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Preferences</h2>
            <p class="mt-1 text-sm text-muted">Local marine units and display preferences.</p>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">
            Configure speed, depth, and temperature units once for the browser you are using.
          </p>

          <div class="flex flex-wrap gap-3">
            <UButton
              to="/dashboard/settings/preferences"
              color="primary"
              icon="i-lucide-sliders-horizontal"
            >
              Open preferences
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Sharing</h2>
            <p class="mt-1 text-sm text-muted">Public vessel posture and discoverability controls.</p>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">
            Review which vessels are public, how they appear in explore, and which pages are meant
            for direct links only.
          </p>

          <div class="flex flex-wrap gap-3">
            <UButton to="/dashboard/settings/sharing" color="primary" icon="i-lucide-broadcast">
              Open sharing
            </UButton>
          </div>
        </div>
      </UCard>
    </section>
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Settings unavailable"
      description="We could not load the captain settings surface right now."
    />
  </div>
</template>
