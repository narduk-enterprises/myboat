<script setup lang="ts">
definePageMeta({ layout: 'landing' })

const route = useRoute()
const username = computed(() => String(route.params.username || ''))
const vesselSlug = computed(() => String(route.params.vesselSlug || ''))
const contactId = computed(() => String(route.params.contactId || ''))

const { data, pending, error } = await usePublicTrafficContactDetail(
  username.value,
  vesselSlug.value,
  contactId.value,
)

useSeo({
  title: data.value ? `${data.value.contact.title} · ${data.value.vessel.name}` : 'Traffic contact',
  description:
    'Selected AIS traffic contact with public vessel context, relative range, and movement details.',
})

useWebPageSchema({
  name: 'Public traffic contact detail',
  description:
    'Selected AIS traffic contact with public vessel context, relative range, and movement details.',
  type: 'WebPage',
})
</script>

<template>
  <div class="space-y-6">
    <USkeleton v-if="pending" class="h-56 rounded-[2rem]" />

    <TrafficContactDetailSurface
      v-else-if="data"
      :profile="data.profile"
      :vessel="data.vessel"
      :contact="data.contact"
      :back-to="`/${username}/${vesselSlug}`"
      back-label="Back to vessel"
    />

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      title="Traffic contact unavailable"
      description="The selected boat is no longer available from the current public live broker or cached traffic catalog."
    />
  </div>
</template>
