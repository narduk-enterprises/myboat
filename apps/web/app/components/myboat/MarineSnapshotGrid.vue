<script setup lang="ts">
import type { VesselSnapshotSummary } from '~/types/myboat'

const props = defineProps<{
  snapshot: VesselSnapshotSummary | null
}>()

const {
  convertAngle,
  convertDepth,
  convertSpeed,
  convertTemperature,
  depthUnitLabel,
  speedUnitLabel,
  temperatureUnitLabel,
} = useMarineUnits()

const metrics = computed(() => {
  if (!props.snapshot) {
    return []
  }

  return [
    {
      label: 'Speed over ground',
      value: convertSpeed(props.snapshot.speedOverGround),
      unit: speedUnitLabel.value,
      icon: 'i-lucide-gauge',
    },
    {
      label: 'Apparent wind',
      value: convertSpeed(props.snapshot.windSpeedApparent),
      unit: speedUnitLabel.value,
      icon: 'i-lucide-wind',
    },
    {
      label: 'Wind angle',
      value: convertAngle(props.snapshot.windAngleApparent),
      unit: '°',
      icon: 'i-lucide-compass',
    },
    {
      label: 'Depth below transducer',
      value: convertDepth(props.snapshot.depthBelowTransducer),
      unit: depthUnitLabel.value,
      icon: 'i-lucide-waves',
    },
    {
      label: 'Water temperature',
      value: convertTemperature(props.snapshot.waterTemperatureKelvin),
      unit: temperatureUnitLabel.value,
      icon: 'i-lucide-thermometer',
    },
    {
      label: 'Battery voltage',
      value: props.snapshot.batteryVoltage,
      unit: 'V',
      icon: 'i-lucide-battery-medium',
    },
  ]
    .filter((metric) => metric.value !== null)
    .map((metric) => ({
      ...metric,
      value:
        typeof metric.value === 'number' ? metric.value.toFixed(metric.unit === '°' ? 0 : 1) : '--',
    }))
})
</script>

<template>
  <div>
    <div v-if="metrics.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <MarineMetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :unit="metric.unit"
        :icon="metric.icon"
      />
    </div>

    <AppEmptyState
      v-else
      icon="i-lucide-radio"
      title="No live vessel snapshot yet"
      description="Connect a device install and start sending telemetry to unlock live metrics, map position, and passage context."
      compact
    />
  </div>
</template>
