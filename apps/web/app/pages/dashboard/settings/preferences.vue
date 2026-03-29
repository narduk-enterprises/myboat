<script setup lang="ts">
import type { MarinePreferences } from '~/composables/useMarinePreferences'
import { formatTimestamp } from '~/utils/marine'

definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Preferences',
  description: 'Local units and display preferences for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Preferences',
  description: 'Local units and display preferences for MyBoat.',
})

const { data } = await useDashboardOverview('myboat-settings-preferences')
const overview = computed(() => data.value)
const primarySnapshot = computed(
  () => overview.value?.vessels.find((vessel) => vessel.isPrimary)?.liveSnapshot || null,
)
const { preferences, updatePreferences } = useMarinePreferences()
const {
  convertDepth,
  convertSpeed,
  convertTemperature,
  depthUnitLabel,
  speedUnitLabel,
  temperatureUnitLabel,
} = useMarineUnits()

const unitCards = [
  {
    key: 'speed',
    label: 'Speed',
    options: [
      { value: 'kts', label: 'Knots' },
      { value: 'mph', label: 'MPH' },
      { value: 'kmh', label: 'km/h' },
    ],
  },
  {
    key: 'depth',
    label: 'Depth',
    options: [
      { value: 'ft', label: 'Feet' },
      { value: 'm', label: 'Meters' },
      { value: 'fathoms', label: 'Fathoms' },
    ],
  },
  {
    key: 'temperature',
    label: 'Temperature',
    options: [
      { value: 'f', label: 'Fahrenheit' },
      { value: 'c', label: 'Celsius' },
    ],
  },
] as const

const mapStyleOptions = [
  {
    description: 'Keep the current per-surface default look.',
    label: 'Surface default',
    value: null,
  },
  {
    description: 'Full chart labels and context.',
    label: 'Standard',
    value: 'standard',
  },
  {
    description: 'Cleaner chart with reduced background noise.',
    label: 'Muted',
    value: 'muted',
  },
  {
    description: 'Imagery-first chart style.',
    label: 'Satellite',
    value: 'satellite',
  },
  {
    description: 'Imagery with road and place overlays.',
    label: 'Hybrid',
    value: 'hybrid',
  },
] as const

function isSelected<K extends keyof MarinePreferences>(key: K, value: MarinePreferences[K]) {
  return preferences.value[key] === value
}

function setPreference<K extends keyof MarinePreferences>(key: K, value: MarinePreferences[K]) {
  updatePreferences({ [key]: value } as Partial<MarinePreferences>)
}
</script>

<template>
  <div class="space-y-8">
    <UPageHero
      title="Preferences"
      description="Set the local unit system and keep the dashboard readable on this device."
    >
      <template #links>
        <UButton to="/dashboard/settings" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to settings
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div class="space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Units</h2>
              <p class="mt-1 text-sm text-muted">
                These choices are saved locally in the browser and affect map and telemetry display.
              </p>
            </div>
          </template>

          <div class="space-y-5">
            <div v-for="group in unitCards" :key="group.key" class="space-y-3">
              <div>
                <p class="font-medium text-default">{{ group.label }}</p>
              </div>
              <div class="flex flex-wrap gap-3">
                <UButton
                  v-for="option in group.options"
                  :key="option.value"
                  :color="isSelected(group.key, option.value) ? 'primary' : 'neutral'"
                  :variant="isSelected(group.key, option.value) ? 'solid' : 'soft'"
                  :icon="isSelected(group.key, option.value) ? 'i-lucide-check' : null"
                  @click="setPreference(group.key, option.value)"
                >
                  {{ option.label }}
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Map behavior</h2>
              <p class="mt-1 text-sm text-muted">
                Choose the default chart style for maps that expose advanced tools. Temporary tools
                like measurement and range rings still reset between visits.
              </p>
            </div>
          </template>

          <div class="space-y-3">
            <div
              v-for="option in mapStyleOptions"
              :key="option.label"
              class="rounded-[1.25rem] border border-default/70 bg-elevated/60 p-4"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="font-medium text-default">{{ option.label }}</p>
                  <p class="mt-1 text-sm text-muted">{{ option.description }}</p>
                </div>

                <UButton
                  :color="isSelected('defaultMapStyle', option.value) ? 'primary' : 'neutral'"
                  :variant="isSelected('defaultMapStyle', option.value) ? 'solid' : 'soft'"
                  :icon="isSelected('defaultMapStyle', option.value) ? 'i-lucide-check' : null"
                  @click="setPreference('defaultMapStyle', option.value)"
                >
                  {{ isSelected('defaultMapStyle', option.value) ? 'Selected' : 'Use this' }}
                </UButton>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Live preview</h2>
            <p class="mt-1 text-sm text-muted">
              What the primary vessel snapshot looks like using your current preferences.
            </p>
          </div>
        </template>

        <div v-if="primarySnapshot" class="grid gap-4 md:grid-cols-3">
          <MarineMetricCard
            label="Speed"
            :value="convertSpeed(primarySnapshot.speedOverGround)?.toFixed(1) || '—'"
            :unit="speedUnitLabel"
            icon="i-lucide-gauge"
            :hint="formatTimestamp(primarySnapshot.observedAt)"
          />
          <MarineMetricCard
            label="Depth"
            :value="convertDepth(primarySnapshot.depthBelowTransducer)?.toFixed(1) || '—'"
            :unit="depthUnitLabel"
            icon="i-lucide-anchor"
            :hint="formatTimestamp(primarySnapshot.observedAt)"
          />
          <MarineMetricCard
            label="Water temperature"
            :value="convertTemperature(primarySnapshot.waterTemperatureKelvin)?.toFixed(1) || '—'"
            :unit="temperatureUnitLabel"
            icon="i-lucide-thermometer"
            :hint="formatTimestamp(primarySnapshot.observedAt)"
          />
        </div>

        <MarineEmptyState
          v-else
          icon="i-lucide-activity"
          title="No live snapshot yet"
          description="Preferences are ready, but the primary vessel has not reported live telemetry yet."
          compact
        />
      </UCard>
    </div>
  </div>
</template>
