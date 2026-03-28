<script setup lang="ts">
import type { VesselDetailResponse } from '~/types/myboat'

const props = withDefaults(
  defineProps<{
    detail: VesselDetailResponse | null
    pending?: boolean
    activeView: 'live' | 'passages'
    fallbackDescription: string
  }>(),
  {
    pending: false,
  },
)

const navigationItems = computed(() => {
  const slug = props.detail?.vessel.slug
  if (!slug) {
    return []
  }

  return [
    {
      label: 'Live',
      icon: 'i-lucide-radar',
      to: `/dashboard/vessels/${slug}`,
      active: props.activeView === 'live',
    },
    {
      label: 'Passages',
      icon: 'i-lucide-route',
      to: `/dashboard/vessels/${slug}/passages`,
      active: props.activeView === 'passages',
    },
  ]
})

const postureLabel = computed(() => {
  if (!props.detail) {
    return 'Awaiting vessel detail'
  }

  if (props.activeView === 'passages') {
    const passageCount = props.detail.passages.length
    return `${passageCount} passage${passageCount === 1 ? '' : 's'} recorded`
  }

  return props.detail.vessel.liveSnapshot?.observedAt ? 'Live telemetry available' : 'Awaiting live telemetry'
})
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-44 rounded-[2rem]" />
      <div class="rounded-[1.75rem] border border-default/70 bg-default/80 p-4">
        <div class="flex flex-wrap gap-3">
          <USkeleton class="h-10 w-28 rounded-full" />
          <USkeleton class="h-10 w-36 rounded-full" />
        </div>
      </div>
      <slot />
    </template>

    <template v-else-if="detail">
      <UPageHero
        :title="detail.vessel.name"
        :description="detail.vessel.summary || fallbackDescription"
      >
        <template #links>
          <UButton
            v-if="detail.profile.username"
            :to="`/${detail.profile.username}/${detail.vessel.slug}`"
            color="neutral"
            variant="soft"
            icon="i-lucide-share-2"
          >
            Public vessel page
          </UButton>
        </template>
      </UPageHero>

      <section
        class="rounded-[1.75rem] border border-default/80 bg-default/85 px-4 py-4 shadow-card sm:px-5"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in navigationItems"
              :key="item.label"
              :to="item.to"
              :icon="item.icon"
              :color="item.active ? 'primary' : 'neutral'"
              :variant="item.active ? 'soft' : 'outline'"
            >
              {{ item.label }}
            </UButton>
          </div>

          <div class="flex flex-wrap gap-2 text-sm">
            <UBadge color="primary" variant="soft">{{ postureLabel }}</UBadge>
            <UBadge color="neutral" variant="soft">
              {{ detail.installations.length }} installs
            </UBadge>
            <UBadge color="neutral" variant="soft">
              {{ detail.waypoints.length }} waypoints
            </UBadge>
            <UBadge color="neutral" variant="soft">
              {{ detail.media.length }} media
            </UBadge>
          </div>
        </div>
      </section>

      <slot />
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Vessel unavailable"
      description="We could not load this vessel surface right now."
    />
  </div>
</template>
