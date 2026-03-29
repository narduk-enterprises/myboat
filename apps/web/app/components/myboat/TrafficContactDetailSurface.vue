<script setup lang="ts">
import type { AisContactSummary, PublicProfileSummary, VesselCardSummary } from '~/types/myboat'
import type { TrafficContactDetailSummary } from '~/types/traffic'
import { formatCoordinate, formatRelativeTime, formatTimestamp } from '~/utils/marine'
import { formatTrafficContactDimensions, formatTrafficMovement } from '~/utils/traffic'
import { formatDistanceNm, getAisCategory } from '~/components/myboat/maps/map-support'

const props = defineProps<{
  backLabel: string
  backTo: string
  contact: TrafficContactDetailSummary
  profile?: PublicProfileSummary | null
  vessel: VesselCardSummary
}>()

const trafficEnabled = ref(true)
const category = computed(() => getAisCategory(props.contact.shipType, props.contact.sog))
const contactSummary = computed<AisContactSummary[]>(() => [
  {
    id: props.contact.contactId,
    name: props.contact.name,
    mmsi: props.contact.mmsi,
    shipType: props.contact.shipType,
    lat: props.contact.lat,
    lng: props.contact.lng,
    cog: props.contact.cog,
    sog: props.contact.sog,
    heading: props.contact.heading,
    destination: props.contact.destination,
    callSign: props.contact.callSign,
    length: props.contact.length,
    beam: props.contact.beam,
    draft: props.contact.draft,
    navState: props.contact.navState,
    lastUpdateAt: props.contact.lastUpdateAt,
  },
])

const vesselPath = computed(() =>
  props.profile
    ? `/${props.profile.username}/${props.vessel.slug}`
    : `/dashboard/vessels/${props.vessel.slug}`,
)
const detailMetrics = computed(() => [
  {
    label: 'Observed',
    value: formatRelativeTime(new Date(props.contact.lastUpdateAt).toISOString()),
    hint: formatTimestamp(new Date(props.contact.lastUpdateAt).toISOString()),
  },
  {
    label: 'Range',
    value: formatDistanceNm(props.contact.distanceNm),
    hint: `Relative to ${props.vessel.name}`,
  },
  {
    label: 'Movement',
    value: formatTrafficMovement(props.contact),
    hint: props.contact.navState || 'Navigation state unavailable',
  },
  {
    label: 'Dimensions',
    value: formatTrafficContactDimensions(props.contact),
    hint: props.contact.mmsi ? `MMSI ${props.contact.mmsi}` : props.contact.contactId,
  },
])
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-[1.8rem] border border-default/80 bg-default/92 px-6 py-6 shadow-card">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="primary" variant="soft">{{ category.label }}</UBadge>
            <UBadge :color="contact.liveState === 'live' ? 'success' : 'warning'" variant="soft">
              {{ contact.liveState === 'live' ? 'Live contact' : 'Catalog fallback' }}
            </UBadge>
            <UBadge v-if="contact.mmsi" color="neutral" variant="soft">
              MMSI {{ contact.mmsi }}
            </UBadge>
          </div>

          <div>
            <h1 class="font-display text-4xl text-default sm:text-5xl">{{ contact.title }}</h1>
            <p class="mt-3 max-w-3xl text-sm text-muted sm:text-base">
              {{ category.label }} traffic contact near {{ vessel.name }} with live map context,
              movement, coordinates, and AIS identity details.
            </p>
          </div>

          <div class="flex flex-wrap gap-3 text-sm text-muted">
            <span class="rounded-full border border-default/60 px-4 py-2">
              {{ formatDistanceNm(contact.distanceNm) }}
            </span>
            <span class="rounded-full border border-default/60 px-4 py-2">
              {{ formatTrafficMovement(contact) }}
            </span>
            <span class="rounded-full border border-default/60 px-4 py-2">
              {{ formatTrafficContactDimensions(contact) }}
            </span>
          </div>
        </div>

        <div class="flex w-full flex-col gap-2 sm:w-auto">
          <UButton :to="backTo" color="neutral" variant="soft" icon="i-lucide-arrow-left">
            {{ backLabel }}
          </UButton>
          <UButton :to="vesselPath" color="primary" variant="soft" icon="i-lucide-radar">
            Open {{ vessel.name }}
          </UButton>
        </div>
      </div>
    </section>

    <UAlert
      v-if="contact.liveState !== 'live'"
      color="warning"
      variant="soft"
      title="Live contact has already rolled out of view"
      description="This detail page is showing the freshest catalog snapshot available for the selected boat because it is no longer present in the current live broker state."
    />

    <section class="grid gap-6 xl:grid-cols-[1.16fr_0.84fr]">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Relative map</h2>
            <p class="mt-1 text-sm text-muted">
              The contact renders against {{ vessel.name }} so you can keep range and motion in
              context.
            </p>
          </div>
        </template>

        <MyBoatCurrentLocationMap
          :vessel="vessel"
          :ais-contacts="contactSummary"
          :has-signal-k-source="true"
          v-model:traffic-enabled="trafficEnabled"
          height-class="h-[22rem] sm:h-[30rem] lg:h-[36rem]"
        />
      </UCard>

      <div class="space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">Fast read</h2>
              <p class="mt-1 text-sm text-muted">
                The shortest way to understand what this selected boat is doing.
              </p>
            </div>
          </template>

          <div class="grid gap-3">
            <div
              v-for="metric in detailMetrics"
              :key="metric.label"
              class="rounded-2xl border border-default bg-elevated/60 px-4 py-4"
            >
              <p class="text-xs uppercase tracking-wide text-muted">{{ metric.label }}</p>
              <p class="mt-2 font-medium text-default">{{ metric.value }}</p>
              <p class="mt-1 text-xs text-muted">{{ metric.hint }}</p>
            </div>
          </div>
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-2xl text-default">AIS identity</h2>
              <p class="mt-1 text-sm text-muted">
                Current public fields recovered from live traffic plus available catalog metadata.
              </p>
            </div>
          </template>

          <div class="grid gap-3 text-sm text-muted">
            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Coordinates</p>
              <p class="mt-2 font-medium text-default">
                {{ formatCoordinate(contact.lat, true) }}
              </p>
              <p class="mt-1 font-medium text-default">
                {{ formatCoordinate(contact.lng, false) }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Call sign / destination</p>
              <p class="mt-2 font-medium text-default">{{ contact.callSign || 'Unavailable' }}</p>
              <p class="mt-1 text-xs text-muted">
                {{ contact.destination || 'Destination unavailable' }}
              </p>
            </div>

            <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
              <p class="text-xs uppercase tracking-wide text-muted">Navigation state</p>
              <p class="mt-2 font-medium text-default">{{ contact.navState || 'Unavailable' }}</p>
              <p class="mt-1 text-xs text-muted">
                {{ formatTimestamp(new Date(contact.lastUpdateAt).toISOString()) }}
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
