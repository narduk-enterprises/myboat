import type { AisContactSummary, VesselSnapshotSummary } from '../app/types/myboat'

export type SelfSubscriptionLevel = 'none' | 'summary' | 'detail'
export type VesselLiveConnectionState = 'idle' | 'live' | 'offline'

export interface LiveDemand {
  selfLevel: SelfSubscriptionLevel
  ais: boolean
}

export interface VesselLiveSyncMessage {
  type: 'sync'
  snapshot: VesselSnapshotSummary | null
  aisContacts: AisContactSummary[]
  connectionState: VesselLiveConnectionState
  lastObservedAt: string | null
}

export interface VesselLiveSnapshotMessage {
  type: 'snapshot'
  snapshot: VesselSnapshotSummary
}

export interface VesselLiveAisUpsertMessage {
  type: 'ais_upsert'
  contact: AisContactSummary
}

export interface VesselLiveAisRemoveMessage {
  type: 'ais_remove'
  contactId: string
}

export interface VesselLiveStatusMessage {
  type: 'status'
  connectionState: VesselLiveConnectionState
  lastObservedAt: string | null
}

export interface VesselLiveDemandMessage {
  type: 'set_demand'
  demand?: Partial<LiveDemand>
  selfLevel?: SelfSubscriptionLevel
  ais?: boolean
}

export interface VesselLivePublishMessage {
  type: 'telemetry'
  snapshot?: VesselSnapshotSummary | null
  aisContacts?: AisContactSummary[]
  connectionState?: VesselLiveConnectionState
  lastObservedAt?: string | null
}

export type VesselLiveClientMessage = VesselLiveDemandMessage
export type VesselLiveServerMessage =
  | VesselLiveSyncMessage
  | VesselLiveSnapshotMessage
  | VesselLiveAisUpsertMessage
  | VesselLiveAisRemoveMessage
  | VesselLiveStatusMessage

export const DEFAULT_LIVE_DEMAND: LiveDemand = {
  selfLevel: 'none',
  ais: false,
}

export function normalizeLiveDemand(input: Partial<LiveDemand> | null | undefined): LiveDemand {
  const selfLevel = input?.selfLevel
  return {
    selfLevel:
      selfLevel === 'summary' || selfLevel === 'detail' || selfLevel === 'none'
        ? selfLevel
        : 'none',
    ais: Boolean(input?.ais),
  }
}

export function isLiveDemandEmpty(demand: LiveDemand) {
  return demand.selfLevel === 'none' && !demand.ais
}

function selfLevelWeight(level: SelfSubscriptionLevel) {
  switch (level) {
    case 'detail':
      return 2
    case 'summary':
      return 1
    default:
      return 0
  }
}

export function mergeLiveDemands(demands: LiveDemand[]) {
  return demands.reduce<LiveDemand>((merged, current) => {
    const demand = normalizeLiveDemand(current)
    return {
      selfLevel:
        selfLevelWeight(demand.selfLevel) > selfLevelWeight(merged.selfLevel)
          ? demand.selfLevel
          : merged.selfLevel,
      ais: merged.ais || demand.ais,
    }
  }, DEFAULT_LIVE_DEMAND)
}

export function createMyBoatLiveWebSocketUrl(path: string, baseOrigin?: string) {
  const origin = baseOrigin || (import.meta.client ? globalThis.location?.origin : null) || 'http://localhost:3000'
  const url = new URL(path, origin)
  if (url.protocol === 'http:') {
    url.protocol = 'ws:'
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:'
  }
  return url.toString()
}
