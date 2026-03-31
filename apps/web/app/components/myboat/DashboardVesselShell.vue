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
const isCompactViewport = useCompactViewport()

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

  return props.detail.vessel.liveSnapshot?.observedAt
    ? 'Live telemetry available'
    : 'Awaiting live telemetry'
})
const publicVesselPath = computed(() =>
  props.detail?.profile.username
    ? `/${props.detail.profile.username}/${props.detail.vessel.slug}`
    : null,
)
const vesselDescription = computed(() => props.detail?.vessel.summary || props.fallbackDescription)
const vesselMetaBadges = computed(() => {
  if (!props.detail) {
    return []
  }

  return [
    `${props.detail.installations.length} installs`,
    `${props.detail.waypoints.length} waypoints`,
    `${props.detail.media.length} media`,
  ]
})
const vesselContextCards = computed(() => {
  if (!props.detail) {
    return []
  }

  return [
    {
      label: props.activeView === 'passages' ? 'Archive status' : 'Live status',
      value: postureLabel.value,
      note:
        props.activeView === 'passages'
          ? 'Playback focus, stored routes, and route memory stay in this workspace.'
          : 'Current telemetry and live vessel context stay visible here.',
    },
    {
      label: 'Public posture',
      value: publicVesselPath.value ? 'Public route ready' : 'Private only',
      note: publicVesselPath.value
        ? 'The public vessel page is available from this route.'
        : 'Finish the public captain profile before sharing outward.',
    },
    {
      label: 'Installations',
      value: String(props.detail.installations.length),
      note: `${props.detail.installations.length} linked live source${props.detail.installations.length === 1 ? '' : 's'}.`,
    },
    {
      label: 'Linked context',
      value: `${props.detail.waypoints.length} / ${props.detail.media.length}`,
      note: `${props.detail.waypoints.length} waypoint${props.detail.waypoints.length === 1 ? '' : 's'} and ${props.detail.media.length} media item${props.detail.media.length === 1 ? '' : 's'}.`,
    },
  ]
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
      <section
        v-if="isCompactViewport"
        class="rounded-[1.5rem] border border-default/80 bg-default/88 px-4 py-5 shadow-card"
      >
        <div class="space-y-4">
          <div class="flex flex-wrap gap-2 text-sm">
            <UBadge color="primary" variant="soft">{{ postureLabel }}</UBadge>
            <UBadge v-for="badge in vesselMetaBadges" :key="badge" color="neutral" variant="soft">
              {{ badge }}
            </UBadge>
          </div>

          <div class="space-y-3">
            <h1 class="font-display text-4xl leading-none text-default">
              {{ detail.vessel.name }}
            </h1>
            <p class="text-sm leading-6 text-muted">
              {{ vesselDescription }}
            </p>
          </div>

          <UButton
            v-if="publicVesselPath"
            :to="publicVesselPath"
            color="neutral"
            variant="soft"
            icon="i-lucide-share-2"
            class="w-full justify-center"
          >
            Public vessel page
          </UButton>

          <div class="grid grid-cols-2 gap-2">
            <UButton
              v-for="item in navigationItems"
              :key="item.label"
              :to="item.to"
              :icon="item.icon"
              :color="item.active ? 'primary' : 'neutral'"
              :variant="item.active ? 'soft' : 'outline'"
              class="justify-center"
            >
              {{ item.label }}
            </UButton>
          </div>
        </div>
      </section>

      <OperatorRouteMasthead
        v-else
        eyebrow="Vessel workspace"
        :title="detail.vessel.name"
        :description="vesselDescription"
      >
        <template #actions>
          <UButton
            v-if="publicVesselPath"
            :to="publicVesselPath"
            color="neutral"
            variant="soft"
            icon="i-lucide-share-2"
          >
            Public vessel page
          </UButton>
        </template>

        <template #meta>
          <div class="space-y-4">
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

              <UBadge color="primary" variant="soft">{{ postureLabel }}</UBadge>
              <UBadge v-for="badge in vesselMetaBadges" :key="badge" color="neutral" variant="soft">
                {{ badge }}
              </UBadge>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div
                v-for="card in vesselContextCards"
                :key="card.label"
                class="rounded-[1.15rem] border border-default/70 bg-elevated/70 px-4 py-3"
              >
                <p class="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                  {{ card.label }}
                </p>
                <p class="mt-2 font-display text-lg text-default">{{ card.value }}</p>
                <p class="mt-1 text-xs text-muted">{{ card.note }}</p>
              </div>
            </div>
          </div>
        </template>
      </OperatorRouteMasthead>

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
