<script setup lang="ts">
import type { PlaybackSelectionEvent } from '~/types/playbackViewer'

const props = withDefaults(
  defineProps<{
    endTime: number
    hasPlayback?: boolean
    hoveredLabel?: string | null
    isPlaying: boolean
    markers?: PlaybackSelectionEvent[]
    progressRatio: number
    selectedEventId?: string | null
    speedMultiplier: number
    speedOptions: number[]
    startTime: number
    statusText?: string | null
  }>(),
  {
    hasPlayback: false,
    hoveredLabel: null,
    markers: () => [],
    selectedEventId: null,
    statusText: null,
  },
)

const emit = defineEmits<{
  'select-event': [event: PlaybackSelectionEvent]
  'set-hovered-ratio': [ratio: number | null]
  'set-speed': [value: number]
  'seek-ratio': [value: number]
  'toggle-playback': []
}>()

const railRef = useTemplateRef<HTMLElement>('rail')
const sliderValue = computed(() => Math.round(props.progressRatio * 1000))
const durationMs = computed(() => Math.max(0, props.endTime - props.startTime))

const markerItems = computed(() =>
  props.markers
    .filter((marker) => marker.ms != null && durationMs.value > 0)
    .map((marker) => ({
      ...marker,
      ratio: ((marker.ms || props.startTime) - props.startTime) / durationMs.value,
    }))
    .filter((marker) => marker.ratio >= 0 && marker.ratio <= 1),
)

function markerTone(kind: PlaybackSelectionEvent['kind']) {
  if (kind === 'photo') {
    return 'bg-cyan-400'
  }

  if (kind === 'waypoint') {
    return 'bg-emerald-400'
  }

  if (kind === 'ais') {
    return 'bg-violet-400'
  }

  return 'bg-amber-300'
}

function updateHoverRatio(event: MouseEvent) {
  const element = railRef.value
  if (!element || durationMs.value <= 0) {
    emit('set-hovered-ratio', null)
    return
  }

  const bounds = element.getBoundingClientRect()
  const ratio = (event.clientX - bounds.left) / bounds.width
  emit('set-hovered-ratio', Math.min(1, Math.max(0, ratio)))
}

function handleSliderInput(value: string | number | undefined) {
  const nextValue = Number(value || 0)
  emit('seek-ratio', nextValue / 1000)
}
</script>

<template>
  <div
    class="pointer-events-auto space-y-4 rounded-[1.5rem] border border-default/70 bg-default/88 p-4 text-default shadow-card backdrop-blur-xl"
  >
    <template v-if="hasPlayback">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            color="primary"
            variant="solid"
            size="sm"
            :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
            class="rounded-full"
            @click="emit('toggle-playback')"
          >
            {{ isPlaying ? 'Pause' : 'Play' }}
          </UButton>

          <div class="inline-flex rounded-full border border-default/70 bg-default/60 p-1">
            <UButton
              v-for="speed in speedOptions"
              :key="speed"
              color="neutral"
              :variant="speedMultiplier === speed ? 'soft' : 'ghost'"
              size="xs"
              class="rounded-full"
              @click="emit('set-speed', speed)"
            >
              {{ speed }}x
            </UButton>
          </div>
        </div>

        <p class="text-xs uppercase tracking-[0.22em] text-muted">Timeline-driven playback</p>
      </div>

      <div
        ref="rail"
        class="relative"
        @mousemove="updateHoverRatio"
        @mouseleave="emit('set-hovered-ratio', null)"
      >
        <div v-if="hoveredLabel" class="mb-2 text-xs font-medium text-default">
          {{ hoveredLabel }}
        </div>

        <div class="relative">
          <div
            class="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-default/15"
          />

          <UButton
            v-for="marker in markerItems"
            :key="marker.id"
            color="neutral"
            variant="ghost"
            size="xs"
            class="absolute top-1/2 z-10 min-w-0 -translate-x-1/2 -translate-y-1/2 rounded-full px-1"
            :style="{ left: `${marker.ratio * 100}%` }"
            :aria-label="marker.title"
            @click="emit('select-event', marker)"
          >
            <span
              class="block h-4 w-1.5 rounded-full ring-2 transition-transform"
              :class="[
                markerTone(marker.kind),
                selectedEventId === marker.id
                  ? 'scale-y-125 ring-white'
                  : 'scale-y-100 ring-transparent',
              ]"
            />
          </UButton>

          <UInput
            class="passage-timeline-range relative z-20 w-full"
            type="range"
            min="0"
            max="1000"
            step="1"
            :model-value="sliderValue"
            @update:model-value="handleSliderInput"
          />
        </div>
      </div>
    </template>

    <div v-else class="space-y-2">
      <p class="text-xs uppercase tracking-[0.22em] text-muted">Playback timeline</p>
      <p class="text-sm text-default">
        {{
          statusText || 'Playback becomes available when this passage has a stored replay bundle.'
        }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.passage-timeline-range {
  -webkit-appearance: none;
  appearance: none;
  height: 2.75rem;
  background: transparent;
}

.passage-timeline-range::-webkit-slider-runnable-track {
  height: 0.325rem;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(14 165 233 / 0.9), rgb(56 189 248 / 0.25));
}

.passage-timeline-range::-moz-range-track {
  height: 0.325rem;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(14 165 233 / 0.9), rgb(56 189 248 / 0.25));
}

.passage-timeline-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -0.4rem;
  height: 1.1rem;
  width: 1.1rem;
  border: 2px solid rgb(15 23 42);
  border-radius: 999px;
  background: rgb(255 255 255);
  box-shadow: 0 0 0 0.4rem rgb(56 189 248 / 0.18);
}

.passage-timeline-range::-moz-range-thumb {
  height: 1.1rem;
  width: 1.1rem;
  border: 2px solid rgb(15 23 42);
  border-radius: 999px;
  background: rgb(255 255 255);
  box-shadow: 0 0 0 0.4rem rgb(56 189 248 / 0.18);
}
</style>
