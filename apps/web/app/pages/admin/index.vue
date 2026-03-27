<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Admin',
  description: 'MyBoat platform administration: users, vessels, installations, and telemetry.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'MyBoat admin',
  description: 'MyBoat platform administration: users, vessels, installations, and telemetry.',
})

interface AdminStats {
  captainProfiles: number
  vessels: number
  installations: number
  ingestKeys: number
  passages: number
  mediaItems: number
}

interface UsersResponse {
  users: unknown[]
  total: number
}

const appFetch = useAppFetch()

const { data: stats } = await useAsyncData('admin-app-stats', () =>
  appFetch<AdminStats>('/api/admin/app/stats'),
)

const { data: usersData } = await useAsyncData('admin-users-count', () =>
  appFetch<UsersResponse>('/api/admin/users', { query: { page: 1, limit: 1 } }),
)

const adminSections = [
  {
    label: 'Users',
    description: 'Manage registered accounts and admin roles.',
    icon: 'i-lucide-users',
    to: '/admin/users',
  },
  {
    label: 'Vessels',
    description: 'Review all registered vessels across the platform.',
    icon: 'i-lucide-ship',
    to: '/admin/vessels',
  },
  {
    label: 'Installations',
    description: 'Inspect onboard installs, connection states, and ingest keys.',
    icon: 'i-lucide-cpu',
    to: '/admin/installations',
  },
  {
    label: 'Telemetry',
    description: 'Live snapshot coverage and ingest pipeline health.',
    icon: 'i-lucide-radio',
    to: '/admin/telemetry',
  },
]
</script>

<template>
  <div class="space-y-8">
    <section class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8">
      <div class="space-y-4">
        <div class="marine-kicker w-fit">Platform admin</div>
        <h1 class="font-display text-4xl tracking-tight text-default sm:text-5xl">
          MyBoat admin
        </h1>
        <p class="max-w-2xl text-base text-muted sm:text-lg">
          Platform-wide visibility into captains, vessels, installations, and telemetry. Accessible only to admin accounts.
        </p>
      </div>
    </section>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MarineMetricCard
        label="Registered users"
        :value="String(usersData?.total ?? 0)"
        icon="i-lucide-users"
      />
      <MarineMetricCard
        label="Captain profiles"
        :value="String(stats?.captainProfiles ?? 0)"
        icon="i-lucide-user-round"
      />
      <MarineMetricCard
        label="Vessels"
        :value="String(stats?.vessels ?? 0)"
        icon="i-lucide-ship"
      />
      <MarineMetricCard
        label="Installations"
        :value="String(stats?.installations ?? 0)"
        icon="i-lucide-cpu"
      />
      <MarineMetricCard
        label="Ingest keys"
        :value="String(stats?.ingestKeys ?? 0)"
        icon="i-lucide-key-round"
      />
      <MarineMetricCard
        label="Passages logged"
        :value="String(stats?.passages ?? 0)"
        icon="i-lucide-route"
      />
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="section in adminSections"
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
