<script setup lang="ts">
definePageMeta({ middleware: ['admin'] })

useSeo({
  title: 'Users · Admin',
  description: 'Manage registered MyBoat users and platform admin roles.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Admin users',
  description: 'Manage registered MyBoat users and platform admin roles.',
})

const appFetch = useAppFetch()
const toast = useToast()

const perPage = 20
const page = ref(1)

interface User {
  id: string
  name: string | null
  email: string
  isAdmin: boolean
  createdAt: string
}

interface UsersResponse {
  users: User[]
  total: number
}

const { data: usersData, refresh: refreshUsers } = await useAsyncData(
  'admin-users',
  () => appFetch<UsersResponse>('/api/admin/users', { query: { page: page.value, limit: perPage } }),
  { watch: [page] },
)

const total = computed(() => usersData.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / perPage)))
const users = computed(() => usersData.value?.users ?? [])

const activeAction = ref<string | null>(null)

async function toggleAdmin(userId: string, currentIsAdmin: boolean) {
  activeAction.value = `admin-role:${userId}`
  try {
    await appFetch<{ ok: boolean }>('/api/admin/users/role', {
      method: 'PUT',
      body: { userId, isAdmin: !currentIsAdmin },
    })
    toast.add({ title: 'Role updated', description: 'User admin status changed.', color: 'success' })
    await refreshUsers()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    toast.add({ title: 'Role update failed', description: message, color: 'error' })
  } finally {
    activeAction.value = null
  }
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center gap-3">
      <UButton to="/admin" color="neutral" variant="ghost" icon="i-lucide-arrow-left" size="sm">
        Admin
      </UButton>
    </div>

    <UPageHero
      title="Users"
      description="Registered accounts on the platform. Toggle admin access with care."
    />

    <UCard class="chart-surface rounded-[1.75rem]">
      <template #header>
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="font-display text-xl text-default">All users</h2>
            <p class="mt-1 text-sm text-muted">{{ total }} registered account{{ total === 1 ? '' : 's' }}</p>
          </div>
        </div>
      </template>

      <div v-if="users.length" class="space-y-3">
        <div
          v-for="user in users"
          :key="user.id"
          class="flex items-center justify-between gap-4 rounded-2xl border border-default bg-elevated/60 px-4 py-4"
        >
          <div class="min-w-0">
            <p class="font-medium text-default">{{ user.name || '—' }}</p>
            <p class="mt-1 text-sm text-muted">{{ user.email }}</p>
            <p class="mt-1 text-xs text-muted">Joined {{ new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <UBadge v-if="user.isAdmin" color="warning" variant="soft" icon="i-lucide-shield-check">
              Admin
            </UBadge>
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              :loading="activeAction === `admin-role:${user.id}`"
              :icon="user.isAdmin ? 'i-lucide-shield-off' : 'i-lucide-shield-check'"
              @click="toggleAdmin(user.id, user.isAdmin)"
            >
              {{ user.isAdmin ? 'Remove admin' : 'Make admin' }}
            </UButton>
          </div>
        </div>
      </div>

      <MarineEmptyState
        v-else
        icon="i-lucide-users"
        title="No users found"
        description="No registered accounts on this platform yet."
        compact
      />

      <template v-if="totalPages > 1" #footer>
        <div class="flex items-center justify-between gap-4">
          <p class="text-sm text-muted">
            Page {{ page }} of {{ totalPages }}
          </p>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-chevron-left"
              :disabled="page <= 1"
              @click="page--"
            >
              Previous
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              trailing-icon="i-lucide-chevron-right"
              :disabled="page >= totalPages"
              @click="page++"
            >
              Next
            </UButton>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>
