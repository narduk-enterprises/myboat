<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Settings',
  description: 'Manage captain profile, security, marine unit preferences, and sharing settings.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Captain settings',
  description: 'Manage captain profile, security, marine unit preferences, and sharing settings.',
})

const settingsSections = [
  {
    label: 'Profile',
    description: 'Captain name, public handle, headline, bio, and home port.',
    icon: 'i-lucide-user-round',
    to: '/dashboard/settings/profile',
  },
  {
    label: 'Security',
    description: 'Change password and review multi-factor authentication status.',
    icon: 'i-lucide-shield-check',
    to: '/dashboard/settings/security',
  },
  {
    label: 'Preferences',
    description: 'Marine units for speed, depth, and temperature readings.',
    icon: 'i-lucide-sliders-horizontal',
    to: '/dashboard/settings/preferences',
  },
  {
    label: 'Sharing',
    description: 'Control public profile visibility and per-vessel sharing flags.',
    icon: 'i-lucide-share-2',
    to: '/dashboard/settings/sharing',
  },
]
</script>

<template>
  <div class="space-y-8">
    <UPageHero
      title="Settings"
      description="Manage your captain identity, account security, unit preferences, and sharing choices."
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="section in settingsSections"
        :key="section.to"
        :to="section.to"
        class="group rounded-[1.75rem] border border-default bg-default/90 p-6 shadow-card transition hover:border-primary/30 hover:shadow-md"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          >
            <UIcon :name="section.icon" class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="font-display text-lg font-medium text-default">{{ section.label }}</p>
            <p class="mt-1 text-sm text-muted">{{ section.description }}</p>
          </div>
          <UIcon
            name="i-lucide-chevron-right"
            class="ml-auto mt-1 size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-default"
          />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
