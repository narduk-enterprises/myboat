<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    subtitle: string
    passageCount: number
    photoCount: number
    playbackReady?: boolean
    summary?: string | null
  }>(),
  {
    playbackReady: false,
    summary: null,
  },
)

const emit = defineEmits<{
  focus: []
  fullscreen: []
  share: []
}>()

const badges = computed(() =>
  [
    props.playbackReady
      ? {
          color: 'primary' as const,
          label: 'playback-ready',
        }
      : null,
    {
      color: 'neutral' as const,
      label: `${props.passageCount} passage${props.passageCount === 1 ? '' : 's'}`,
    },
    {
      color: 'neutral' as const,
      label: `${props.photoCount} photo${props.photoCount === 1 ? '' : 's'}`,
    },
  ].filter((badge): badge is { color: 'neutral' | 'primary'; label: string } => Boolean(badge)),
)
</script>

<template>
  <div
    class="flex flex-col gap-4 border-b border-default/70 pb-4 lg:flex-row lg:items-start lg:justify-between"
  >
    <div class="min-w-0 space-y-3">
      <div class="flex items-start gap-2">
        <div class="min-w-0">
          <h2 class="truncate font-display text-3xl text-default">{{ title }}</h2>
          <p class="mt-1 truncate text-sm text-muted">{{ subtitle }}</p>
        </div>

        <UPopover v-if="summary" :content="{ align: 'start', side: 'bottom', sideOffset: 8 }">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-info"
            aria-label="Passage summary"
          />

          <template #content>
            <div class="max-w-sm p-4">
              <p class="text-xs uppercase tracking-[0.22em] text-muted">Passage summary</p>
              <p class="mt-2 text-sm leading-6 text-default">{{ summary }}</p>
            </div>
          </template>
        </UPopover>
      </div>

      <div class="flex flex-wrap gap-2">
        <UBadge
          v-for="badge in badges"
          :key="badge.label"
          :color="badge.color"
          variant="soft"
          size="lg"
          class="rounded-full"
        >
          {{ badge.label }}
        </UBadge>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton color="neutral" variant="soft" icon="i-lucide-scan-search" @click="emit('focus')">
        Focus
      </UButton>
      <UButton color="neutral" variant="soft" icon="i-lucide-maximize" @click="emit('fullscreen')">
        Fullscreen
      </UButton>
      <UButton color="neutral" variant="soft" icon="i-lucide-share-2" @click="emit('share')">
        Share
      </UButton>
    </div>
  </div>
</template>
