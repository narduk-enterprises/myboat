<script setup lang="ts">
import { z } from 'zod'
import type { AuthUser } from '~/composables/useAuthApi'

definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

useSeo({
  title: 'Security settings',
  description: 'Password and multi-factor authentication settings for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Security settings',
  description: 'Password and multi-factor authentication settings for MyBoat.',
})

const toast = useToast()
const { user, changePassword, enrollMfa, verifyMfa, fetchUser } = useAuth()
const currentUser = computed(() => user.value as AuthUser | null)
const passwordLoading = ref(false)
const mfaLoading = ref(false)
const mfaSetup = ref<null | {
  factorId: string
  qrCodeSvg: string
  qrCodeDataUrl: string
  secret: string
  uri: string
}>(null)

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(10, 'Use at least 10 characters'),
})

const passwordState = reactive({
  currentPassword: '',
  newPassword: '',
})

const mfaSchema = z.object({
  friendlyName: z.string().optional(),
})

const mfaCodeSchema = z.object({
  code: z.string().min(6, 'Enter the six-digit code'),
})

const mfaState = reactive({
  friendlyName: '',
  code: '',
})

async function onChangePassword() {
  passwordLoading.value = true

  try {
    const payload = passwordState.currentPassword
      ? {
          currentPassword: passwordState.currentPassword,
          newPassword: passwordState.newPassword,
        }
      : {
          newPassword: passwordState.newPassword,
        }

    await changePassword(payload)
    try {
      await fetchUser()
    } catch {
      // Ignore session refresh errors; the password change already succeeded.
    }
    toast.add({
      title: 'Password updated',
      description: 'The captain account password is now current.',
      color: 'success',
    })
    passwordState.currentPassword = ''
    passwordState.newPassword = ''
  } catch (error) {
    toast.add({
      title: 'Password update failed',
      description: error instanceof Error ? error.message : 'Please try again.',
      color: 'error',
    })
  } finally {
    passwordLoading.value = false
  }
}

async function beginMfaEnrollment() {
  mfaLoading.value = true

  try {
    const payload = mfaState.friendlyName
      ? {
          friendlyName: mfaState.friendlyName,
        }
      : {}

    mfaSetup.value = await enrollMfa(payload)
    toast.add({
      title: 'MFA enrollment ready',
      description: 'Scan the QR code and enter the verification code to complete setup.',
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'MFA enrollment failed',
      description: error instanceof Error ? error.message : 'Please try again.',
      color: 'error',
    })
  } finally {
    mfaLoading.value = false
  }
}

