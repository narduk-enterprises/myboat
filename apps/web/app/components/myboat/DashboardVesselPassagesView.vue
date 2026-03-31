<script setup lang="ts">
import type { VesselDetailResponse } from '~/types/myboat'

const props = defineProps<{
  detail: VesselDetailResponse
}>()

const { updateMedia } = useUpdateVesselMedia(props.detail.vessel.slug)
const pendingCoverIds = ref<string[]>([])
const attachedPassageMedia = computed(() =>
  props.detail.media.filter((item) => item.matchStatus === 'attached' && Boolean(item.passageId)),
)
const reviewMedia = computed(() =>
  props.detail.media.filter((item) => item.matchStatus === 'review'),
)
const generalMedia = computed(() =>
  props.detail.media.filter((item) => item.matchStatus === 'attached' && !item.passageId),
)

async function handleSetCover(mediaId: string) {
  pendingCoverIds.value = [...pendingCoverIds.value, mediaId]

  try {
    await updateMedia(mediaId, {
      isCover: true,
      matchStatus: 'attached',
    })
    await refreshNuxtData(`myboat-vessel-${props.detail.vessel.slug}`)
  } finally {
    pendingCoverIds.value = pendingCoverIds.value.filter((candidate) => candidate !== mediaId)
  }
}
</script>

<template>
  <div class="space-y-6">
    <PassagesWorkspace
      :vessel="detail.vessel"
      :passages="detail.passages"
      :waypoints="detail.waypoints"
      :media="detail.media"
      title="Vessel passage archive"
      description="Keep route focus, playback state, and the searchable archive beside each other for this vessel."
      :map-persist-key="`dashboard-vessel-passages:${detail.vessel.slug}`"
      :show-header="false"
      :show-media-strip="false"
    />

    <PassageTimeline
      :passages="detail.passages"
      :media="attachedPassageMedia"
      editable
      :pending-media-ids="pendingCoverIds"
      @set-cover="handleSetCover"
    />

    <PassageMediaReviewQueue
      v-if="reviewMedia.length"
      :media="reviewMedia"
      :passages="detail.passages"
      :vessel-slug="detail.vessel.slug"
    />

    <MediaStrip v-if="generalMedia.length" :media="generalMedia" />
  </div>
</template>
