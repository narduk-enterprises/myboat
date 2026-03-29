import type { H3Event } from 'h3'
import { and, eq, isNull } from 'drizzle-orm'
import type { ObservedVesselIdentitySummary } from '../../app/types/myboat'
import {
  vesselInstallationObservedIdentities,
  vesselInstallations,
  vesselObservedIdentities,
} from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'
import type { IngestDelta, IngestDeltaValue } from '#server/utils/telemetry'

export type ObservedIdentitySource = 'signalk_delta' | 'signalk_rest'

export interface ObservedIdentityPatch {
  selfContext?: string
  mmsi?: string
  observedName?: string
  callSign?: string
  shipType?: string
  shipTypeCode?: number
  lengthOverall?: number
  beam?: number
  draft?: number
  registrationNumber?: string
  imo?: string
}

type IdentityRowShape = {
  source: string
  observedAt: string | null
  selfContext: string | null
  mmsi: string | null
  observedName: string | null
  callSign: string | null
  shipType: string | null
  shipTypeCode: number | null
  lengthOverall: number | null
  beam: number | null
  draft: number | null
  registrationNumber: string | null
  imo: string | null
  sourceInstallationId?: string | null
}

const OBSERVED_IDENTITY_STRING_LIMITS = {
  callSign: 40,
  imo: 32,
  observedName: 120,
  registrationNumber: 80,
  selfContext: 255,
  shipType: 120,
} as const

function normalizeContext(value: string | undefined) {
  return value?.trim() || ''
}

function isSelfContext(context: string | undefined, selfContext: string | undefined) {
  const normalizedContext = normalizeContext(context)
  const normalizedSelfContext = normalizeContext(selfContext)

  if (!normalizedContext || normalizedContext === 'self' || normalizedContext === 'vessels.self') {
    return true
  }

  return Boolean(normalizedSelfContext && normalizedContext === normalizedSelfContext)
}

function normalizeTrimmedString(value: unknown, maxLength: number) {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized ? normalized.slice(0, maxLength) : undefined
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value).slice(0, maxLength)
  }

  return
}

function normalizeFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return
}

function normalizeMmsi(value: unknown) {
  const normalized = normalizeTrimmedString(value, 32)
  if (!normalized) {
    return
  }

  const match = normalized.match(/\b(\d{9})\b/)
  return match?.[1]
}

function extractMmsiFromContext(context: string | undefined) {
  const normalized = normalizeContext(context)
  if (!normalized) {
    return
  }

  const match = normalized.match(/mmsi:(\d{9})/i)
  return match?.[1]
}

function unwrapSignalKValue(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'value' in value &&
    Object.keys(value).length <= 6
  ) {
    return (value as { value?: unknown }).value
  }

  return value
}

function readSignalKPathValue(model: unknown, path: string): unknown {
  const segments = path.split('.')
  let current = model

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return unwrapSignalKValue(current)
}

function looksLikeSignalKVesselModel(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return ['name', 'navigation', 'communication', 'design', 'registrations'].some(
    (key) => key in candidate,
  )
}

function unwrapSignalKVesselModel(model: unknown) {
  if (looksLikeSignalKVesselModel(model)) {
    return model
  }

  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return null
  }

  const values = Object.values(model as Record<string, unknown>)
  if (values.length === 1 && looksLikeSignalKVesselModel(values[0])) {
    return values[0]
  }

  return null
}

