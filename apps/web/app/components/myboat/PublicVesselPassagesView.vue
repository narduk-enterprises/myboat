<script setup lang="ts">
import type { PublicVesselDetailResponse } from '~/types/myboat'

defineProps<{
  detail: PublicVesselDetailResponse
}>()
</script>

<template>
  <div data-testid="public-vessel-passages-view" class="space-y-8">
    <section class="public-hero px-6 py-10 shadow-overlay sm:px-10">
      <div class="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-4">
          <div class="marine-kicker w-fit">Public passage log</div>
          <div>
            <h1 class="font-display text-5xl text-default">{{ detail.vessel.name }}</h1>
            <p class="mt-3 max-w-2xl text-lg text-muted">
              Search the shared route log, open a single stored track, and keep the public vessel
              story separate from the live bridge board.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <UButton
            :to="`/${detail.profile.username}/${detail.vessel.slug}`"
            color="neutral"
            variant="soft"
            icon="i-lucide-radar"
          >
            Back to live view
          </UButton>
          <UButton
            :to="`/${detail.profile.username}`"
            color="neutral"
            variant="soft"
            icon="i-lucide-user-round"
          >
            Open captain page
          </UButton>
          <UButton to="/register" color="primary" icon="i-lucide-user-round-plus">
            Create account
          </UButton>
        </div>
      </div>
    </section>

    <PassagesWorkspace
      :vessel="detail.vessel"
      :passages="detail.passages"
      :waypoints="detail.waypoints"
      :media="detail.media"
      access-scope="public"
      :public-username="detail.profile.username"
      :public-vessel-slug="detail.vessel.slug"
      title="Public passages"
      description="Browse the captain-approved route log, focus a single public passage, and keep the chart anchored on stored route memory."
      :map-persist-key="`public-passages:${detail.profile.username}/${detail.vessel.slug}`"
    />
  </div>
</template>
