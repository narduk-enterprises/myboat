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
      title: 'Boat setup saved',
      description: 'Your dashboard is ready.',
      color: 'success',
    })

    emit('complete', response.redirectTo)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to save your boat setup right now.'
  }
}
</script>

<template>
  <UCard data-testid="onboarding-form" class="chart-surface rounded-[1.9rem] shadow-card">
    <template #header>
      <div>
        <h2 class="font-display text-2xl text-default">Set up your boat</h2>
        <p class="mt-2 text-sm text-muted">
          Add the public profile, boat basics, and first live feed. You can edit all of this later.
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
          <p class="text-sm font-medium text-default">Captain profile</p>
          <p class="mt-1 text-xs text-muted">Shown on your public captain and boat pages.</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField
            name="captainName"
            label="Captain name"
            description="Shown on your captain page."
            required
          >
            <UInput v-model="state.captainName" class="w-full" placeholder="Tess Morgan" />
          </UFormField>

          <UFormField
            name="username"
            label="Public handle"
            description="Used in your public URL."
            required
          >
            <UInput v-model="state.username" class="w-full" placeholder="tess_aboard" />
          </UFormField>
        </div>

        <UFormField name="headline" label="Headline" description="One short line under your name.">
          <UInput
            v-model="state.headline"
            class="w-full"
            placeholder="Sharing trips, live position, and life aboard."
          />
        </UFormField>

        <UFormField
          name="bio"
          label="Bio"
          description="Optional background for followers and crew."
        >
          <UTextarea
            v-model="state.bio"
            class="w-full"
            :rows="4"
            placeholder="Say a little about the crew, cruising style, or what people should know about the boat."
          />
        </UFormField>
      </section>

      <section class="rounded-[1.5rem] border border-default/70 bg-default/70 p-5 shadow-sm">
        <div>
          <p class="text-sm font-medium text-default">Boat details</p>
          <p class="mt-1 text-xs text-muted">Used across the dashboard and public pages.</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField
            name="vesselName"
            label="Vessel name"
            description="Shown in the dashboard and public page."
            required
          >
            <UInput v-model="state.vesselName" class="w-full" placeholder="Sea Change" />
          </UFormField>

          <UFormField
            name="vesselType"
            label="Vessel type"
            description="Optional. For example: catamaran or trawler."
          >
            <UInput
              v-model="state.vesselType"
              class="w-full"
              placeholder="Sloop, trawler, catamaran, passagemaker"
            />
          </UFormField>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField name="homePort" label="Home port" description="Optional home base.">
            <UInput v-model="state.homePort" class="w-full" placeholder="Galveston, Texas" />
          </UFormField>

          <UFormField
            name="installationLabel"
            label="Primary install label"
            description="How this device appears in the dashboard."
            required
          >
            <UInput
              v-model="state.installationLabel"
              class="w-full"
              placeholder="Aft nav station Pi"
            />
          </UFormField>
        </div>

        <UFormField
          name="summary"
          label="Vessel summary"
          description="Short description for the boat page."
        >
          <UTextarea
            v-model="state.summary"
            class="w-full"
            :rows="3"
            placeholder="Where the boat sails, how it is used, or what makes it distinctive."
          />
        </UFormField>
      </section>

      <section class="rounded-[1.5rem] border border-default/70 bg-default/70 p-5 shadow-sm">
        <div>
          <p class="text-sm font-medium text-default">Live feed</p>
          <p class="mt-1 text-xs text-muted">
            This is where MyBoat connects to your first reporting device.
          </p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <UFormField
            name="edgeHostname"
            label="Edge hostname"
            description="Optional local host or device name."
          >
            <UInput v-model="state.edgeHostname" class="w-full" placeholder="myboat.local" />
          </UFormField>

          <UFormField
            name="signalKUrl"
            label="SignalK or relay URL"
            description="Paste a SignalK websocket or MyBoat relay URL."
          >
            <UInput
              v-model="state.signalKUrl"
              class="w-full"
              placeholder="wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all"
            />
          </UFormField>
        </div>
      </section>

      <div
        class="flex flex-wrap items-center justify-between gap-4 rounded-[1.35rem] border border-default/70 bg-default/60 px-4 py-4"
      >
        <p class="max-w-2xl text-sm leading-6 text-muted">
          This saves your captain profile, primary boat, and first install.
        </p>
        <UButton type="submit" color="primary" :loading="loading" icon="i-lucide-anchor">
          Save setup
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