function applyObservedIdentityValue(patch: ObservedIdentityPatch, item: IngestDeltaValue) {
  const { path, value } = item

  if (path === 'name') {
    patch.observedName = normalizeTrimmedString(value, OBSERVED_IDENTITY_STRING_LIMITS.observedName)
    return
  }

  if (path === 'communication.callsignVhf' || path === 'communication.callsign') {
    patch.callSign = normalizeTrimmedString(value, OBSERVED_IDENTITY_STRING_LIMITS.callSign)
    return
  }

  if (path === 'design.type') {
    patch.shipType = normalizeTrimmedString(value, OBSERVED_IDENTITY_STRING_LIMITS.shipType)
    return
  }

  if (path === 'design.aisShipType') {
    patch.shipTypeCode = normalizeFiniteNumber(value)
    return
  }

  if (path === 'design.length.overall') {
    patch.lengthOverall = normalizeFiniteNumber(value)
    return
  }

  if (path === 'design.length' && value && typeof value === 'object') {
    patch.lengthOverall = normalizeFiniteNumber((value as { overall?: unknown }).overall)
    return
  }

  if (path === 'design.beam') {
    patch.beam = normalizeFiniteNumber(value)
    return
  }

  if (path === 'design.draft.current' || path === 'design.draft.maximum') {
    patch.draft = normalizeFiniteNumber(value)
    return
  }

  if (path === 'design.draft' && value && typeof value === 'object') {
    const draft = value as { current?: unknown; maximum?: unknown }
    patch.draft = normalizeFiniteNumber(draft.current) ?? normalizeFiniteNumber(draft.maximum)
    return
  }

  if (path === 'registrations.mmsi') {
    patch.mmsi = normalizeMmsi(value)
    return
  }

  if (path === 'registrations.imo') {
    patch.imo = normalizeTrimmedString(value, OBSERVED_IDENTITY_STRING_LIMITS.imo)
    return
  }

  if (
    path === 'registrations.national' ||
    path === 'registrations.other' ||
    path === 'registrations.registration'
  ) {
    patch.registrationNumber = normalizeTrimmedString(
      value,
      OBSERVED_IDENTITY_STRING_LIMITS.registrationNumber,
    )
  }
}

function hasObservedIdentityPatchData(patch: ObservedIdentityPatch) {
  return Object.values(patch).some((value) => value !== undefined)
}

export function mergeObservedIdentityPatches(
  current: ObservedIdentityPatch | null | undefined,
  patch: ObservedIdentityPatch | null | undefined,
) {
  if (!current && !patch) {
    return null
  }

  return {
    ...(current || {}),
    ...(patch || {}),
  } satisfies ObservedIdentityPatch
}

export function extractObservedSelfIdentityPatchFromDelta(delta: IngestDelta) {
  if (!isSelfContext(delta.context, delta.self)) {
    return null
  }

  const selfContext = normalizeContext(delta.self) || normalizeContext(delta.context)
  const patch: ObservedIdentityPatch = {}

  if (selfContext) {
    patch.selfContext = selfContext.slice(0, OBSERVED_IDENTITY_STRING_LIMITS.selfContext)
  }

  patch.mmsi = extractMmsiFromContext(selfContext)

  for (const update of delta.updates) {
    for (const item of update.values) {
      applyObservedIdentityValue(patch, item)
    }
  }

  return hasObservedIdentityPatchData(patch) ? patch : null
}

