import type { AisContactSummary, PublicProfileSummary, VesselCardSummary } from './myboat'

export type TrafficContactLiveState = 'live' | 'cached'

export interface TrafficContactDetailSummary extends AisContactSummary {
  contactId: string
  title: string
  distanceNm: number | null
  liveState: TrafficContactLiveState
}

export interface TrafficNearbyResponse {
  contacts: AisContactSummary[]
  radiusNm: number
  refreshedAt: string
  source: 'broker' | 'signalk' | 'merged'
}

export interface VesselTrafficContactDetailResponse {
  vessel: VesselCardSummary
  contact: TrafficContactDetailSummary
}

export interface PublicTrafficContactDetailResponse extends VesselTrafficContactDetailResponse {
  profile: PublicProfileSummary
}
