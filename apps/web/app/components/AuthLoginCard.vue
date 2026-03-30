<script setup lang="ts">
import { z } from 'zod'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    redirectPath?: string
    showDemoLogin?: boolean
  }>(),
  {
    title: 'Welcome back',
    subtitle: 'Sign in with Apple first, or use email if you prefer.',
    redirectPath: undefined,
    showDemoLogin: false,
  },
)

const emit = defineEmits<{
  success: [user: { id: string; name: string | null; email: string }]
}>()

const config = useRuntimeConfig()
const route = useRoute()
const { login, loginAsTestUser, startOAuth } = useAuth()

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

const state = reactive({
  email: '',
  password: '',
})

const loading = shallowRef(false)
const appleLoading = shallowRef(false)
const demoLoading = shallowRef(false)
const errorMsg = shallowRef('')
const infoMsg = shallowRef('')

const canUseApple = computed(
  () => config.public.authBackend === 'supabase' && config.public.authProviders.includes('apple'),
)
const canRegister = computed(() => config.public.authPublicSignup)
const resolvedRedirectPath = computed(() => props.redirectPath || config.public.authRedirectPath)
const emailExpanded = shallowRef(!canUseApple.value)
const emailToggleLabel = computed(() =>
  emailExpanded.value ? 'Hide email sign in' : 'Use email instead',
)

watchEffect(() => {
  if (typeof route.query.email === 'string' && !state.email) {
    state.email = route.query.email
  }

  if (!canUseApple.value || route.query.reset === '1') {
    emailExpanded.value = true
  }

  if (route.query.checkEmail === '1') {
    infoMsg.value = `Check ${state.email || 'your email'} to confirm the account.`
    return
  }

  if (route.query.reset === '1') {
    infoMsg.value = 'Your password was updated. Sign in with the new password.'
    return
  }

  infoMsg.value = ''
})

async function onSubmit() {
  const parsed = schema.safeParse(state)
  if (!parsed.success) {
    errorMsg.value = parsed.error.issues.map((issue) => issue.message).join(' ')
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    const result = await login({
      email: state.email,
      password: state.password,
    })

    if (result.user) {
      emit('success', result.user)
      await navigateTo(result.redirectTo || resolvedRedirectPath.value, { replace: true })
      return
    }

    errorMsg.value = result.message || 'Sign-in did not complete.'
  } catch (error) {
    errorMsg.value = toUserFacingError(error, 'Invalid email or password.')
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

async function onDemoLogin() {
  demoLoading.value = true
  errorMsg.value = ''

  try {
    const result = await loginAsTestUser()

    if (result.user) {
      emit('success', result.user)
      await navigateTo(result.redirectTo || resolvedRedirectPath.value, { replace: true })
      return
    }

    errorMsg.value = result.message || 'Demo sign-in did not complete.'
  } catch (error) {
    errorMsg.value = toUserFacingError(error, 'Unable to sign in with the demo account.')
  } finally {
    demoLoading.value = false
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
  <UCard class="marine-auth-card w-full" data-testid="auth-login-card">
    <template #header>
      <div class="space-y-4">
        <div v-if="$slots.logo" class="hidden justify-center lg:flex">
          <slot name="logo" />
        </div>

        <div v-if="canUseApple" class="flex flex-wrap items-center justify-start gap-2">
          <div class="marine-auth-chip">Apple first</div>
        </div>

        <div class="space-y-2 text-center">
          <h1 class="font-display text-[2.1rem] leading-tight text-highlighted sm:text-[2.15rem]">
            {{ title }}
          </h1>
          <p class="text-sm leading-6 text-toned sm:text-base">
            {{ subtitle }}
          </p>
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <UAlert v-if="infoMsg" color="success" variant="subtle" title="Check your inbox" :description="infoMsg"
        class="mb-4" />

      <UAlert v-if="errorMsg" color="error" variant="subtle" title="Sign-in failed" :description="errorMsg" class="mb-4"
        data-testid="auth-login-error" />

      <div class="space-y-3">
        <UButton v-if="canUseApple" color="neutral" size="xl"
          class="w-full justify-center font-semibold shadow-[0_22px_48px_-34px_rgb(15_23_42_/_0.52)]"
          :loading="appleLoading" @click="onAppleSignIn">
          Continue with Apple
        </UButton>

        <p v-if="canUseApple" class="text-center text-sm leading-6 text-toned">
          Fastest path back into your boat dashboard.
        </p>

        <UButton v-if="canUseApple" type="button" color="neutral" variant="ghost" size="lg"
          class="w-full justify-center" :icon="emailExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          @click="emailExpanded = !emailExpanded">
          {{ emailToggleLabel }}
        </UButton>

        <div v-if="!canUseApple || emailExpanded"
          class="rounded-[1.4rem] border border-default/70 bg-default/70 p-4 sm:p-5">
          <p class="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-dimmed">
            {{ canUseApple ? 'Email fallback' : 'Email sign in' }}
          </p>
          <p class="mt-2 text-sm leading-6 text-toned">
            Use email only when you prefer not to sign in with Apple for this session.
          </p>

          <UForm :schema="schema" :state="state" class="mt-4 space-y-4" @submit.prevent="onSubmit">
            <UFormField name="email" label="Email" required>
              <UInput v-model="state.email" type="email" icon="i-lucide-mail" size="xl" autocomplete="email"
                placeholder="you@example.com" class="w-full" data-testid="auth-login-email" />
            </UFormField>

            <UFormField name="password" label="Password" required>
              <UInput v-model="state.password" type="password" icon="i-lucide-lock" size="xl"
                autocomplete="current-password" placeholder="••••••••" class="w-full"
                data-testid="auth-login-password" />
            </UFormField>

            <div class="flex items-center justify-between gap-3 text-sm">
              <p class="text-toned">Use the same login you use for your captain page.</p>
              <ULink :to="config.public.authResetPath" class="shrink-0 font-medium text-muted hover:text-primary">
                Forgot password?
              </ULink>
            </div>

            <UButton type="submit" color="primary" size="xl"
              class="w-full justify-center font-semibold shadow-[0_28px_72px_-42px_rgb(14_165_233_/_0.68)]"
              :loading="loading" data-testid="auth-login-submit">
              Sign in with email
            </UButton>

            <UButton v-if="showDemoLogin" type="button" color="neutral" variant="soft" size="xl"
              class="w-full justify-center font-semibold" icon="i-lucide-zap" :loading="demoLoading"
              data-testid="auth-login-demo" @click="onDemoLogin">
              Sign In as Demo User
            </UButton>
          </UForm>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="space-y-2">
        <p class="text-center text-sm text-toned">
          <template v-if="canRegister">
            Don&apos;t have an account?
            <ULink :to="config.public.authRegisterPath" class="font-semibold text-primary hover:underline">
              Sign up
            </ULink>
          </template>
          <template v-else> Need access? Contact an administrator for an invite. </template>
        </p>

        <p class="text-center text-[0.68rem] uppercase tracking-[0.18em] text-dimmed">
          Protected with encrypted auth sessions
        </p>
      </div>
    </template>
  </UCard>
</template>
