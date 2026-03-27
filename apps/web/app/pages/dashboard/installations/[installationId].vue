<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const installationId = computed(() => String(route.params.installationId || ''))

const { data } = await useInstallationDetail(installationId.value)

const detail = computed(() => data.value)

useSeo({
  title: detail.value?.installation.label || 'Installation',
  description: 'Installation detail and ingest-key management for a vessel device.',
  robots: 'noindex, nofollow',
})

useWebPageSchema({
  name: 'Installation detail',
  description: 'Installation detail and ingest-key management for a vessel device.',
})
</script>

<template>
  <div v-if="detail" class="space-y-8">
    <UPageHero
      :title="detail.installation.label"
      :description="`Linked to ${detail.installation.vesselName}. Issue ingest keys and stage your collector command here.`"
    >
      <template #links>
        <UButton
          :to="`/dashboard/vessels/${detail.installation.vesselSlug}`"
          color="neutral"
          variant="soft"
          icon="i-lucide-arrow-left"
        >
          Back to vessel
        </UButton>
      </template>
    </UPageHero>

    <InstallationCredentialPanel :installation="detail.installation" :initial-keys="detail.keys" />
  </div>
</template>
