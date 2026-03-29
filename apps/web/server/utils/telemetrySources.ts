import type {
  PublisherRole,
  SourceInventorySnapshot,
  TelemetrySelectionResult,
} from '@myboat/telemetry-source-policy'
import {
  TELEMETRY_SOURCE_POLICY_VERSION,
  classifySignalKSourceFamily,
  normalizeTelemetryPathFamily,
} from '@myboat/telemetry-source-policy'
import type { H3Event } from 'h3'
import type { VesselTelemetrySourcesResponse } from '~/types/myboat'
import { and, eq, isNull } from 'drizzle-orm'
import { vesselInstallationSourceStates, vesselInstallations } from '#server/database/app-schema'
import { useAppDatabase } from '#server/utils/database'

export type TelemetryDuplicateHotspot = {
  canonicalPath: string
  contenderCount: number
  contenderSourceIds: string[]
  pathFamily: string
  winnerSourceId: string | null
}

export type TelemetryTrackedWinner = {
  canonicalPath: string
  context: string
  pathFamily: string
  publisherRole: PublisherRole
  receivedAt: string
  sourceFamily: string
  sourceId: string
}

export type InstallationTelemetrySourceState = {
  duplicateHotspots: TelemetryDuplicateHotspot[]
  lastInventoryAt: string | null
  lastSelectionAt: string | null
  policyVersion: string
  publisherRole: PublisherRole
  shadowPublisherSeen: boolean
  sourceInventory: SourceInventorySnapshot | null
  trackedWinners: TelemetryTrackedWinner[]
}

export type TelemetrySourceInventoryIngressEntry = {
  family?: string
  id?: string
  label?: string
  metadata: Record<string, boolean | number | string | null>
  sourceId?: string
}

export function normalizeSourceInventoryIngress(input: {
  observedAt: string
  publisherRole: PublisherRole
  selfContext?: string | null
  sources: TelemetrySourceInventoryIngressEntry[]
}): SourceInventorySnapshot {
  const sources: SourceInventorySnapshot['sources'] = input.sources.map((source) => {
    const sourceId = source.sourceId || source.id || source.label || 'unknown'
    return {
      family: classifySignalKSourceFamily(sourceId),
      label: source.label || sourceId,
      metadata: source.metadata,
      sourceId,
    } satisfies SourceInventorySnapshot['sources'][number]
  })

  return {
    observedAt: input.observedAt,
    publisherRole: input.publisherRole,
    selfContext: input.selfContext || null,
    sourceCount: sources.length,
    sources,
  } satisfies SourceInventorySnapshot
}

function parseJsonValue<T>(raw: string | null | undefined, fallback: T) {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function parseSourceInventorySnapshot(raw: string | null | undefined) {
  const parsed = parseJsonValue<unknown>(raw, null)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !('sources' in parsed)) {
    return null
  }

  return parsed as SourceInventorySnapshot
}

function isTrackedWinnerPath(path: string) {
  return (
    path.startsWith('navigation.position.') ||
    path === 'navigation.speedOverGround' ||
    path === 'navigation.courseOverGroundTrue' ||
    path.startsWith('environment.wind.') ||
    path.startsWith('environment.current.') ||
    path.startsWith('environment.depth.') ||
    path.startsWith('electrical.batteries.tideyeBmv.') ||
    path.startsWith('electrical.switches.leopard.') ||
    /^propulsion\.[^.]+\.runTime/.test(path)
  )
}

export function buildTelemetrySelectionSummary(input: {
  observedAt: string
  selections: TelemetrySelectionResult[]
}) {
  const duplicateHotspots = input.selections
    .filter((selection) => selection.dropped.length > 0 || selection.debugOnly)
    .map((selection) => {
      const canonicalPath =
        selection.winner?.canonicalPath || selection.dropped[0]?.candidate.canonicalPath || ''
      return {
        canonicalPath,
        contenderCount: selection.dropped.length + (selection.winner ? 1 : 0),
        contenderSourceIds: Array.from(
          new Set(
            [
              selection.winner?.sourceId,
              ...selection.dropped.map((entry) => entry.candidate.sourceId),
            ].filter((value): value is string => typeof value === 'string' && value.length > 0),
          ),
        ).sort(),
        pathFamily: normalizeTelemetryPathFamily(canonicalPath),
        winnerSourceId: selection.winner?.sourceId || null,
      } satisfies TelemetryDuplicateHotspot
    })
    .filter((hotspot) => hotspot.canonicalPath.length > 0)

  const trackedWinners = input.selections
    .filter((selection) => selection.winner && isTrackedWinnerPath(selection.winner.canonicalPath))
    .map(
      (selection) =>
        ({
          canonicalPath: selection.winner!.canonicalPath,
          context: selection.winner!.context,
          pathFamily: normalizeTelemetryPathFamily(selection.winner!.canonicalPath),
          publisherRole: selection.winner!.publisherRole,
          receivedAt: selection.winner!.receivedAt,
          sourceFamily: selection.winner!.sourceFamily,
          sourceId: selection.winner!.sourceId,
        }) satisfies TelemetryTrackedWinner,
    )
    .sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath))

  return {
    duplicateHotspots,
    shadowPublisherSeen: input.selections.some(
      (selection) =>
        selection.shadowSourceSuppressed ||
        selection.winner?.publisherRole === 'shadow' ||
        selection.dropped.some((drop) => drop.candidate.publisherRole === 'shadow'),
    ),
    trackedWinners,
  }
}

