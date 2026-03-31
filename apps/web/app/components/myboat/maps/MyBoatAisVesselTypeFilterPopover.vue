<script setup lang="ts">
import type { AisVesselCategoryKey } from './map-support'
import { AIS_VESSEL_CATEGORY_FILTER_OPTIONS } from './map-support'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    size?: 'xs' | 'sm'
  }>(),
  {
    disabled: false,
    size: 'sm',
  },
)

const hiddenKeys = defineModel<AisVesselCategoryKey[]>('hiddenKeys', {
  default: () => [],
})

const isOpen = shallowRef(false)

const hiddenSet = computed(() => new Set(hiddenKeys.value))

function isCategoryVisible(key: AisVesselCategoryKey) {
  return !hiddenSet.value.has(key)
}

function toggleCategory(key: AisVesselCategoryKey) {
  if (props.disabled) {
    return
  }

  const next = new Set(hiddenSet.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }

  hiddenKeys.value = [...next]
}

function showAllCategories() {
  if (props.disabled) {
    return
  }

  hiddenKeys.value = []
}

const filterActiveCount = computed(() => hiddenKeys.value.length)
</script>

<template>
  <ClientOnly>
    <UPopover v-model:open="isOpen" :content="{ align: 'end', side: 'bottom', sideOffset: 8 }">
      <UChip
        :show="filterActiveCount > 0"
        inset
        color="primary"
        :size="size === 'xs' ? 'sm' : 'md'"
      >
        <UButton
          color="neutral"
          variant="soft"
          :size="size"
          icon="i-lucide-filter"
          :disabled="disabled"
          aria-label="Filter AIS contacts by vessel type"
        >
          Types
        </UButton>
      </UChip>

      <template #content>
        <div class="w-72 space-y-3 p-4">
          <div>
            <p class="text-[11px] uppercase tracking-[0.22em] text-muted">AIS vessel types</p>
            <p class="mt-2 text-sm text-muted">
              Turn categories off to hide those contacts from the chart. Your vessel is not
              filtered.
            </p>
          </div>

          <div class="max-h-64 space-y-1 overflow-y-auto pr-1">
            <UButton
              v-for="row in AIS_VESSEL_CATEGORY_FILTER_OPTIONS"
              :key="row.key"
              class="w-full justify-start"
              type="button"
              :color="isCategoryVisible(row.key) ? 'primary' : 'neutral'"
              :variant="isCategoryVisible(row.key) ? 'soft' : 'outline'"
              size="xs"
              :disabled="disabled"
              @click.stop="toggleCategory(row.key)"
            >
              <span class="truncate text-left">{{ row.label }}</span>
            </UButton>
          </div>

          <UButton
            class="w-full justify-center"
            color="neutral"
            variant="ghost"
            size="xs"
            type="button"
            :disabled="disabled || filterActiveCount === 0"
            @click.stop="showAllCategories"
          >
            Show all types
          </UButton>
        </div>
      </template>
    </UPopover>
  </ClientOnly>
</template>
