<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

useSeo({
  title: 'Security · Settings',
  description: 'Manage account security including password changes and multi-factor authentication.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Security settings',
  description:
    'Manage account security including password changes and multi-factor authentication.',
})

const appFetch = useAppFetch()
const toast = useToast()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pending = ref(false)
const passwordError = ref('')

async function changePassword() {
  passwordError.value = ''

  if (newPassword.value.length < 8) {
    passwordError.value = 'New password must be at least 8 characters.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Passwords do not match.'
    return
  }

  pending.value = true

  try {
    await appFetch('/api/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: currentPassword.value || undefined,
        newPassword: newPassword.value,
      },
    })

    toast.add({
      title: 'Password updated',
      description: 'Your password has been changed successfully.',
      color: 'success',
    })

    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Something went wrong.'
    passwordError.value = message
    toast.add({ title: 'Password change failed', description: message, color: 'error' })
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-3">
      <UButton
        to="/dashboard/settings"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        size="sm"
      >
        Settings
      </UButton>
    </div>

    <UPageHero
      title="Security"
      description="Keep your account secure with a strong password and multi-factor authentication."
    />

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <UCard class="chart-surface rounded-[1.75rem]">
        <template #header>
          <div>
            <h2 class="font-display text-xl text-default">Change password</h2>
            <p class="mt-1 text-sm text-muted">
              Update your login password. Use at least 8 characters.
            </p>
          </div>
        </template>

        <form class="space-y-4" @submit.prevent="changePassword">
          <div class="space-y-2">
            <label for="current-password" class="block text-sm font-medium text-default"
              >Current password</label
            >
            <UInput
              id="current-password"
              v-model="currentPassword"
              type="password"
              placeholder="Enter current password"
              autocomplete="current-password"
              class="w-full"
            />
          </div>

          <div class="space-y-2">
            <label for="new-password" class="block text-sm font-medium text-default"
              >New password</label
            >
            <UInput
              id="new-password"
              v-model="newPassword"
              type="password"
              placeholder="At least 8 characters"
              autocomplete="new-password"
              class="w-full"
            />
          </div>

          <div class="space-y-2">
            <label for="confirm-password" class="block text-sm font-medium text-default"
              >Confirm new password</label
            >
            <UInput
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              placeholder="Repeat new password"
              autocomplete="new-password"
              class="w-full"
            />
          </div>

          <UAlert
            v-if="passwordError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :description="passwordError"
          />

          <div class="flex justify-end pt-2">
            <UButton type="submit" color="primary" :loading="pending" icon="i-lucide-lock-keyhole">
              Update password
            </UButton>
          </div>
        </form>
      </UCard>

      <div class="space-y-6">
        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default">Multi-factor authentication</h2>
              <p class="mt-1 text-sm text-muted">
                Add a second verification layer to protect your account.
              </p>
            </div>
          </template>

          <MarineEmptyState
            icon="i-lucide-smartphone"
            title="MFA not configured"
            description="Authenticator app enrollment will be available in a future release."
            compact
          />
        </UCard>

        <UCard class="border-default/80 bg-default/90 shadow-card">
          <template #header>
            <div>
              <h2 class="font-display text-xl text-default">Password tips</h2>
            </div>
          </template>

          <ul class="space-y-2 text-sm text-muted">
            <li class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
              At least 8 characters
            </li>
            <li class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
              Mix uppercase, lowercase, and numbers
            </li>
            <li class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="mt-0.5 size-4 shrink-0 text-success" />
              Avoid reusing passwords from other services
            </li>
          </ul>
        </UCard>
      </div>
    </div>
  </div>
</template>
