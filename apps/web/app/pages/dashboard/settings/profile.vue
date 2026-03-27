<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Profile · Settings',
  description: 'Review and update your public captain profile including name, handle, headline, bio, and home port.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Captain profile settings',
  description:
    'Review and update your public captain profile including name, handle, headline, bio, and home port.',
})

const { data } = await useDashboardOverview('myboat-settings-profile')
const profile = computed(() => data.value?.profile ?? null)
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
      title="Profile"
      description="Your public captain identity. The handle, bio, and home port appear on your public profile page."
    />

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <UCard class="chart-surface rounded-[1.75rem]">
        <template #header>
          <div>
            <h2 class="font-display text-xl text-default">Captain identity</h2>
            <p class="mt-1 text-sm text-muted">
              These details power your public profile at
              <span v-if="profile" class="font-medium text-default">/{{ profile.username }}</span
              ><span v-else class="italic">your handle</span>.
            </p>
          </div>
        </template>

        <div v-if="profile" class="space-y-4">
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.2em] text-muted">Captain name</p>
            <p class="mt-2 font-display text-xl text-default">{{ profile.captainName }}</p>
          </div>

          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.2em] text-muted">Public handle</p>
            <p class="mt-2 font-medium text-default">@{{ profile.username }}</p>
          </div>

          <div v-if="profile.headline" class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.2em] text-muted">Headline</p>
            <p class="mt-2 text-default">{{ profile.headline }}</p>
          </div>

          <div v-if="profile.bio" class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.2em] text-muted">Bio</p>
            <p class="mt-2 text-sm text-default">{{ profile.bio }}</p>
          </div>

          <div v-if="profile.homePort" class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.2em] text-muted">Home port</p>
            <p class="mt-2 text-default">{{ profile.homePort }}</p>
          </div>
        </div>

        <MarineEmptyState
          v-else
          icon="i-lucide-user-round"
          title="Profile not set up yet"
          description="Complete the boat setup flow to create your captain profile and public handle."
          compact
        >
          <UButton to="/dashboard/onboarding" color="primary">Start boat setup</UButton>
        </MarineEmptyState>

        <template v-if="profile" #footer>
          <div class="flex justify-end">
            <UButton
              to="/dashboard/onboarding"
              color="primary"
              icon="i-lucide-pencil"
            >
              Edit profile
            </UButton>
          </div>
        </template>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-xl text-default">Public visibility</h2>
            <p class="mt-1 text-sm text-muted">
              What others see when they visit your captain profile link.
            </p>
          </div>
        </template>

        <div class="space-y-4 text-sm text-muted">
          <p>Your public handle is the permanent URL for your captain profile. Choose it carefully — it anchors your vessel sharing links and public story.</p>
          <p>The headline and bio appear in the hero section of your public profile. Home port is shown as a location context below your name.</p>
          <p>Profile visibility is controlled under <NuxtLink to="/dashboard/settings/sharing" class="font-medium text-default underline underline-offset-2">Sharing settings</NuxtLink>.</p>
        </div>

        <template v-if="profile" #footer>
          <div class="flex justify-end">
            <UButton
              :to="`/${profile.username}`"
              color="neutral"
              variant="soft"
              icon="i-lucide-external-link"
            >
              View public profile
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