export function extractObservedSelfIdentityPatchFromSignalKModel(
  model: unknown,
  fallbackSelfContext?: string | null,
) {
  const vesselModel = unwrapSignalKVesselModel(model)
  if (!vesselModel) {
    return null
  }

  const patch: ObservedIdentityPatch = {}
  const selfContext = normalizeContext(fallbackSelfContext || undefined)
  if (selfContext) {
    patch.selfContext = selfContext.slice(0, OBSERVED_IDENTITY_STRING_LIMITS.selfContext)
    patch.mmsi = extractMmsiFromContext(selfContext)
  }

  patch.observedName = normalizeTrimmedString(
    readSignalKPathValue(vesselModel, 'name'),
    OBSERVED_IDENTITY_STRING_LIMITS.observedName,
  )
  patch.callSign = normalizeTrimmedString(
    readSignalKPathValue(vesselModel, 'communication.callsignVhf') ??
      readSignalKPathValue(vesselModel, 'communication.callsign'),
    OBSERVED_IDENTITY_STRING_LIMITS.callSign,
  )
  patch.shipType = normalizeTrimmedString(
    readSignalKPathValue(vesselModel, 'design.type'),
    OBSERVED_IDENTITY_STRING_LIMITS.shipType,
  )
  patch.shipTypeCode = normalizeFiniteNumber(
    readSignalKPathValue(vesselModel, 'design.aisShipType'),
  )
  patch.lengthOverall = normalizeFiniteNumber(
    readSignalKPathValue(vesselModel, 'design.length.overall'),
  )
  patch.beam = normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.beam'))
  patch.draft =
    normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.draft.current')) ??
    normalizeFiniteNumber(readSignalKPathValue(vesselModel, 'design.draft.maximum'))
  patch.imo = normalizeTrimmedString(
    readSignalKPathValue(vesselModel, 'registrations.imo'),
    OBSERVED_IDENTITY_STRING_LIMITS.imo,
  )
  patch.registrationNumber = normalizeTrimmedString(
    readSignalKPathValue(vesselModel, 'registrations.national') ??
      readSignalKPathValue(vesselModel, 'registrations.other') ??
      readSignalKPathValue(vesselModel, 'registrations.registration'),
    OBSERVED_IDENTITY_STRING_LIMITS.registrationNumber,
  )
  patch.mmsi =
    patch.mmsi ??
    normalizeMmsi(readSignalKPathValue(vesselModel, 'registrations.mmsi')) ??
    normalizeMmsi(readSignalKPathValue(vesselModel, 'mmsi'))

  return hasObservedIdentityPatchData(patch) ? patch : null
}

function serializeObservedIdentityRow(row: IdentityRowShape | null | undefined) {
  if (!row) {
    return null
  }

  return {
    source: row.source,
    observedAt: row.observedAt,
    selfContext: row.selfContext,
    mmsi: row.mmsi,
    observedName: row.observedName,
    callSign: row.callSign,
    shipType: row.shipType,
    shipTypeCode: row.shipTypeCode,
    lengthOverall: row.lengthOverall,
    beam: row.beam,
    draft: row.draft,
    registrationNumber: row.registrationNumber,
    imo: row.imo,
    sourceInstallationId: row.sourceInstallationId ?? null,
  } satisfies ObservedVesselIdentitySummary
}

export function serializeObservedIdentitySummary(row: IdentityRowShape | null | undefined) {
  return serializeObservedIdentityRow(row)
}

function buildMergedIdentityValues(input: {
  current?: Partial<IdentityRowShape> | null
  patch: ObservedIdentityPatch
  observedAt: string
  source: ObservedIdentitySource
}) {
  const current = input.current || null

  return {
    source: input.source,
    observedAt: input.observedAt,
    selfContext: input.patch.selfContext ?? current?.selfContext ?? null,
    mmsi: input.patch.mmsi ?? current?.mmsi ?? null,
    observedName: input.patch.observedName ?? current?.observedName ?? null,
    callSign: input.patch.callSign ?? current?.callSign ?? null,
    shipType: input.patch.shipType ?? current?.shipType ?? null,
    shipTypeCode: input.patch.shipTypeCode ?? current?.shipTypeCode ?? null,
    lengthOverall: input.patch.lengthOverall ?? current?.lengthOverall ?? null,
    beam: input.patch.beam ?? current?.beam ?? null,
    draft: input.patch.draft ?? current?.draft ?? null,
    registrationNumber: input.patch.registrationNumber ?? current?.registrationNumber ?? null,
    imo: input.patch.imo ?? current?.imo ?? null,
  } satisfies IdentityRowShape
}

export async function upsertInstallationObservedIdentity(input: {
  event: H3Event
  installationId: string
  vesselId: string
  patch: ObservedIdentityPatch
  observedAt: string
  source: ObservedIdentitySource
}) {
  if (!hasObservedIdentityPatchData(input.patch)) {
    return null
  }

  const db = useAppDatabase(input.event)
  const now = new Date().toISOString()
  const current = await db
    .select()
    .from(vesselInstallationObservedIdentities)
    .where(eq(vesselInstallationObservedIdentities.installationId, input.installationId))
    .get()

  const merged = buildMergedIdentityValues({
    current,
    patch: input.patch,
    observedAt: input.observedAt,
    source: input.source,
  })

  if (current) {
    await db
      .update(vesselInstallationObservedIdentities)
      .set({
        vesselId: input.vesselId,
        ...merged,
        updatedAt: now,
      })
      .where(eq(vesselInstallationObservedIdentities.installationId, input.installationId))
  } else {
    await db.insert(vesselInstallationObservedIdentities).values({
      installationId: input.installationId,
      vesselId: input.vesselId,
      ...merged,
      createdAt: now,
      updatedAt: now,
    })
  }

  return serializeObservedIdentityRow(merged)
}

