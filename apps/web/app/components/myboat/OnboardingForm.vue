<script setup lang="ts">
import type { OnboardingPayload } from '~/types/myboat'
import { z } from 'zod'

const schema = z.object({
  captainName: z.string().min(2, 'Captain name is required'),
  username: z
    .string()
    .min(3, 'Handle must be at least 3 characters')
    .max(20, 'Handle must be at most 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores only'),
  headline: z.string().max(120).optional(),
  bio: z.string().max(400).optional(),
  vesselName: z.string().min(2, 'Vessel name is required'),
  vesselType: z.string().max(60).optional(),
  homePort: z.string().max(120).optional(),
  summary: z.string().max(280).optional(),
  installationLabel: z.string().min(2, 'Installation label is required'),
  edgeHostname: z.string().max(120).optional(),
  signalKUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})

const props = withDefaults(
  defineProps<{
    initialState?: Partial<z.infer<typeof schema>>
  }>(),
  {
    initialState: () => ({}),
  },
)

const emit = defineEmits<{
  complete: [redirectTo: string]
}>()

const toast = useToast()
const { pending: loading, saveOnboarding } = useSaveOnboarding()
const errorMessage = shallowRef('')
const state = reactive<z.infer<typeof schema>>({
  captainName: props.initialState.captainName || '',
  username: props.initialState.username || '',
  headline: props.initialState.headline || '',
  bio: props.initialState.bio || '',
  vesselName: props.initialState.vesselName || '',
  vesselType: props.initialState.vesselType || '',
  homePort: props.initialState.homePort || '',
  summary: props.initialState.summary || '',
  installationLabel: props.initialState.installationLabel || '',
  edgeHostname: props.initialState.edgeHostname || '',
  signalKUrl: props.initialState.signalKUrl || '',
})

watch(
  () =>
    [
      props.initialState.captainName,
      props.initialState.username,
      props.initialState.headline,
      props.initialState.bio,
      props.initialState.vesselName,
      props.initialState.vesselType,
      props.initialState.homePort,
      props.initialState.summary,
      props.initialState.installationLabel,
      props.initialState.edgeHostname,
      props.initialState.signalKUrl,
    ] as const,
  ([
    captainName,
    username,
    headline,
    bio,
    vesselName,
    vesselType,
    homePort,
    summary,
    installationLabel,
    edgeHostname,
    signalKUrl,
  ]) => {
    state.captainName = captainName || ''
    state.username = username || ''
    state.headline = headline || ''
    state.bio = bio || ''
    state.vesselName = vesselName || ''
    state.vesselType = vesselType || ''
    state.homePort = homePort || ''
    state.summary = summary || ''
    state.installationLabel = installationLabel || ''
    state.edgeHostname = edgeHostname || ''
    state.signalKUrl = signalKUrl || ''
  },
  { immediate: true },
)

async function onSubmit() {
  errorMessage.value = ''

  try {
    const payload = schema.parse(state) as OnboardingPayload
    const response = await saveOnboarding(payload)

    toast.add({
      title: 'Boat profile saved',
      description: 'The dashboard is ready for your first live installation.',
      color: 'success',
    })

    emit('complete', response.redirectTo)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to save your boat profile right now.'
  }
}
</script>

<template>
  <UCard data-testid="onboarding-form" class="chart-surface rounded-[1.9rem] shadow-card">
    <template #header>
      <div>
        <h2 class="font-display text-2xl text-default">Lock the boat profile</h2>
        <p class="mt-2 text-sm text-muted">
          This replaces the old split onboarding flow with one canonical setup pass for captain
          identity, vessel identity, and the first device install.
        </p>
      </div>
    </template>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      title="Unable to save onboarding"
      :description="errorMessage"
      class="mb-5"
    />

    <UForm :schema="schema" :state="state" class="space-y-6" @submit.prevent="onSubmit">
      <section class="rounded-[1.5rem] border border-default/70 bg-default/70 p-5 shadow-sm">
        <div>
          <p class="text-sm font-medium text-default">Captain identity</p>
          <p class="mt-1 text-xs text-muted">
            Public profile, share handle, and the voice of the boat.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField name="captainName" label="Captain name">
            <UInput v-model="state.captainName" class="w-full" />
          </UFormField>

          <UFormField name="username" label="Public handle">
            <UInput v-model="state.username" class="w-full" />
          </UFormField>
        </div>

        <UFormField name="headline" label="Headline">
          <UInput
            v-model="state.headline"
            class="w-full"
            placeholder="Live tracking, passages, and story from the boat."
          />
        </UFormField>

        <UFormField name="bio" label="Bio">
          <UTextarea
            v-model="state.bio"
            class="w-full"
            :rows="4"
            placeholder="Describe the mission, cruising style, and what public followers should understand about this vessel."
          />
        </UFormField>
      </section>

      <section class="rounded-[1.5rem] border border-default/70 bg-default/70 p-5 shadow-sm">
        <div>
          <p class="text-sm font-medium text-default">Vessel identity</p>
          <p class="mt-1 text-xs text-muted">
            The canonical boat model that public pages, live telemetry, passages, and media all hang
            off.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField name="vesselName" label="Vessel name">
            <UInput v-model="state.vesselName" class="w-full" />
          </UFormField>

          <UFormField name="vesselType" label="Vessel type">
            <UInput
              v-model="state.vesselType"
              class="w-full"
              placeholder="Sloop, trawler, catamaran, passagemaker"
            />
          </UFormField>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField name="homePort" label="Home port">
            <UInput v-model="state.homePort" class="w-full" placeholder="Galveston, Texas" />
          </UFormField>

          <UFormField name="installationLabel" label="Primary install label">
            <UInput
              v-model="state.installationLabel"
              class="w-full"
              placeholder="Aft nav station Pi"
            />
          </UFormField>
        </div>

        <UFormField name="summary" label="Vessel summary">
          <UTextarea
            v-model="state.summary"
            class="w-full"
            :rows="3"
            placeholder="Operational summary, normal waters, and what the crew cares about most."
          />
        </UFormField>
      </section>

      <section class="rounded-[1.5rem] border border-default/70 bg-default/70 p-5 shadow-sm">
        <div>
          <p class="text-sm font-medium text-default">Telemetry install</p>
          <p class="mt-1 text-xs text-muted">
            SignalK and edge install metadata for the first live feed. Use a direct websocket URL if
            you want the collector to talk straight to Signal K, or keep the MyBoat relay URL if you
            want the relay path instead.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField name="edgeHostname" label="Edge hostname">
            <UInput v-model="state.edgeHostname" class="w-full" placeholder="myboat.local" />
          </UFormField>

          <UFormField name="signalKUrl" label="SignalK or relay URL">
            <UInput
              v-model="state.signalKUrl"
              class="w-full"
              placeholder="wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=none"
            />
          </UFormField>
        </div>
      </section>

      <div
        class="flex flex-wrap items-center justify-between gap-4 rounded-[1.35rem] border border-default/70 bg-default/60 px-4 py-4"
      >
        <p class="max-w-2xl text-sm leading-6 text-muted">
          Save once to establish the captain profile, primary vessel identity, and the first live
          install that all other controls build from.
        </p>
        <UButton type="submit" color="primary" :loading="loading" icon="i-lucide-anchor">
          Save boat profile
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
