<script setup lang="ts">
import type { VesselSnapshotSummary } from '~/types/myboat'
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'

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

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) {
    return null
  }

  return value.toFixed(digits)
}

const metrics = computed(() => {
  if (!props.snapshot) {
    return []
  }

  return [
    {
      label: 'Observed',
      value: props.snapshot.observedAt ? formatRelativeTime(props.snapshot.observedAt) : null,
      unit: '',
      hint: formatTimestamp(props.snapshot.observedAt),
      icon: 'i-lucide-clock-3',
    },
    {
      label: 'Latitude',
      value: formatNumber(props.snapshot.positionLat, 5),
      unit: '°',
      hint: formatCoordinate(props.snapshot.positionLat, true),
      icon: 'i-lucide-map-pin',
    },
    {
      label: 'Longitude',
      value: formatNumber(props.snapshot.positionLng, 5),
      unit: '°',
      hint: formatCoordinate(props.snapshot.positionLng, false),
      icon: 'i-lucide-map',
    },
    {
      label: 'Speed over ground',
      value: convertSpeed(props.snapshot.speedOverGround),
      unit: speedUnitLabel.value,
      hint: 'SOG from the live feed.',
      icon: 'i-lucide-gauge',
    },
    {
      label: 'Speed through water',
      value: convertSpeed(props.snapshot.speedThroughWater),
      unit: speedUnitLabel.value,
      hint: 'STW from the freshest snapshot.',
      icon: 'i-lucide-ship-wheel',
    },
    {
      label: 'Heading magnetic',
      value: convertAngle(props.snapshot.headingMagnetic),
      unit: '°',
      hint: 'Magnetic course from onboard instruments.',
      icon: 'i-lucide-compass',
    },
    {
      label: 'Apparent wind',
      value: convertSpeed(props.snapshot.windSpeedApparent),
      unit: speedUnitLabel.value,
      hint: 'Apparent wind speed.',
      icon: 'i-lucide-wind',
    },
    {
      label: 'Wind angle',
      value: convertAngle(props.snapshot.windAngleApparent),
      unit: '°',
      hint: 'Apparent wind angle.',
      icon: 'i-lucide-compass',
    },
    {
      label: 'Depth below transducer',
      value: convertDepth(props.snapshot.depthBelowTransducer),
      unit: depthUnitLabel.value,
      hint: 'Current sounding.',
      icon: 'i-lucide-waves',
    },
    {
      label: 'Water temperature',
      value: convertTemperature(props.snapshot.waterTemperatureKelvin),
      unit: temperatureUnitLabel.value,
      hint: 'Sea water temperature.',
      icon: 'i-lucide-thermometer',
    },
    {
      label: 'Battery voltage',
      value: props.snapshot.batteryVoltage,
      unit: 'V',
      hint: 'House or starter battery feed.',
      icon: 'i-lucide-battery-medium',
    },
    {
      label: 'Engine RPM',
      value: props.snapshot.engineRpm,
      unit: 'rpm',
      hint: 'Engine revolutions per minute.',
      icon: 'i-lucide-gauge-circle',
    },
    {
      label: 'Telemetry source',
      value: props.snapshot.source || null,
      unit: '',
      hint: props.snapshot.updatedAt ? `Updated ${formatTimestamp(props.snapshot.updatedAt)}` : '',
      icon: 'i-lucide-radio-tower',
    },
  ]
    .filter((metric) => metric.value !== null)
    .map((metric) => ({
      ...metric,
      value:
        typeof metric.value === 'number'
          ? metric.value.toFixed(
              metric.label === 'Latitude' || metric.label === 'Longitude'
                ? 5
                : metric.unit === '°' || metric.unit === 'rpm'
                  ? 0
                  : 1,
            )
          : '--',
    }))
})
</script>

<template>
  <div>
    <div v-if="metrics.length" class="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <MarineMetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :unit="metric.unit"
        :hint="metric.hint"
        :icon="metric.icon"
      />
    </div>

    <UAlert
      v-if="snapshot?.statusNote"
      class="mt-4 rounded-[1.5rem]"
      color="primary"
      variant="soft"
      icon="i-lucide-message-square-text"
      :description="snapshot.statusNote"
    />

    <MarineEmptyState
      v-else
      icon="i-lucide-radio"
      title="No live vessel snapshot yet"
      description="Connect a device install and start sending telemetry to unlock live metrics, map position, and passage context."
      compact
    />
  </div>
</template>
