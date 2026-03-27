<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Preferences · Settings',
  description: 'Set marine unit preferences for speed, depth, and temperature readings.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Marine preferences settings',
  description: 'Set marine unit preferences for speed, depth, and temperature readings.',
})

const { preferences, updatePreferences } = useMarinePreferences()

const speedOptions = [
  { value: 'kts', label: 'Knots (kts)', hint: 'Standard nautical unit' },
  { value: 'mph', label: 'Miles per hour (mph)', hint: 'US customary' },
  { value: 'kmh', label: 'Kilometres per hour (km/h)', hint: 'Metric' },
]

const depthOptions = [
  { value: 'ft', label: 'Feet (ft)', hint: 'Standard US charting unit' },
  { value: 'm', label: 'Metres (m)', hint: 'Metric / international charts' },
  { value: 'fathoms', label: 'Fathoms', hint: 'Traditional deep-water unit' },
]

const temperatureOptions = [
  { value: 'f', label: 'Fahrenheit (°F)', hint: 'US convention' },
  { value: 'c', label: 'Celsius (°C)', hint: 'Metric' },
]
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
      title="Preferences"
      description="Choose the marine units used across all live telemetry, passages, and vessel detail views."
    />

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div class="space-y-6">
        <UCard class="chart-surface rounded-[1.75rem]">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default">Speed unit</h2>
              <p class="mt-1 text-sm text-muted">
                Applied to speed over ground and speed through water readings.
              </p>
            </div>
          </template>

          <div class="space-y-2">
            <label
              v-for="option in speedOptions"
              :key="option.value"
              :class="[
                'flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition',
                preferences.speed === option.value
                  ? 'border-primary/40 bg-primary/8'
                  : 'border-default bg-elevated/60 hover:border-primary/20',
              ]"
            >
              <div>
                <p class="font-medium text-default">{{ option.label }}</p>
                <p class="text-xs text-muted">{{ option.hint }}</p>
              </div>
              <input
                type="radio"
                name="speed"
                :value="option.value"
                :checked="preferences.speed === option.value"
                class="accent-primary"
                @change="updatePreferences({ speed: option.value as 'kts' | 'mph' | 'kmh' })"
              />
            </label>
          </div>
        </UCard>

        <UCard class="chart-surface rounded-[1.75rem]">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default">Depth unit</h2>
              <p class="mt-1 text-sm text-muted">
                Applied to depth below transducer and bottom clearance values.
              </p>
            </div>
          </template>

          <div class="space-y-2">
            <label
              v-for="option in depthOptions"
              :key="option.value"
              :class="[
                'flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition',
                preferences.depth === option.value
                  ? 'border-primary/40 bg-primary/8'
                  : 'border-default bg-elevated/60 hover:border-primary/20',
              ]"
            >
              <div>
                <p class="font-medium text-default">{{ option.label }}</p>
                <p class="text-xs text-muted">{{ option.hint }}</p>
              </div>
              <input
                type="radio"
                name="depth"
                :value="option.value"
                :checked="preferences.depth === option.value"
                class="accent-primary"
                @change="updatePreferences({ depth: option.value as 'ft' | 'm' | 'fathoms' })"
              />
            </label>
          </div>
        </UCard>

        <UCard class="chart-surface rounded-[1.75rem]">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default">Temperature unit</h2>
              <p class="mt-1 text-sm text-muted">
                Applied to water temperature readings from the vessel snapshot.
              </p>
            </div>
          </template>

          <div class="space-y-2">
            <label
              v-for="option in temperatureOptions"
              :key="option.value"
              :class="[
                'flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition',
                preferences.temperature === option.value
                  ? 'border-primary/40 bg-primary/8'
                  : 'border-default bg-elevated/60 hover:border-primary/20',
              ]"
            >
              <div>
                <p class="font-medium text-default">{{ option.label }}</p>
                <p class="text-xs text-muted">{{ option.hint }}</p>
              </div>
              <input
                type="radio"
                name="temperature"
                :value="option.value"
                :checked="preferences.temperature === option.value"
                class="accent-primary"
                @change="updatePreferences({ temperature: option.value as 'f' | 'c' })"
              />
            </label>
          </div>
        </UCard>
      </div>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-xl text-default">About these settings</h2>
          </div>
        </template>

        <div class="space-y-4 text-sm text-muted">
          <p>Preferences are stored locally in your browser. They apply instantly across all telemetry panels, vessel snapshots, and passage summaries.</p>
          <p>Readings from the SignalK ingest pipeline are stored in SI units internally. The display conversion happens client-side, so changing preferences here does not affect the raw data.</p>
          <div class="mt-4 rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-[0.2em] text-muted">Current selections</p>
            <div class="mt-3 space-y-1 font-medium text-default">
              <p>Speed: {{ preferences.speed }}</p>
              <p>Depth: {{ preferences.depth }}</p>
              <p>Temperature: {{ preferences.temperature === 'f' ? '°F' : '°C' }}</p>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
