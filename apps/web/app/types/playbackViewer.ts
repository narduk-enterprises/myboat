export type PlaybackSelectionKind = 'ais' | 'milestone' | 'photo' | 'waypoint'

export interface PlaybackSelectionEvent {
  id: string
  kind: PlaybackSelectionKind
  title: string
  shortLabel: string
  ms: number | null
  timestamp: string | null
  note?: string | null
  meta?: string | null
  imageUrl?: string | null
  lat?: number | null
  lng?: number | null
  sog?: number | null
  heading?: number | null
}
