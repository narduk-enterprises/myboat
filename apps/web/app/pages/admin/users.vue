<script setup lang="ts">
import type { AuthUser } from '~/composables/useAuthApi'

definePageMeta({ layout: 'admin', middleware: ['auth'] })

useSeo({
  title: 'Admin users',
  description: 'Operator identity and access posture for MyBoat.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin users',
  description: 'Operator identity and access posture for MyBoat.',
})

const session = useUserSession()
const currentUser = computed(() => session.user.value as AuthUser | null)

watchEffect(() => {
  if (session.loggedIn.value && currentUser.value && !currentUser.value.isAdmin) {
    void navigateTo('/dashboard', { replace: true })
  }
})
</script>

<template>
  <div class="space-y-8">
    <UPageHero
      title="Users"
      description="Current operator account details and the access posture that launch supports."
    >
      <template #links>
        <UButton to="/admin" color="neutral" variant="soft" icon="i-lucide-arrow-left">
          Back to admin
        </UButton>
      </template>
    </UPageHero>

    <div class="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <UCard class="chart-surface rounded-[1.75rem] shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Current admin account</h2>
            <p class="mt-1 text-sm text-muted">
              The signed-in account that can reach the launch admin console.
            </p>
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="metric-shell rounded-[1.35rem] p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-muted">Name</p>
            <p class="mt-3 font-display text-xl text-default">{{ currentUser?.name || 'Unknown' }}</p>
          </div>
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
              {{ currentUser?.aal === 'aal2' ? 'Enabled' : 'AAL1' }}
            </p>
          </div>
        </div>
      </UCard>

      <UCard class="border-default/80 bg-default/90 shadow-card">
        <template #header>
          <div>
            <h2 class="font-display text-2xl text-default">Launch scope</h2>
            <p class="mt-1 text-sm text-muted">
              The admin surface is intentionally narrow for launch.
            </p>
          </div>
        </template>

        <div class="space-y-4 text-sm text-muted">
          <p>Read current account identity and session posture.</p>
          <p>Revoke keys, disable sharing, and mark installs unhealthy through operator flows.</p>
          <p>Impersonation is intentionally out of scope.</p>
          <p>Broader user roster management can be added once the backend supports it.</p>
        </div>
      </UCard>
    </div>
  </div>
</template>
