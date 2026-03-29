<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: ['auth'] })

const route = useRoute()
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))
const contactId = computed(() => String(route.params.contactId || ''))

const { data, pending, error } = await useAuthTrafficContactDetail(
  vesselSlug.value,
  contactId.value,
)

useSeo({
  title: data.value ? `${data.value.contact.title} · Traffic detail` : 'Traffic contact',
  description:
    'Selected AIS traffic contact with live range, movement, and relative map context.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Traffic contact detail',
  description: 'Selected AIS traffic contact with live range, movement, and relative map context.',
})
</script>

<template>
  <div class="space-y-6">
    <USkeleton v-if="pending" class="h-56 rounded-[2rem]" />

    <TrafficContactDetailSurface
      v-else-if="data"
      :vessel="data.vessel"
      :contact="data.contact"
      :back-to="`/dashboard/vessels/${vesselSlug}`"
      back-label="Back to vessel"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Traffic contact unavailable"
      description="The selected boat is no longer available from the live broker or cached traffic catalog."
    />
  </div>
</template>
