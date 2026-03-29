<script setup lang="ts">
import {
  mapStyleLabel,
  type MyBoatMapMeasureResult,
  type MyBoatMapStyle,
  type MyBoatMapToolCapabilities,
} from './advanced-tools'

const props = withDefaults(
  defineProps<{
    capabilities: MyBoatMapToolCapabilities
    canResetView?: boolean
    canShowHeadingLine?: boolean
    canShowRangeRings?: boolean
    hasActiveIndicator?: boolean
    mapStyle: MyBoatMapStyle
    measureMode?: boolean
    measureResult?: MyBoatMapMeasureResult | null
    showHeadingLine?: boolean
    showLabel?: boolean
    showRangeRings?: boolean
    size?: 'xs' | 'sm'
  }>(),
  {
    canResetView: false,
    canShowHeadingLine: false,
    canShowRangeRings: false,
    hasActiveIndicator: false,
    measureMode: false,
    measureResult: null,
    showHeadingLine: false,
    showLabel: false,
    showRangeRings: false,
    size: 'sm',
  },
)

const emit = defineEmits<{
  'reset-view': []
  'set-map-style': [style: MyBoatMapStyle]
  'toggle-heading-line': []
  'toggle-measure': []
  'toggle-range-rings': []
}>()

const isCompactViewport = useCompactViewport()
const isOpen = shallowRef(false)

const buttonLabel = computed(() => (props.showLabel ? 'Tools' : ''))
const mapStyleText = computed(() => mapStyleLabel(props.mapStyle))
const mapStyleOptions: MyBoatMapStyle[] = ['standard', 'muted', 'satellite', 'hybrid']
</script>

