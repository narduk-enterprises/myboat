<script setup lang="ts">
import { formatRelativeTime, getConnectionTone } from '~/utils/marine'

definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

const route = useRoute()
const installationId = computed(() => String(route.params.installationId || ''))

const { data, pending, refresh } = await useInstallationDetail(installationId.value)

const detail = computed(() => data.value)
const installation = computed(() => detail.value?.installation || null)
const appFetch = useAppFetch()
const toast = useToast()
const actionPending = ref<'primary' | 'archive' | null>(null)

const signalKModeLabel = computed(() => {
  switch (installation.value?.signalKAccessMode) {
    case 'relay':
      return 'MyBoat relay'
    case 'direct':
      return 'Direct Signal K'
    default:
      return 'Signal K pending'
  }
})

const lastSeenLabel = computed(() => {
  if (!installation.value?.lastSeenAt) {
    return 'No telemetry observed yet'
  }

  return `Last seen ${formatRelativeTime(installation.value.lastSeenAt)}`
})

useSeo({
  title: detail.value?.installation.label || 'Installation',
  description: 'Installation detail and ingest-key management for a vessel device.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Installation detail',
  description: 'Installation detail and ingest-key management for a vessel device.',
})

async function makePrimary() {
  if (!detail.value || detail.value.installation.isPrimary) {
    return
  }

  actionPending.value = 'primary'

  try {
    await appFetch(`/api/app/installations/${detail.value.installation.id}/primary`, {
      method: 'POST',
    })
    await refresh()
    toast.add({
      title: 'Primary live source updated',
      description: 'This installation now drives the canonical vessel live state.',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'Unable to update primary source',
      description: error instanceof Error ? error.message : 'Try again in a moment.',
      color: 'error',
    })
  } finally {
    actionPending.value = null
  }
}