export async function syncVesselObservedIdentityFromPrimaryInstallation(
  event: H3Event,
  vesselId: string,
) {
  const db = useAppDatabase(event)
  const now = new Date().toISOString()

  const primaryInstallation = await db
    .select({ id: vesselInstallations.id })
    .from(vesselInstallations)
    .where(
      and(
        eq(vesselInstallations.vesselId, vesselId),
        eq(vesselInstallations.isPrimary, true),
        isNull(vesselInstallations.archivedAt),
      ),
    )
    .get()

  if (!primaryInstallation) {
    await db.delete(vesselObservedIdentities).where(eq(vesselObservedIdentities.vesselId, vesselId))
    return null
  }

  const installationIdentity = await db
    .select()
    .from(vesselInstallationObservedIdentities)
    .where(eq(vesselInstallationObservedIdentities.installationId, primaryInstallation.id))
    .get()

  if (!installationIdentity) {
    await db.delete(vesselObservedIdentities).where(eq(vesselObservedIdentities.vesselId, vesselId))
    return null
  }

  const current = await db
    .select()
    .from(vesselObservedIdentities)
    .where(eq(vesselObservedIdentities.vesselId, vesselId))
    .get()

  if (current) {
    await db
      .update(vesselObservedIdentities)
      .set({
        sourceInstallationId: primaryInstallation.id,
        source: installationIdentity.source,
        selfContext: installationIdentity.selfContext,
        mmsi: installationIdentity.mmsi,
        observedName: installationIdentity.observedName,
        callSign: installationIdentity.callSign,
        shipType: installationIdentity.shipType,
        shipTypeCode: installationIdentity.shipTypeCode,
        lengthOverall: installationIdentity.lengthOverall,
        beam: installationIdentity.beam,
        draft: installationIdentity.draft,
        registrationNumber: installationIdentity.registrationNumber,
        imo: installationIdentity.imo,
        observedAt: installationIdentity.observedAt,
        updatedAt: now,
      })
      .where(eq(vesselObservedIdentities.vesselId, vesselId))
  } else {
    await db.insert(vesselObservedIdentities).values({
      vesselId,
      sourceInstallationId: primaryInstallation.id,
      source: installationIdentity.source,
      selfContext: installationIdentity.selfContext,
      mmsi: installationIdentity.mmsi,
      observedName: installationIdentity.observedName,
      callSign: installationIdentity.callSign,
      shipType: installationIdentity.shipType,
      shipTypeCode: installationIdentity.shipTypeCode,
      lengthOverall: installationIdentity.lengthOverall,
      beam: installationIdentity.beam,
      draft: installationIdentity.draft,
      registrationNumber: installationIdentity.registrationNumber,
      imo: installationIdentity.imo,
      observedAt: installationIdentity.observedAt,
      createdAt: now,
      updatedAt: now,
    })
  }

  return serializeObservedIdentityRow({
    sourceInstallationId: primaryInstallation.id,
    source: installationIdentity.source,
    selfContext: installationIdentity.selfContext,
    mmsi: installationIdentity.mmsi,
    observedName: installationIdentity.observedName,
    callSign: installationIdentity.callSign,
    shipType: installationIdentity.shipType,
    shipTypeCode: installationIdentity.shipTypeCode,
    lengthOverall: installationIdentity.lengthOverall,
    beam: installationIdentity.beam,
    draft: installationIdentity.draft,
    registrationNumber: installationIdentity.registrationNumber,
    imo: installationIdentity.imo,
    observedAt: installationIdentity.observedAt,
  })
}
