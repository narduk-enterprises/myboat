<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Captain profile settings',
  description: 'Edit the captain profile and public handle used by MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Captain profile settings',
  description: 'Edit the captain profile and public handle used by MyBoat.',
})

const toast = useToast()
const session = useUserSession()
const appFetch = useAppFetch()
const { data, pending } = await useDashboardOverview('myboat-settings-profile')

const overview = computed(() => data.value)
const profile = computed(() => overview.value?.profile ?? null)
const primaryVessel = computed(
  () => overview.value?.vessels.find((vessel) => vessel.isPrimary) || overview.value?.vessels[0] || null,
)
const primaryInstall = computed(
  () =>
    overview.value?.installations.find((installation) => installation.vesselId === primaryVessel.value?.id) ||
    overview.value?.installations[0] ||
    null,
)

const schema = z.object({
  captainName: z.string().trim().min(2).max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]+$/)
    .min(3)
    .max(20),
  headline: z.string().trim().max(120).optional().or(z.literal('')),
  bio: z.string().trim().max(400).optional().or(z.literal('')),
  homePort: z.string().trim().max(120).optional().or(z.literal('')),
})

const state = reactive({
  captainName: overview.value?.profile?.captainName || '',
  username: overview.value?.profile?.username || '',
  headline: overview.value?.profile?.headline || '',
  bio: overview.value?.profile?.bio || '',
  homePort: overview.value?.profile?.homePort || '',
})

watch(
  () => overview.value?.profile,
  (nextProfile) => {
    if (!nextProfile) {
      return
    }

    state.captainName = nextProfile.captainName || ''
    state.username = nextProfile.username || ''
    state.headline = nextProfile.headline || ''
    state.bio = nextProfile.bio || ''
    state.homePort = nextProfile.homePort || ''
  },
  { immediate: true },
)

watchEffect(() => {
  if (
    overview.value &&
    (!overview.value.profile || !primaryVessel.value || !primaryInstall.value)
  ) {
    void navigateTo('/dashboard/onboarding', { replace: true })
  }
})

const currentSetup = computed(() => {
  const vessel = primaryVessel.value
  const installation = primaryInstall.value

  return {
    vesselName: vessel?.name || '',
    vesselType: vessel?.vesselType || '',
    vesselSummary: vessel?.summary || '',
    installationLabel: installation?.label || '',
    edgeHostname: installation?.edgeHostname || '',
    signalKUrl: installation?.signalKUrl || '',
  }
})

const loading = ref(false)

async function onSubmit() {
  if (!overview.value || !primaryVessel.value || !primaryInstall.value) {
    return
  }

  loading.value = true

  try {
    const payload = {
      captainName: state.captainName,
      username: state.username,
      headline: state.headline,
      bio: state.bio,
      vesselName: currentSetup.value.vesselName,
      vesselType: currentSetup.value.vesselType,
      homePort: state.homePort,
      summary: currentSetup.value.vesselSummary,
      installationLabel: currentSetup.value.installationLabel,
      edgeHostname: currentSetup.value.edgeHostname,
      signalKUrl: currentSetup.value.signalKUrl,
    }

    await appFetch('/api/app/onboarding', {
      method: 'POST',
      body: payload,
    })

    try {
      await session.fetch()
    } catch {
      // Ignore session refresh errors; the profile save already succeeded.
    }
    toast.add({
      title: 'Captain profile saved',
      description: 'Your public handle and profile copy are up to date.',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'Unable to save captain profile',
      description: error instanceof Error ? error.message : 'Please try again.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <template v-if="pending">
      <USkeleton class="h-56 rounded-[2rem]" />
      <div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <USkeleton class="h-[34rem] rounded-[1.75rem]" />
        <div class="space-y-6">
          <USkeleton class="h-72 rounded-[1.75rem]" />
          <USkeleton class="h-64 rounded-[1.75rem]" />
        </div>
      </div>
    </template>

    <template v-else-if="overview">
    <UPageHero
      title="Captain profile"
      description="Update the name, handle, and profile copy that power your public identity."
    >
      <template #links>
        <UButton to="/dashboard/settings" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to settings
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Profile editor</h2>
            <p class="mt-1 text-sm text-muted">
              These fields update the same canonical captain records used by onboarding.
            </p>
          </div>
        </template>

        <UForm :schema="schema" :state="state" class="space-y-5" @submit.prevent="onSubmit">
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
              placeholder="Describe the crew, cruising style, or what the public should know."
            />
          </UFormField>

          <UFormField name="homePort" label="Home port">
            <UInput v-model="state.homePort" class="w-full" placeholder="Galveston, Texas" />
          </UFormField>

          <div class="flex flex-wrap items-center justify-between gap-4">
            <p class="text-sm text-muted">
              This save keeps your vessel and installation records attached to the current primary
              setup.
            </p>
            <UButton type="submit" color="primary" :loading="loading" icon="i-lucide-save">
              Save profile
            </UButton>
          </div>
        </UForm>
      </UCard>

      <div class="space-y-6">
        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h3 class="font-display text-xl text-default">Current public surface</h3>
              <p class="mt-1 text-sm text-muted">What followers see today.</p>
            </div>
          </template>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="metric-shell rounded-[1.35rem] p-4">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Public URL</p>
              <p class="mt-3 break-all font-display text-xl text-default">
                /{{ profile?.username || 'pending' }}
              </p>
            </div>
            <div class="metric-shell rounded-[1.35rem] p-4">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Primary vessel</p>
              <p class="mt-3 font-display text-xl text-default">
                {{ primaryVessel?.name || 'Pending' }}
              </p>
            </div>
            <div class="metric-shell rounded-[1.35rem] p-4">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Install label</p>
              <p class="mt-3 font-display text-xl text-default">
                {{ primaryInstall?.label || 'Pending' }}
              </p>
            </div>
            <div class="metric-shell rounded-[1.35rem] p-4">
              <p class="text-xs uppercase tracking-[0.24em] text-muted">Handle</p>
              <p class="mt-3 font-display text-xl text-default">@{{ profile?.username || 'pending' }}</p>
            </div>
          </div>
        </UCard>

        <UCard class="chart-surface rounded-[1.75rem] shadow-card">
          <template #header>
            <div>
              <h3 class="font-display text-xl text-default">What this page does</h3>
              <p class="mt-1 text-sm text-muted">
                It updates the captain identity and preserves the current vessel/install base.
              </p>
            </div>
          </template>

          <div class="space-y-3 text-sm text-muted">
            <p>Captain name updates the owner account display name.</p>
            <p>Public handle controls the captain profile URL.</p>
            <p>Headline and bio shape the public story pages and profile cards.</p>
            <p>Home port keeps the public map and summary language grounded.</p>
          </div>
        </UCard>
      </div>
    </div>
    </template>

    <UAlert
      v-else
      color="error"
      variant="soft"
      title="Profile unavailable"
      description="We could not load the captain profile editor right now."
    />
  </div>
</template>
