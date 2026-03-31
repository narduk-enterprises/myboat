<script setup lang="ts">
interface LayerState {
  ais: boolean
  photos: boolean
  routes: boolean
  waypoints: boolean
}

interface LayerMeta {
  aisCount?: number
  canToggleAis?: boolean
  photoCount?: number
  waypointCount?: number
}

const props = withDefaults(
  defineProps<{
    layers: LayerState
    meta?: LayerMeta
  }>(),
  {
    meta: () => ({}),
  },
)

const emit = defineEmits<{
  'fit-route': []
  'reset-view': []
  'toggle-layer': [layer: keyof LayerState]
}>()

const layerItems = computed(() => [
  {
    key: 'routes' as const,
    icon: 'i-lucide-route',
    label: 'Track',
    active: props.layers.routes,
    disabled: false,
  },
  {
    key: 'waypoints' as const,
    icon: 'i-lucide-map-pinned',
    label: 'Waypoints',
    active: props.layers.waypoints,
    disabled: !props.meta.waypointCount,
  },
  {
    key: 'photos' as const,
    icon: 'i-lucide-camera',
    label: 'Photos',
    active: props.layers.photos,
    disabled: !props.meta.photoCount,
  },
  {
    key: 'ais' as const,
    icon: 'i-lucide-radar',
    label: 'AIS',
    active: props.layers.ais,
    disabled: props.meta.canToggleAis === false,
  },
])
</script>

<template>
  <div
    class="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-default/70 bg-default/88 p-2 shadow-card backdrop-blur-xl"
  >
    <UPopover :content="{ align: 'end', side: 'bottom', sideOffset: 10 }">
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-layers-3"
        class="rounded-full"
      >
        Layers
      </UButton>

      <template #content>
        <div class="w-64 space-y-3 p-4">
          <div>
            <p class="text-xs uppercase tracking-[0.22em] text-muted">Visible layers</p>
            <p class="mt-1 text-sm text-muted">Keep only the context you need on the chart.</p>
          </div>

          <div class="grid gap-2">
            <UButton
              v-for="item in layerItems"
              :key="item.key"
              color="neutral"
              :variant="item.active ? 'soft' : 'ghost'"
              size="sm"
              class="justify-between rounded-2xl"
              :disabled="item.disabled"
              @click="emit('toggle-layer', item.key)"
            >
              <span class="flex items-center gap-2">
                <UIcon :name="item.icon" class="size-4" />
                {{ item.label }}
              </span>
              <UIcon
                :name="item.active ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                class="size-4"
              />
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>

    <UButton
      color="neutral"
      variant="soft"
      size="sm"
      icon="i-lucide-scan-search"
      class="rounded-full"
      @click="emit('fit-route')"
    >
      Fit route
    </UButton>

    <UPopover :content="{ align: 'end', side: 'bottom', sideOffset: 10 }">
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-sliders-horizontal"
        class="rounded-full"
      >
        Settings
      </UButton>

      <template #content>
        <div class="w-56 space-y-3 p-4">
          <div>
            <p class="text-xs uppercase tracking-[0.22em] text-muted">Map settings</p>
            <p class="mt-1 text-sm text-muted">Quick view actions without leaving playback.</p>
          </div>

          <div class="grid gap-2">
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-rotate-ccw"
              class="justify-start rounded-2xl"
              @click="emit('reset-view')"
            >
              Reset view
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