export async function upsertInstallationSourceInventory(input: {
  event: H3Event
  installationId: string
  publisherRole: PublisherRole
  snapshot: SourceInventorySnapshot
  vesselId: string
}) {
  const db = useAppDatabase(input.event)
  const existing = await db
    .select({
      shadowPublisherSeen: vesselInstallationSourceStates.shadowPublisherSeen,
    })
    .from(vesselInstallationSourceStates)
    .where(eq(vesselInstallationSourceStates.installationId, input.installationId))
    .get()

  const now = new Date().toISOString()
  const shadowPublisherSeen = existing?.shadowPublisherSeen || input.publisherRole === 'shadow'

  await db
    .insert(vesselInstallationSourceStates)
    .values({
      installationId: input.installationId,
      vesselId: input.vesselId,
      publisherRole: input.publisherRole,
      policyVersion: TELEMETRY_SOURCE_POLICY_VERSION,
      sourceInventoryJson: JSON.stringify(input.snapshot),
      shadowPublisherSeen,
      lastInventoryObservedAt: input.snapshot.observedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: vesselInstallationSourceStates.installationId,
      set: {
        vesselId: input.vesselId,
        publisherRole: input.publisherRole,
        policyVersion: TELEMETRY_SOURCE_POLICY_VERSION,
        sourceInventoryJson: JSON.stringify(input.snapshot),
        shadowPublisherSeen,
        lastInventoryObservedAt: input.snapshot.observedAt,
        updatedAt: now,
      },
    })
}

export async function upsertTelemetrySourceInventory(
  input: Parameters<typeof upsertInstallationSourceInventory>[0],
) {
  return await upsertInstallationSourceInventory(input)
}

export async function upsertInstallationSelectionSummary(input: {
  duplicateHotspots: TelemetryDuplicateHotspot[]
  event: H3Event
  hasShadowPublisher: boolean
  installationId: string
  observedAt: string
  publisherRole: PublisherRole
  trackedWinners: TelemetryTrackedWinner[]
  vesselId: string
}) {
  const db = useAppDatabase(input.event)
  const existing = await db
    .select({
      shadowPublisherSeen: vesselInstallationSourceStates.shadowPublisherSeen,
      sourceInventoryJson: vesselInstallationSourceStates.sourceInventoryJson,
    })
    .from(vesselInstallationSourceStates)
    .where(eq(vesselInstallationSourceStates.installationId, input.installationId))
    .get()

  const now = new Date().toISOString()
  const shadowPublisherSeen =
    existing?.shadowPublisherSeen || input.hasShadowPublisher || input.publisherRole === 'shadow'

  await db
    .insert(vesselInstallationSourceStates)
    .values({
      installationId: input.installationId,
      vesselId: input.vesselId,
      publisherRole: input.publisherRole,
      policyVersion: TELEMETRY_SOURCE_POLICY_VERSION,
      sourceInventoryJson: existing?.sourceInventoryJson || '{"sources":[]}',
      currentWinnersJson: JSON.stringify(input.trackedWinners),
      duplicateHotspotsJson: JSON.stringify(input.duplicateHotspots),
      shadowPublisherSeen,
      lastSelectionObservedAt: input.observedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: vesselInstallationSourceStates.installationId,
      set: {
        vesselId: input.vesselId,
        publisherRole: input.publisherRole,
        policyVersion: TELEMETRY_SOURCE_POLICY_VERSION,
        currentWinnersJson: JSON.stringify(input.trackedWinners),
        duplicateHotspotsJson: JSON.stringify(input.duplicateHotspots),
        shadowPublisherSeen,
        lastSelectionObservedAt: input.observedAt,
        updatedAt: now,
      },
    })
}

export async function recordTelemetrySelectionState(input: {
  event: H3Event
  installationId: string
  observedAt: string
  publisherRole: PublisherRole
  results: TelemetrySelectionResult[]
  vesselId: string
}) {
  const summary = buildTelemetrySelectionSummary({
    observedAt: input.observedAt,
    selections: input.results,
  })

  await upsertInstallationSelectionSummary({
    duplicateHotspots: summary.duplicateHotspots,
    event: input.event,
    hasShadowPublisher: summary.shadowPublisherSeen,
    installationId: input.installationId,
    observedAt: input.observedAt,
    publisherRole: input.publisherRole,
    trackedWinners: summary.trackedWinners,
    vesselId: input.vesselId,
  })
}