<template>
  <div class="space-y-2">
    <ClientOnly>
      <UPopover
        v-if="!isCompactViewport"
        v-model:open="isOpen"
        :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
      >
        <UChip :show="hasActiveIndicator" inset color="primary" size="md">
          <UButton
            data-testid="map-tools-trigger"
            color="neutral"
            variant="soft"
            :size="size"
            icon="i-lucide-sliders-horizontal"
            :label="buttonLabel"
            aria-label="Map tools"
          />
        </UChip>

        <template #content>
          <div data-testid="map-tools-panel" class="w-72 space-y-4 p-4">
            <div>
              <p class="text-[11px] uppercase tracking-[0.22em] text-muted">Map tools</p>
              <p class="mt-2 text-sm text-muted">
                Viewer-safe controls stay here so the chart itself keeps priority.
              </p>
            </div>

            <div v-if="capabilities.basemap" class="space-y-2">
              <div>
                <p class="text-sm font-medium text-default">Chart style</p>
                <p class="text-xs text-muted">{{ mapStyleText }}</p>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <UButton
                  v-for="style in mapStyleOptions"
                  :key="style"
                  color="neutral"
                  :variant="mapStyle === style ? 'solid' : 'soft'"
                  size="xs"
                  class="w-full justify-center"
                  @click="emit('set-map-style', style)"
                >
                  {{ mapStyleLabel(style) }}
                </UButton>
              </div>
            </div>

            <div class="space-y-2">
              <UButton
                v-if="capabilities.measure"
                color="neutral"
                :variant="measureMode ? 'solid' : 'soft'"
                size="sm"
                class="w-full justify-start"
                icon="i-lucide-ruler"
                @click="emit('toggle-measure')"
              >
                {{ measureMode ? 'Clear measurement' : 'Measure distance' }}
              </UButton>

              <UButton
                v-if="capabilities.rangeRings"
                color="neutral"
                :variant="showRangeRings ? 'solid' : 'soft'"
                size="sm"
                class="w-full justify-start"
                icon="i-lucide-circle-dashed"
                :disabled="!canShowRangeRings"
                @click="emit('toggle-range-rings')"
              >
                Range rings
              </UButton>

              <UButton
                v-if="capabilities.headingLine"
                color="neutral"
                :variant="showHeadingLine ? 'solid' : 'soft'"
                size="sm"
                class="w-full justify-start"
                icon="i-lucide-navigation"
                :disabled="!canShowHeadingLine"
                @click="emit('toggle-heading-line')"
              >
                Heading aid
              </UButton>

              <UButton
                v-if="canResetView"
                color="neutral"
                variant="soft"
                size="sm"
                class="w-full justify-start"
                icon="i-lucide-rotate-ccw"
                @click="emit('reset-view')"
              >
                Reset view
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>

      <template v-else>
        <UChip :show="hasActiveIndicator" inset color="primary" size="md">
          <UButton
            data-testid="map-tools-trigger"
            color="neutral"
            variant="soft"
            :size="size"
            icon="i-lucide-sliders-horizontal"
            :label="showLabel ? 'Tools' : 'Map tools'"
            aria-label="Map tools"
            @click="isOpen = true"
          />
        </UChip>

        <UDrawer v-model:open="isOpen" direction="bottom" inset>
          <template #header>
            <div>
              <p class="text-[11px] uppercase tracking-[0.22em] text-muted">Map tools</p>
              <p class="mt-2 text-sm text-muted">
                Viewer-safe controls stay grouped so the map remains readable.
              </p>
            </div>
          </template>

          <template #body>
            <div data-testid="map-tools-panel" class="space-y-4">
              <div
                v-if="capabilities.basemap"
                class="rounded-[1.25rem] border border-default/70 p-4"
              >
                <div>
                  <p class="text-sm font-medium text-default">Chart style</p>
                  <p class="text-xs text-muted">{{ mapStyleText }}</p>
                </div>

                <div class="mt-3 grid grid-cols-2 gap-2">
                  <UButton
                    v-for="style in mapStyleOptions"
                    :key="style"
                    color="neutral"
                    :variant="mapStyle === style ? 'solid' : 'soft'"
                    size="xs"
                    class="w-full justify-center"
                    @click="emit('set-map-style', style)"
                  >
                    {{ mapStyleLabel(style) }}
                  </UButton>
                </div>
              </div>

              <div class="space-y-2">
                <UButton
                  v-if="capabilities.measure"
                  color="neutral"
                  :variant="measureMode ? 'solid' : 'soft'"
                  size="sm"
                  class="w-full justify-start"
                  icon="i-lucide-ruler"
                  @click="emit('toggle-measure')"
                >
                  {{ measureMode ? 'Clear measurement' : 'Measure distance' }}
                </UButton>

                <UButton
                  v-if="capabilities.rangeRings"
                  color="neutral"
                  :variant="showRangeRings ? 'solid' : 'soft'"
                  size="sm"
                  class="w-full justify-start"
                  icon="i-lucide-circle-dashed"
                  :disabled="!canShowRangeRings"
                  @click="emit('toggle-range-rings')"
                >
                  Range rings
                </UButton>

                <UButton
                  v-if="capabilities.headingLine"
                  color="neutral"
                  :variant="showHeadingLine ? 'solid' : 'soft'"
                  size="sm"
                  class="w-full justify-start"
                  icon="i-lucide-navigation"
                  :disabled="!canShowHeadingLine"
                  @click="emit('toggle-heading-line')"
                >
                  Heading aid
                </UButton>

                <UButton
                  v-if="canResetView"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  class="w-full justify-start"
                  icon="i-lucide-rotate-ccw"
                  @click="emit('reset-view')"
                >
                  Reset view
                </UButton>
              </div>
            </div>
          </template>
        </UDrawer>
      </template>
    </ClientOnly>

    <div
      v-if="measureResult"
      class="rounded-[1.15rem] border border-default/70 bg-default/90 px-3 py-2 shadow-card backdrop-blur-xl"
    >
      <div class="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted">
        <span>Measure</span>
        <span>{{ measureResult.distNm.toFixed(2) }} NM</span>
        <span>{{ measureResult.bearing.toFixed(0) }}° {{ measureResult.cardinal }}</span>
      </div>
    </div>
  </div>
</template>