async function confirmMfa() {
  if (!mfaSetup.value) {
    return
  }

  mfaLoading.value = true

  try {
    await verifyMfa({
      factorId: mfaSetup.value.factorId,
      code: mfaState.code,
    })
    try {
      await fetchUser()
    } catch {
      // Ignore session refresh errors; MFA is already enabled server-side.
    }
    toast.add({
      title: 'MFA enabled',
      description: 'Multi-factor authentication is now active on this account.',
      color: 'success',
    })
    mfaSetup.value = null
    mfaState.code = ''
  } catch (error) {
    toast.add({
      title: 'MFA verification failed',
      description: error instanceof Error ? error.message : 'Please try again.',
      color: 'error',
    })
  } finally {
    mfaLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <UPageHero
      title="Security"
      description="Manage the captain password and multi-factor authentication posture."
    >
      <template #links>
        <UButton to="/dashboard/settings" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to settings
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-6 lg:grid-cols-2">
      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Password</h2>
            <p class="mt-1 text-sm text-muted">Update the account password used for local login.</p>
          </div>
        </template>

        <UForm :schema="passwordSchema" :state="passwordState" class="space-y-5" @submit.prevent="onChangePassword">
          <UFormField name="currentPassword" label="Current password">
            <UInput v-model="passwordState.currentPassword" type="password" class="w-full" />
          </UFormField>

          <UFormField name="newPassword" label="New password">
            <UInput v-model="passwordState.newPassword" type="password" class="w-full" />
          </UFormField>

          <div class="flex justify-end">
            <UButton type="submit" color="primary" :loading="passwordLoading" icon="i-lucide-lock">
              Change password
            </UButton>
          </div>
        </UForm>
      </UCard>

      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Account posture</h2>
            <p class="mt-1 text-sm text-muted">Identity and session metadata for the current captain.</p>
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Email</p>
            <p class="mt-3 break-all font-display text-xl text-default">
              {{ currentUser?.email || 'Unknown' }}
            </p>
          </div>
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Provider</p>
            <p class="mt-3 font-display text-xl text-default">
              {{ currentUser?.authProvider || 'local' }}
            </p>
          </div>
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">MFA</p>
            <p class="mt-3 font-display text-xl text-default">
              {{ currentUser?.aal === 'aal2' ? 'Enabled' : 'Not enabled' }}
            </p>
          </div>
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Admin</p>
            <p class="mt-3 font-display text-xl text-default">
              {{ currentUser?.isAdmin ? 'Yes' : 'No' }}
            </p>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card lg:col-span-2">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Multi-factor authentication</h2>
            <p class="mt-1 text-sm text-muted">
              Enroll a second factor to harden the captain account.
            </p>
          </div>
        </template>

        <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div class="space-y-4">
            <p class="text-sm text-muted">
              MFA is currently {{ currentUser?.aal === 'aal2' ? 'active' : 'optional' }} on this
              account. Start a new enrollment to rotate or add a factor.
            </p>

            <UForm :schema="mfaSchema" :state="mfaState" class="space-y-4" @submit.prevent="beginMfaEnrollment">
              <UFormField name="friendlyName" label="Friendly name">
                <UInput
                  v-model="mfaState.friendlyName"
                  class="w-full"
                  placeholder="Bridge phone, hardware key, authenticator app"
                />
              </UFormField>

              <div class="flex flex-wrap gap-3">
                <UButton type="submit" color="primary" :loading="mfaLoading" icon="i-lucide-qr-code">
                  Start enrollment
                </UButton>
                <UButton
                  v-if="mfaSetup"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-check-circle"
                  :loading="mfaLoading"
                  @click="confirmMfa"
                >
                  Verify code
                </UButton>
              </div>
            </UForm>
          </div>

          <div v-if="mfaSetup" class="rounded-[1.5rem] border border-default bg-elevated/70 p-5">
            <p class="text-sm font-medium text-default">Enrollment details</p>
            <div class="mt-4 flex justify-center">
              <img
                :src="mfaSetup.qrCodeDataUrl"
                alt="MFA QR code"
                class="max-w-64 rounded-2xl border border-default bg-white p-3"
              >
            </div>

            <div class="mt-4 space-y-3 text-sm">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-muted">Secret</p>
                <p class="mt-1 break-all rounded-xl bg-default px-3 py-2 font-mono text-default">
                  {{ mfaSetup.secret }}
                </p>
              </div>

              <UForm :schema="mfaCodeSchema" :state="mfaState" class="space-y-3" @submit.prevent="confirmMfa">
                <UFormField name="code" label="Verification code">
                  <UInput v-model="mfaState.code" class="w-full" inputmode="numeric" />
                </UFormField>

                <div class="flex justify-end">
                  <UButton
                    type="submit"
                    color="primary"
                    :loading="mfaLoading"
                    icon="i-lucide-check-circle"
                  >
                    Verify code
                  </UButton>
                </div>
              </UForm>
            </div>
          </div>

          <div v-else class="rounded-[1.5rem] border border-dashed border-default/70 bg-muted/20 p-5">
            <p class="font-medium text-default">No enrollment started</p>
            <p class="mt-2 text-sm text-muted">
              Generate a QR code when you are ready to bind a second factor to the captain account.
            </p>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