async function archiveInstallation() {
  if (!detail.value) {
    return
  }

  actionPending.value = 'archive'

  try {
    await appFetch(`/api/app/installations/${detail.value.installation.id}/archive`, {
      method: 'POST',
    })
    toast.add({
      title: 'Installation archived',
      description: 'The installation has been removed from the active vessel control surface.',
      color: 'success',
    })
    await navigateTo(`/dashboard/vessels/${detail.value.installation.vesselSlug}`)
  } catch (error) {
    toast.add({
      title: 'Unable to archive installation',
      description: error instanceof Error ? error.message : 'Try again in a moment.',
      color: 'error',
    })
  } finally {
    actionPending.value = null
  }
}
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-44 rounded-[2rem]" />
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="item in 4" :key="item" class="h-32 rounded-[1.5rem]" />
      </div>
      <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <USkeleton class="h-[34rem] rounded-[1.75rem]" />
        <USkeleton class="h-[34rem] rounded-[1.75rem]" />
      </div>
    </template>

    <template v-else-if="detail">
      <section
        data-testid="installation-hero"
        class="chart-surface-strong rounded-[2rem] px-6 py-8 sm:px-8"
      >
        <div class="relative z-10 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div class="space-y-6">
            <div class="marine-kicker w-fit">Install control plane</div>

            <div>
              <h1 class="font-display text-4xl tracking-tight text-default sm:text-5xl">
                {{ detail.installation.label }}
              </h1>
              <p class="mt-3 max-w-2xl text-base text-muted sm:text-lg">
                Linked to {{ detail.installation.vesselName }}. Issue ingest keys, choose the Signal
                K path, and verify whether this collector is actively feeding the vessel surfaces.
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <UBadge
                :color="
                  getConnectionTone(
                    detail.installation.connectionState,
                    detail.installation.lastSeenAt,
                  )
                "
                variant="soft"
              >
                {{ detail.installation.connectionState }}
              </UBadge>
              <UBadge color="neutral" variant="soft">{{ signalKModeLabel }}</UBadge>
              <UBadge color="primary" variant="soft">{{ detail.installation.vesselName }}</UBadge>
            </div>

            <div class="flex flex-wrap gap-3">
              <UButton
                :to="`/dashboard/vessels/${detail.installation.vesselSlug}`"
                color="neutral"
                variant="soft"
                icon="i-lucide-arrow-left"
              >
                Back to vessel
              </UButton>
            </div>

            <div
              class="rounded-[1.75rem] border border-white/70 bg-white/86 px-5 py-5 shadow-card backdrop-blur"
            >
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Collector briefing</p>
              <p class="mt-2 font-display text-2xl text-default">
                {{
                  detail.installation.edgeHostname ||
                  detail.installation.collectorSignalKUrl ||
                  detail.installation.signalKUrl ||
                  'Hostname still pending'
                }}
              </p>
              <p class="mt-2 text-sm text-muted">{{ lastSeenLabel }}</p>

              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.22em] text-muted">Signal K target</p>
                  <p class="mt-2 font-medium text-default">
                    {{ detail.installation.collectorSignalKUrl || 'Pending configuration' }}
                  </p>
                </div>

                <div class="rounded-2xl border border-default bg-elevated/70 px-4 py-3">
                  <p class="text-xs uppercase tracking-[0.22em] text-muted">Usage posture</p>
                  <p class="mt-2 font-medium text-default">
                    {{ detail.installation.eventCount }} events observed
                  </p>
                  <p class="mt-1 text-xs text-muted">{{ detail.keys.length }} keys tracked</p>
                </div>
              </div>
            </div>
          </div>

          <div class="grid self-start gap-3 sm:grid-cols-2">
            <div class="metric-shell rounded-[1.5rem] p-4 shadow-card">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Connection state</p>
              <p class="mt-2 font-display text-2xl text-default">
                {{ detail.installation.connectionState }}
              </p>
              <p class="mt-2 text-xs text-muted">{{ lastSeenLabel }}</p>
            </div>

            <div class="metric-shell rounded-[1.5rem] p-4 shadow-card">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Collector mode</p>
              <p class="mt-2 font-display text-2xl text-default">{{ signalKModeLabel }}</p>
              <p class="mt-2 text-xs text-muted">
                {{ detail.installation.collectorSignalKUrl || 'Awaiting websocket target' }}
              </p>
            </div>

            <div class="metric-shell rounded-[1.5rem] p-4 shadow-card">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Edge hostname</p>
              <p class="mt-2 font-display text-2xl text-default">
                {{ detail.installation.edgeHostname || 'Pending' }}
              </p>
              <p class="mt-2 text-xs text-muted">
                {{ detail.installation.signalKUrl || 'Upstream Signal K route not set yet' }}
              </p>
            </div>

            <div class="metric-shell rounded-[1.5rem] p-4 shadow-card">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Issued keys</p>
              <p class="mt-2 font-display text-2xl text-default">{{ detail.keys.length }}</p>
              <p class="mt-2 text-xs text-muted">
                API credentials currently tracked for this collector.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MarineMetricCard
          label="Installation type"
          :value="detail.installation.installationType"
          icon="i-lucide-cpu"
        />
        <MarineMetricCard
          label="Primary live source"
          :value="detail.installation.isPrimary ? 'Yes' : 'No'"
          icon="i-lucide-radio"
        />
        <MarineMetricCard
          label="Connection state"
          :value="detail.installation.connectionState"
          icon="i-lucide-activity"
        />
        <MarineMetricCard
          label="Events received"
          :value="String(detail.installation.eventCount)"
          icon="i-lucide-waypoints"
        />
      </section>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="font-display text-2xl text-default">Install control plane</h2>
              <p class="mt-1 text-sm text-muted">
                Choose the canonical live source and retire installations without losing vessel
                history.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-badge-check"
                :disabled="detail.installation.isPrimary"
                :loading="actionPending === 'primary'"
                @click="makePrimary"
              >
                {{ detail.installation.isPrimary ? 'Primary source' : 'Make primary source' }}
              </UButton>
              <UButton
                color="error"
                variant="soft"
                icon="i-lucide-archive"
                :loading="actionPending === 'archive'"
                @click="archiveInstallation"
              >
                Archive installation
              </UButton>
            </div>
          </div>
        </template>

        <div class="grid gap-4 lg:grid-cols-3">
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Connection target</p>
            <p class="mt-2 text-sm font-medium text-default">
              {{
                detail.installation.edgeHostname ||
                detail.installation.collectorSignalKUrl ||
                detail.installation.signalKUrl ||
                'No hostname or SignalK endpoint recorded yet'
              }}
            </p>
          </div>
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Primary state</p>
            <p class="mt-2 text-sm font-medium text-default">
              {{
                detail.installation.isPrimary
                  ? 'This installation defines the vessel live snapshot.'
                  : 'This installation can stay active without driving the primary live state.'
              }}
            </p>
          </div>
          <div class="rounded-2xl border border-default bg-elevated/60 px-4 py-4">
            <p class="text-xs uppercase tracking-wide text-muted">Archive behavior</p>
            <p class="mt-2 text-sm font-medium text-default">
              Archiving removes this install from active routing and promotes another install if
              needed.
            </p>
          </div>
        </div>
      </UCard>

      <InstallationCredentialPanel
        :installation="detail.installation"
        :initial-keys="detail.keys"
      />
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Installation unavailable"
      description="We could not load this install right now."
    />
  </div>
</template>
