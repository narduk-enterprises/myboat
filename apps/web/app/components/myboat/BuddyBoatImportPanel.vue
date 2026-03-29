<script setup lang="ts">
import { z } from 'zod'
import type {
  FollowedVesselImportItem,
  FollowedVesselImportResponse,
  FollowedVesselSummary,
} from '~/types/myboat'

const emit = defineEmits<{
  imported: [vessels: FollowedVesselSummary[]]
}>()

const toast = useToast()
const { importFollowedVessels, pending } = useImportFollowedVessels()

const payloadSchema = z.object({
  payload: z
    .string()
    .trim()
    .min(2, 'Paste a JSON array first.')
    .max(50_000, 'Import JSON is too large.'),
})

const importItemSchema = z.object({
  mmsi: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'Each MMSI must be exactly 9 digits.'),
  name: z.string().trim().min(1, 'Each entry needs a name.').max(120),
  imo: z.string().trim().max(20).optional().nullable(),
  callSign: z.string().trim().max(40).optional().nullable(),
  destination: z.string().trim().max(120).optional().nullable(),
})

const state = reactive({
  payload: '',
})

const exampleJson = `[
  {
    "mmsi": "368362150",
    "name": "AIDA"
  },
  {
    "mmsi": "316045151",
    "name": "ALECTRYON"
  }
]`

function getErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || 'Import JSON is invalid.'
  }

  if (error instanceof SyntaxError) {
    return 'Import JSON could not be parsed. Check for missing commas or quotes.'
  }

  if (error && typeof error === 'object') {
    const maybeError = error as {
      data?: { statusMessage?: string; message?: string }
      message?: string
      statusMessage?: string
    }

    return (
      maybeError.data?.statusMessage ||
      maybeError.statusMessage ||
      maybeError.data?.message ||
      maybeError.message ||
      'Import failed.'
    )
  }

  return 'Import failed.'
}

function parseImportPayload(rawPayload: string): FollowedVesselImportItem[] {
  const parsed = JSON.parse(rawPayload) as unknown
  const candidateItems = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'items' in parsed
      ? (parsed as { items: unknown }).items
      : null

  if (!candidateItems) {
    throw new Error('Use a JSON array or an object with an items array.')
  }

  const items = z.array(importItemSchema).min(1).max(200).parse(candidateItems)

  return items.filter(
    (item, index, collection) =>
      collection.findIndex((candidate) => candidate.mmsi === item.mmsi) === index,
  )
}

async function onSubmit() {
  try {
    const items = parseImportPayload(state.payload)
    const response: FollowedVesselImportResponse = await importFollowedVessels(items)

    emit('imported', response.imported)
    state.payload = ''

    toast.add({
      title: 'Buddy boats imported',
      description: `Imported ${response.imported.length} buddy boat${response.imported.length === 1 ? '' : 's'} from JSON.`,
      color: 'success',
    })
  } catch (error) {
    toast.add({
      title: 'Unable to import buddy boats',
      description: getErrorMessage(error),
      color: 'error',
    })
  }
}
</script>

<template>
  <UCard class="border-default/80 bg-default/90 shadow-card">
    <template #header>
      <div>
        <h3 class="font-display text-xl text-default">Import buddy boats</h3>
        <p class="mt-1 text-sm text-muted">
          Paste a JSON list of `{ mmsi, name }` entries. The importer enriches boats from the local
          AIS cache when that data already exists.
        </p>
      </div>
    </template>

    <div class="space-y-4">
      <UAlert
        color="neutral"
        variant="soft"
        title="Accepted formats"
        description="Use either a JSON array or an object with an items array. Duplicate MMSIs are ignored."
      />

      <UForm :schema="payloadSchema" :state="state" class="space-y-4" @submit.prevent="onSubmit">
        <UFormField name="payload" label="JSON payload">
          <UTextarea
            v-model="state.payload"
            class="w-full font-mono text-xs"
            :rows="10"
            :placeholder="exampleJson"
          />
        </UFormField>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-muted">
            MarineTraffic exports usually only need `mmsi` and `name`.
          </p>

          <UButton
            type="submit"
            color="primary"
            icon="i-lucide-file-up"
            :loading="pending"
            :disabled="!state.payload.trim()"
          >
            Import JSON
          </UButton>
        </div>
      </UForm>
    </div>
  </UCard>
</template>
