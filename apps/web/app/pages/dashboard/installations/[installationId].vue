<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

const route = useRoute()
const installationId = computed(() => String(route.params.installationId || ''))

const { data, pending, refresh } = await useInstallationDetail(installationId.value)

const detail = computed(() => data.value)
const appFetch = useAppFetch()
const toast = useToast()
const actionPending = ref<'primary' | 'archive' | null>(null)

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
      <div data-testid="installation-hero">
        <UPageHero
          :title="detail.installation.label"
          :description="`Linked to ${detail.installation.vesselName}. Issue ingest keys and choose whether the collector should use the MyBoat relay or a direct Signal K websocket.`"
        >
          <template #links>
            <UButton
              :to="`/dashboard/vessels/${detail.installation.vesselSlug}`"
              color="neutral"
              variant="soft"
              icon="i-lucide-arrow-left"
            >
              Back to vessel
            </UButton>
          </template>
        </UPageHero>
      </div>

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
