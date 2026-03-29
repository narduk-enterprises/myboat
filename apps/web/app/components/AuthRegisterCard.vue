<script setup lang="ts">
import { z } from 'zod'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    redirectPath?: string
  }>(),
  {
    title: 'Create an account',
    subtitle: 'Start with Apple, then fall back to email when needed.',
    redirectPath: undefined,
  },
)

const emit = defineEmits<{
  success: [user: { id: string; name: string | null; email: string }]
}>()

const config = useRuntimeConfig()
const { register, startOAuth } = useAuth()

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

const state = reactive({
  name: '',
  email: '',
  password: '',
})

const loading = shallowRef(false)
const appleLoading = shallowRef(false)
const errorMsg = shallowRef('')

const canUseApple = computed(
  () => config.public.authBackend === 'supabase' && config.public.authProviders.includes('apple'),
)
const resolvedRedirectPath = computed(() => props.redirectPath || config.public.authRedirectPath)

async function onSubmit() {
  const parsed = schema.safeParse(state)
  if (!parsed.success) {
    errorMsg.value = parsed.error.issues.map((issue) => issue.message).join(' ')
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    const result = await register({
      name: state.name,
      email: state.email,
      password: state.password,
      next: resolvedRedirectPath.value,
    })

    if (result.user) {
      emit('success', result.user)
      await navigateTo(result.redirectTo || resolvedRedirectPath.value, { replace: true })
      return
    }

    if (result.nextStep === 'email_confirmation') {
      await navigateTo(
        {
          path: config.public.authLoginPath,
          query: {
            checkEmail: '1',
            email: state.email,
          },
        },
        { replace: true },
      )
      return
    }

    errorMsg.value = result.message || 'Signup did not complete.'
  } catch (error) {
    errorMsg.value = toUserFacingError(error, 'Unable to create the account.')
  } finally {
    loading.value = false
  }
}

async function onAppleSignIn() {
  appleLoading.value = true
  errorMsg.value = ''

  try {
    const result = await startOAuth({
      provider: 'apple',
      next: resolvedRedirectPath.value,
    })
    await navigateTo(result.url, { external: true })
  } catch (error) {
    errorMsg.value = toUserFacingError(error, 'Unable to start Sign in with Apple.')
  } finally {
    appleLoading.value = false
  }
}

function toUserFacingError(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback

  const maybeError = error as {
    data?: { statusMessage?: string; message?: string }
    statusMessage?: string
    message?: string
  }

  return (
    maybeError.data?.statusMessage ||
    maybeError.data?.message ||
    maybeError.statusMessage ||
    maybeError.message ||
    fallback
  )
}
</script>

<template>
  <UCard class="marine-auth-card w-full">
    <template #header>
      <div class="space-y-5">
        <div v-if="$slots.logo" class="flex justify-center sm:justify-start">
          <slot name="logo" />
        </div>

        <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <div class="marine-auth-chip">Captain account setup</div>
          <div class="marine-auth-chip">
            {{ canUseApple ? 'Apple + email sign-up' : 'Email sign-up' }}
          </div>
        </div>

        <div class="space-y-2 text-center sm:text-left">
          <h1 class="font-display text-3xl leading-tight text-highlighted sm:text-[2.15rem]">
            {{ title }}
          </h1>
          <p class="text-sm leading-6 text-toned sm:text-base">
            {{ subtitle }}
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="marine-auth-note">
            <p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-dimmed">
              Workspace
            </p>
            <p class="mt-2 text-sm font-semibold text-default">
              Claim your dashboard and crew page.
            </p>
          </div>

          <div class="marine-auth-note">
            <p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-dimmed">
              Onboarding
            </p>
            <p class="mt-2 text-sm font-semibold text-default">
              Add your first boat and live feed next.
            </p>
          </div>
        </div>
      </div>
    </template>

    <div class="space-y-5">
      <UAlert
        v-if="errorMsg"
        color="error"
        variant="subtle"
        title="Signup failed"
        :description="errorMsg"
        class="mb-4"
        data-testid="auth-register-error"
      />

      <div class="space-y-4">
        <UButton
          v-if="canUseApple"
          color="neutral"
          variant="outline"
          size="xl"
          class="w-full justify-center border-default/70 bg-elevated/84 font-semibold shadow-[0_16px_36px_-32px_rgb(15_23_42_/_0.6)]"
          :loading="appleLoading"
          @click="onAppleSignIn"
        >
          Continue with Apple
        </UButton>

        <div
          v-if="canUseApple"
          class="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-dimmed"
        >
          <span class="h-px flex-1 bg-default" />
          <span>Or sign up with email</span>
          <span class="h-px flex-1 bg-default" />
        </div>

        <UForm :schema="schema" :state="state" class="space-y-4" @submit.prevent="onSubmit">
          <UFormField name="name" label="Name" required>
            <UInput
              v-model="state.name"
              icon="i-lucide-user-round"
              size="xl"
              autocomplete="name"
              placeholder="Jane Doe"
              class="w-full"
              data-testid="auth-register-name"
            />
          </UFormField>

          <UFormField name="email" label="Email" required>
            <UInput
              v-model="state.email"
              type="email"
              icon="i-lucide-mail"
              size="xl"
              autocomplete="email"
              placeholder="you@example.com"
              class="w-full"
              data-testid="auth-register-email"
            />
          </UFormField>

          <UFormField name="password" label="Password" required>
            <UInput
              v-model="state.password"
              type="password"
              icon="i-lucide-lock"
              size="xl"
              autocomplete="new-password"
              placeholder="Create a strong password"
              class="w-full"
              data-testid="auth-register-password"
            />
          </UFormField>

          <p class="text-sm text-toned">
            Use a secure password for the account that will own your boat and install setup.
          </p>

          <UButton
            type="submit"
            color="primary"
            size="xl"
            class="w-full justify-center font-semibold shadow-[0_28px_72px_-42px_rgb(14_165_233_/_0.68)]"
            :loading="loading"
            data-testid="auth-register-submit"
          >
            Create Account
          </UButton>
        </UForm>
      </div>
    </div>

    <template #footer>
      <div class="space-y-3">
        <p class="text-center text-sm text-toned">
          Already have an account?
          <ULink
            :to="config.public.authLoginPath"
            class="font-semibold text-primary hover:underline"
          >
            Sign in
          </ULink>
        </p>

        <p class="text-center text-xs uppercase tracking-[0.18em] text-dimmed">
          Setup continues in your secure dashboard
        </p>
      </div>
    </template>
  </UCard>
</template>
