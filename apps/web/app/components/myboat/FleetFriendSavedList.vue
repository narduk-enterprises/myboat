<script setup lang="ts">
import type { FollowedVesselSummary } from '~/types/myboat'

defineProps<{
  activeRemoveId: string | null
  items: FollowedVesselSummary[]
  removePending: boolean
}>()

const emit = defineEmits<{
  remove: [id: string]
}>()
</script>

<template>
  <UCard class="border-default/80 bg-default/90 shadow-card">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-display text-xl text-default">Saved buddy boats</h2>
          <p class="mt-1 text-sm text-muted">These boats are pinned on the captain page.</p>
        </div>

        <UBadge color="primary" variant="soft">{{ items.length }} saved</UBadge>
      </div>
    </template>

    <div v-if="items.length" class="space-y-4">
      <FleetFriendCard
        v-for="item in items"
        :key="item.id"
        :vessel="item"
        removable
        :removing="removePending && activeRemoveId === item.id"
        @remove="emit('remove', $event)"
      />
    </div>

    <MarineEmptyState
      v-else
      icon="i-lucide-users"
      title="No buddy boats saved yet"
      description="Search the AIS library, then add the boats you want to keep on this page."
      compact
    />
  </UCard>
</template>
