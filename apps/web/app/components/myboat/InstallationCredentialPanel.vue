<script setup lang="ts">
import type { InstallationKeySummary, InstallationSummary } from '~/types/myboat'
import { formatTimestamp, getConnectionTone } from '~/utils/marine'

const props = defineProps<{
  installation: InstallationSummary
  initialKeys: InstallationKeySummary[]
}>()

const routeUrl = useRequestURL()
const toast = useToast()
const { createInstallationKey, pending: loading } = useCreateInstallationKey(props.installation.id)
const keys = ref<InstallationKeySummary[]>(props.initialKeys)
const pendingKey = shallowRef<string | null>(null)
const baseUrl = computed(() => useRuntimeConfig().public.appUrl || routeUrl.origin)
const localBoatHostname = computed(
  () => useRuntimeConfig().public.localBoatHostname || 'myboat.local',
)

function buildCollectorCommand() {
  return `docker run -d -e SIGNALK_WS_URL=ws://your-signalk:3000/signalk/v1/stream -e MYBOAT_INGEST_URL=${baseUrl.value}/api/ingest/v1/delta -e MYBOAT_INGEST_KEY=<YOUR_API_KEY> <collector-image>`
}

const setupCommand = computed(() => buildCollectorCommand())

async function createKey() {
  try {
    const response = await createInstallationKey()
    pendingKey.value = response.rawKey || null
    keys.value = [{ ...response, rawKey: undefined }, ...keys.value]
    toast.add({
      title: 'Installation key created',
      description: 'Copy the new key now. It will only be shown once.',
      color: 'success',
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create an installation key right now.'
    toast.add({
      title: 'Key creation failed',
      description: message,
      color: 'error',
    })
  }
}

async function copyValue(value: string, message: string) {
  await navigator.clipboard.writeText(value)
  toast.add({
    title: message,
    color: 'success',
  })
}
</script>

<template>
  <UCard
    data-testid="installation-credential-panel"
    class="border-default/80 bg-default/90 shadow-card"
  >
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h3 class="font-display text-xl text-default">{{ installation.label }}</h3>
            <UBadge
              :color="getConnectionTone(installation.connectionState, installation.lastSeenAt)"
            >
              {{ installation.connectionState }}
            </UBadge>
          </div>
          <p class="mt-1 text-sm text-muted">
            {{ installation.edgeHostname || localBoatHostname || 'Connection target pending' }}
          </p>
        </div>

        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-key-round"
          :loading="loading"
          @click="createKey"
        >
          Generate ingest key
        </UButton>
      </div>
    </template>

    <div class="space-y-5">
      <div class="rounded-2xl border border-default bg-elevated/60 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-default">Collector input</p>
            <p class="mt-1 text-xs text-muted">
              Point `SIGNALK_WS_URL` at the onboard feed. MyBoat only receives normalized deltas.
            </p>
          </div>
          <UBadge color="primary" variant="soft"> MyBoat ingest </UBadge>
        </div>

        <p class="mt-4 break-all rounded-xl bg-default px-3 py-2 font-mono text-sm text-default">
          ws://your-signalk:3000/signalk/v1/stream
        </p>
      </div>

      <div v-if="pendingKey" class="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p class="text-sm font-medium text-default">New raw key</p>
        <p class="mt-2 break-all rounded-xl bg-default px-3 py-2 font-mono text-sm text-default">
          {{ pendingKey }}
        </p>
        <div class="mt-3 flex flex-wrap gap-3">
          <UButton color="primary" size="sm" @click="copyValue(pendingKey, 'Raw key copied')">
            Copy key
          </UButton>
          <UButton color="neutral" variant="soft" size="sm" @click="pendingKey = null">
            Hide raw key
          </UButton>
        </div>
      </div>

      <div class="rounded-2xl border border-default bg-elevated/60 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-default">Collector launch command</p>
            <p class="mt-1 text-xs text-muted">
              Replace the placeholder key with the raw key shown above.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-copy"
            @click="copyValue(setupCommand, 'Collector command copied')"
          >
            Copy command
          </UButton>
        </div>

        <pre class="mt-4 overflow-x-auto rounded-xl bg-inverted px-4 py-3 text-xs text-inverted">{{
          setupCommand
        }}</pre>
      </div>

      <div class="rounded-2xl border border-default bg-elevated/60 p-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-default bg-default/70 px-4 py-3">
            <p class="text-xs uppercase tracking-wide text-muted">Local boat host</p>
            <p class="mt-2 text-sm font-medium text-default">
              {{ installation.edgeHostname || localBoatHostname }}
            </p>
          </div>
          <div class="rounded-2xl border border-default bg-default/70 px-4 py-3">
            <p class="text-xs uppercase tracking-wide text-muted">Connection state</p>
            <p class="mt-2 text-sm font-medium text-default">
              {{ installation.connectionState }}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-medium text-default">Issued keys</p>
          <p class="text-xs text-muted">{{ keys.length }} tracked</p>
        </div>

        <div v-if="keys.length" class="space-y-3">
          <div
            v-for="key in keys"
            :key="key.id"
            class="flex items-center justify-between gap-4 rounded-2xl border border-default bg-default/80 px-4 py-3"
          >
            <div>
              <p class="font-mono text-sm text-default">{{ key.keyPrefix }}</p>
              <p class="mt-1 text-xs text-muted">Created {{ formatTimestamp(key.createdAt) }}</p>
            </div>
            <p class="text-xs text-muted">
              {{
                key.lastUsedAt ? `Last used ${formatTimestamp(key.lastUsedAt)}` : 'Unused so far'
              }}
            </p>
          </div>
        </div>

        <AppEmptyState
          v-else
          icon="i-lucide-key"
          title="No ingest keys yet"
          description="Create the first key when you are ready to connect a live edge install."
          compact
        />
      </div>
    </div>
  </UCard>
</template>
