<script setup lang="ts">
import type { MediaItemSummary, PassageSummary } from '~/types/myboat'
import { formatTimestamp } from '~/utils/marine'

interface LightboxMediaItem {
  src: string
  alt: string
  caption?: string
}

const props = withDefaults(
  defineProps<{
    passages: PassageSummary[]
    media?: MediaItemSummary[]
    editable?: boolean
    pendingMediaIds?: string[]
  }>(),
  {
    media: () => [],
    editable: false,
    pendingMediaIds: () => [],
  },
)

const emit = defineEmits<{
  setCover: [mediaId: string]
}>()

const lightboxOpen = ref(false)
const lightboxItems = ref<LightboxMediaItem[]>([])
const lightboxStartIndex = ref(0)

const mediaByPassageId = computed(() => {
  const grouped = new Map<string, MediaItemSummary[]>()

  for (const item of props.media) {
    if (!item.passageId || item.matchStatus !== 'attached') {
      continue
    }

    const items = grouped.get(item.passageId) || []
    items.push(item)
    grouped.set(item.passageId, items)
  }

  for (const items of grouped.values()) {
    items.sort((left, right) => {
      if (left.isCover !== right.isCover) {
        return left.isCover ? -1 : 1
      }

      return (right.capturedAt || '').localeCompare(left.capturedAt || '')
    })
  }

  return grouped
})

const passageCards = computed(() =>
  props.passages.map((passage) => {
    const media = mediaByPassageId.value.get(passage.id) || []
    const cover = media.find((item) => item.isCover) || media[0] || null
    const gallery = cover
      ? media.filter((item) => item.id !== cover.id).slice(0, 2)
      : media.slice(0, 2)
    const hiddenCount = Math.max(0, media.length - (cover ? 1 : 0) - gallery.length)

    return {
      passage,
      media,
      cover,
      gallery,
      hiddenCount,
    }
  }),
)

function openGallery(media: MediaItemSummary[], startId?: string) {
  lightboxItems.value = media.map((item) => ({
    src: item.imageUrl,
    alt: item.title,
    caption: item.caption || undefined,
  }))
  lightboxStartIndex.value = startId
    ? Math.max(
        0,
        media.findIndex((item) => item.id === startId),
      )
    : 0
  lightboxOpen.value = true
}

function isPending(mediaId: string) {
  return props.pendingMediaIds.includes(mediaId)
}
</script>

<template>
  <UCard
    data-testid="vessel-detail-passage-timeline"
    class="chart-surface rounded-[1.75rem] shadow-card"
  >
    <template #header>
      <div>
        <h3 class="font-display text-lg text-default sm:text-xl">Passages</h3>
        <p class="mt-1 text-sm text-muted">Recent moves, route history, and historical context.</p>
      </div>
    </template>

    <div v-if="passages.length" class="space-y-3 sm:space-y-4">
      <article
        v-for="card in passageCards"
        :key="card.passage.id"
        class="rounded-2xl border border-default bg-elevated/70 px-4 py-4"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <p class="font-medium text-default">{{ card.passage.title }}</p>
            <p class="mt-1 text-sm text-muted break-words">
              {{ card.passage.departureName || 'Departure' }}
              <span class="text-dimmed">→</span>
              {{ card.passage.arrivalName || 'Arrival pending' }}
            </p>
          </div>
          <UBadge color="neutral" variant="subtle" class="self-start">
            {{
              card.passage.distanceNm ? `${card.passage.distanceNm.toFixed(0)} nm` : 'Draft route'
            }}
          </UBadge>
        </div>

        <div
          v-if="card.cover"
          class="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.65fr)]"
        >
          <div class="space-y-3">
            <UButton
              color="neutral"
              variant="ghost"
              class="group relative block h-full w-full overflow-hidden rounded-[1.35rem] border border-default/70 bg-default/80 p-0"
              @click="openGallery(card.media, card.cover.id)"
            >
              <NuxtImg
                :src="card.cover.imageUrl"
                :alt="card.cover.title"
                width="1280"
                height="720"
                class="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.015] sm:h-64"
              />
              <div
                class="pointer-events-none absolute inset-0 bg-linear-to-t from-black/65 via-black/10 to-transparent"
              />
              <div
                class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 py-4 text-left"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-white">
                    {{ card.cover.title }}
                  </p>
                  <p v-if="card.cover.caption" class="mt-1 line-clamp-2 text-xs text-white/80">
                    {{ card.cover.caption }}
                  </p>
                </div>
                <div
                  class="shrink-0 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white"
                >
                  {{ card.media.length }} photo{{ card.media.length === 1 ? '' : 's' }}
                </div>
              </div>
            </UButton>

            <div class="flex flex-wrap items-center gap-2">
              <UBadge color="primary" variant="soft">
                {{ card.cover.sharePublic ? 'Public' : 'Owner only' }}
              </UBadge>
              <UBadge v-if="card.cover.isCover" color="neutral" variant="soft">Cover image</UBadge>
              <UButton
                v-else-if="editable"
                color="neutral"
                variant="soft"
                size="xs"
                :loading="isPending(card.cover.id)"
                @click="emit('setCover', card.cover.id)"
              >
                Set as cover
              </UButton>
            </div>
          </div>

          <div v-if="card.gallery.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div v-for="item in card.gallery" :key="item.id" class="space-y-2">
              <UButton
                color="neutral"
                variant="ghost"
                class="group relative block w-full overflow-hidden rounded-[1.2rem] border border-default/70 bg-default/80 p-0"
                @click="openGallery(card.media, item.id)"
              >
                <NuxtImg
                  :src="item.imageUrl"
                  :alt="item.title"
                  width="640"
                  height="420"
                  class="h-32 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
                <div
                  v-if="card.hiddenCount && item.id === card.gallery[card.gallery.length - 1]?.id"
                  class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white"
                >
                  +{{ card.hiddenCount }} more
                </div>
              </UButton>

              <div class="flex flex-wrap items-center gap-2">
                <p class="min-w-0 flex-1 truncate text-xs text-muted">{{ item.title }}</p>
                <UBadge v-if="item.isCover" color="neutral" variant="soft">Cover</UBadge>
                <UButton
                  v-else-if="editable"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :loading="isPending(item.id)"
                  @click="emit('setCover', item.id)"
                >
                  Set cover
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <p v-if="card.passage.summary" class="mt-3 text-sm leading-6 text-muted">
          {{ card.passage.summary }}
        </p>
        <p class="mt-3 text-xs leading-5 text-muted">
          {{ formatTimestamp(card.passage.startedAt) }}
          <span v-if="card.passage.endedAt">
            · Arrived {{ formatTimestamp(card.passage.endedAt) }}
          </span>
        </p>
      </article>
    </div>

    <MarineEmptyState
      v-else
      icon="i-lucide-route"
      title="No passages logged yet"
      description="The route history surface is ready for telemetry-backed passages, imported tracks, and retrospective voyage notes."
      compact
    />

    <AppLightbox v-model="lightboxOpen" :items="lightboxItems" :start-index="lightboxStartIndex" />
  </UCard>
</template>