export function hydrateInstallationTelemetrySourceState(row: {
  currentWinnersJson: string | null
  duplicateHotspotsJson: string | null
  lastInventoryObservedAt: string | null
  lastSelectionObservedAt: string | null
  policyVersion: string | null
  publisherRole: string | null
  shadowPublisherSeen: boolean | null
  sourceInventoryJson: string | null
}) {
  return {
    duplicateHotspots: parseJsonValue<TelemetryDuplicateHotspot[]>(row.duplicateHotspotsJson, []),
    lastInventoryAt: row.lastInventoryObservedAt,
    lastSelectionAt: row.lastSelectionObservedAt,
    policyVersion: row.policyVersion || TELEMETRY_SOURCE_POLICY_VERSION,
    publisherRole: row.publisherRole === 'shadow' ? 'shadow' : 'primary',
    shadowPublisherSeen: Boolean(row.shadowPublisherSeen),
    sourceInventory: parseSourceInventorySnapshot(row.sourceInventoryJson),
    trackedWinners: parseJsonValue<TelemetryTrackedWinner[]>(row.currentWinnersJson, []),
  } satisfies InstallationTelemetrySourceState
}

export async function getVesselTelemetrySources(
  event: H3Event,
  vesselId: string,
): Promise<VesselTelemetrySourcesResponse> {
  const db = useAppDatabase(event)
  const sourceStateRow = await db
    .select({
      currentWinnersJson: vesselInstallationSourceStates.currentWinnersJson,
      duplicateHotspotsJson: vesselInstallationSourceStates.duplicateHotspotsJson,
      installationId: vesselInstallations.id,
      installationLabel: vesselInstallations.label,
      lastInventoryObservedAt: vesselInstallationSourceStates.lastInventoryObservedAt,
      lastSelectionObservedAt: vesselInstallationSourceStates.lastSelectionObservedAt,
      policyVersion: vesselInstallationSourceStates.policyVersion,
      publisherRole: vesselInstallationSourceStates.publisherRole,
      shadowPublisherSeen: vesselInstallationSourceStates.shadowPublisherSeen,
      sourceInventoryJson: vesselInstallationSourceStates.sourceInventoryJson,
    })
    .from(vesselInstallations)
    .leftJoin(
      vesselInstallationSourceStates,
      eq(vesselInstallationSourceStates.installationId, vesselInstallations.id),
    )
    .where(
      and(
        eq(vesselInstallations.vesselId, vesselId),
        eq(vesselInstallations.isPrimary, true),
        isNull(vesselInstallations.archivedAt),
      ),
    )
    .get()

  if (!sourceStateRow) {
    throw createError({ statusCode: 404, message: 'Primary installation not found.' })
  }

  const hydratedState = sourceStateRow.policyVersion
    ? hydrateInstallationTelemetrySourceState({
        currentWinnersJson: sourceStateRow.currentWinnersJson || '[]',
        duplicateHotspotsJson: sourceStateRow.duplicateHotspotsJson || '[]',
        lastInventoryObservedAt: sourceStateRow.lastInventoryObservedAt,
        lastSelectionObservedAt: sourceStateRow.lastSelectionObservedAt,
        policyVersion: sourceStateRow.policyVersion || TELEMETRY_SOURCE_POLICY_VERSION,
        publisherRole: sourceStateRow.publisherRole || 'primary',
        shadowPublisherSeen: sourceStateRow.shadowPublisherSeen || false,
        sourceInventoryJson: sourceStateRow.sourceInventoryJson || 'null',
      })
    : {
        duplicateHotspots: [],
        lastInventoryAt: null,
        lastSelectionAt: null,
        policyVersion: TELEMETRY_SOURCE_POLICY_VERSION,
        publisherRole: 'primary' as const,
        shadowPublisherSeen: false,
        sourceInventory: null,
        trackedWinners: [],
      }

  return {
    duplicateHotspots: hydratedState.duplicateHotspots.map((hotspot) => ({
      canonicalPath: hotspot.canonicalPath,
      contenderCount: hotspot.contenderCount,
      contenderSourceIds: hotspot.contenderSourceIds,
      pathFamily: hotspot.pathFamily,
      winnerSourceId: hotspot.winnerSourceId,
    })),
    currentWinners: hydratedState.trackedWinners,
    latestSourceInventory: hydratedState.sourceInventory
      ? {
          observedAt: hydratedState.sourceInventory.observedAt,
          publisherRole: hydratedState.sourceInventory.publisherRole,
          selfContext: hydratedState.sourceInventory.selfContext,
          sourceCount: hydratedState.sourceInventory.sourceCount,
          sources: hydratedState.sourceInventory.sources.map((source) => ({
            family: source.family,
            label: source.label,
            metadata: source.metadata,
            sourceId: source.sourceId,
          })),
        }
      : null,
    policyVersion: hydratedState.policyVersion,
    primaryInstallation: {
      id: sourceStateRow.installationId,
      label: sourceStateRow.installationLabel,
      lastInventoryObservedAt: hydratedState.lastInventoryAt,
      lastSelectionObservedAt: hydratedState.lastSelectionAt,
      publisherRole: hydratedState.publisherRole,
    },
    shadowPublisherSeen: hydratedState.shadowPublisherSeen,
    vesselId,
  }
}
