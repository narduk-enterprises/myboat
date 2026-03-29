<script setup lang="ts">
import type { MediaItemSummary, PassageSummary } from '~/types/myboat'
import { formatTimestamp } from '~/utils/marine'

const props = defineProps<{
  media: MediaItemSummary[]
  passages: PassageSummary[]
  vesselSlug: string
}>()

const { updateMedia } = useUpdateVesselMedia(props.vesselSlug)
const selectedPassageIds = reactive<Record<string, string>>({})
const pendingMediaIds = ref<string[]>([])
const lightboxOpen = ref(false)
const lightboxItems = ref<Array<{ src: string; alt: string; caption?: string }>>([])

const passageOptions = computed(() =>
  props.passages.map((passage) => ({
    label: passage.title,
    value: passage.id,
  })),
)

watchEffect(() => {
  for (const item of props.media) {
    if (selectedPassageIds[item.id]) {
      continue
    }

    selectedPassageIds[item.id] = item.passageId || props.passages[0]?.id || ''
  }
})

function openPreview(item: MediaItemSummary) {
  lightboxItems.value = [
    {
      src: item.imageUrl,
      alt: item.title,
      caption: item.caption || undefined,
    },
  ]
  lightboxOpen.value = true
}

function isPending(mediaId: string) {
  return pendingMediaIds.value.includes(mediaId)
}

async function applyDecision(item: MediaItemSummary, sharePublic: boolean) {
  const selectedPassageId = selectedPassageIds[item.id]
  if (!selectedPassageId) {
    return
  }

  pendingMediaIds.value = [...pendingMediaIds.value, item.id]

  try {
    await updateMedia(item.id, {
      passageId: selectedPassageId,
      matchStatus: 'attached',
      sharePublic,
    })
    await refreshNuxtData(`myboat-vessel-${props.vesselSlug}`)
  } finally {
    pendingMediaIds.value = pendingMediaIds.value.filter((mediaId) => mediaId !== item.id)
  }
}
</script>

<template>
  <UCard
    v-if="media.length"
    data-testid="vessel-detail-media-review-queue"
    class="chart-surface rounded-[1.75rem] shadow-card"
  >
    <template #header>
      <div>
        <h3 class="font-display text-lg text-default sm:text-xl">Review queue</h3>
        <p class="mt-1 text-sm text-muted">
          These uploads landed near a passage window but still need a human decision before they
          become part of the public voyage story.
        </p>
      </div>
    </template>

    <div class="space-y-4">
      <article
        v-for="item in media"
        :key="item.id"
        class="grid gap-4 rounded-2xl border border-default bg-elevated/70 p-4 lg:grid-cols-[13rem_minmax(0,1fr)]"
      >
        <UButton
          color="neutral"
          variant="ghost"
          class="block overflow-hidden rounded-[1.2rem] border border-default/70 bg-default/80 p-0"
          @click="openPreview(item)"
        >
          <NuxtImg
            :src="item.imageUrl"
            :alt="item.title"
            width="640"
            height="480"
            class="h-44 w-full object-cover lg:h-full"
          />
        </UButton>

        <div class="space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium text-default">{{ item.title }}</p>
              <p class="mt-1 text-xs text-muted">{{ formatTimestamp(item.capturedAt) }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <UBadge color="warning" variant="soft">Needs review</UBadge>
              <UBadge v-if="item.matchScore !== null" color="neutral" variant="soft">
                {{ Math.round(item.matchScore * 100) }}% confidence
              </UBadge>
            </div>
          </div>

          <p v-if="item.matchReason" class="text-sm leading-6 text-muted">
            {{ item.matchReason }}
          </p>
          <p v-else-if="item.caption" class="text-sm leading-6 text-muted">
            {{ item.caption }}
          </p>

          <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <USelectMenu
              v-model="selectedPassageIds[item.id]"
              :items="passageOptions"
              value-key="value"
              label-key="label"
              class="w-full"
              :disabled="isPending(item.id)"
              placeholder="Select a passage"
            />

            <UButton
              color="primary"
              variant="solid"
              :disabled="!selectedPassageIds[item.id]"
              :loading="isPending(item.id)"
              @click="applyDecision(item, true)"
            >
              Approve & publish
            </UButton>

            <UButton
              color="neutral"
              variant="soft"
              :disabled="!selectedPassageIds[item.id]"
              :loading="isPending(item.id)"
              @click="applyDecision(item, false)"
            >
              Keep private
            </UButton>
          </div>
        </div>
      </article>
    </div>

    <AppLightbox v-model="lightboxOpen" :items="lightboxItems" />
  </UCard>
</template>
