import type { AisContactSummary } from '~/types/myboat'

function preferDefined<T>(next: T | null | undefined, previous: T | null | undefined) {
  return next ?? previous ?? null
}

export function mergeTrafficContactSummary(
  current: AisContactSummary,
  enriched: AisContactSummary | null | undefined,
): AisContactSummary {
  if (!enriched) {
    return current
  }

  return {
    id: current.id,
    name: preferDefined(enriched.name, current.name),
    mmsi: preferDefined(enriched.mmsi, current.mmsi),
    shipType: preferDefined(enriched.shipType, current.shipType),
    lat: preferDefined(current.lat, enriched.lat),
    lng: preferDefined(current.lng, enriched.lng),
    cog: preferDefined(current.cog, enriched.cog),
    sog: preferDefined(current.sog, enriched.sog),
    heading: preferDefined(current.heading, enriched.heading),
    destination: preferDefined(enriched.destination, current.destination),
    callSign: preferDefined(enriched.callSign, current.callSign),
    length: preferDefined(enriched.length, current.length),
    beam: preferDefined(enriched.beam, current.beam),
    draft: preferDefined(enriched.draft, current.draft),
    navState: preferDefined(enriched.navState, current.navState),
    lastUpdateAt: Math.max(current.lastUpdateAt, enriched.lastUpdateAt),
  }
}

export function needsTrafficContactEnrichment(contact: AisContactSummary) {
  return (
    !contact.name ||
    contact.shipType === null ||
    contact.shipType === undefined ||
    !contact.callSign ||
    !contact.destination ||
    contact.length === null ||
    contact.length === undefined ||
    contact.beam === null ||
    contact.beam === undefined ||
    contact.draft === null ||
    contact.draft === undefined
  )
}

export function buildTrafficContactPath(
  basePath: string | null | undefined,
  contactId: string | null | undefined,
) {
  const normalizedBase = basePath?.trim()
  const normalizedContactId = contactId?.trim()

  if (!normalizedBase || !normalizedContactId) {
    return null
  }

  return `${normalizedBase.replaceAll(/\/+$/g, '')}/${encodeURIComponent(normalizedContactId)}`
}

export function formatTrafficContactDimensions(contact: {
  length?: number | null
  beam?: number | null
  draft?: number | null
}) {
  const parts = [
    contact.length ? `LOA ${contact.length.toFixed(1)} m` : null,
    contact.beam ? `Beam ${contact.beam.toFixed(1)} m` : null,
    contact.draft ? `Draft ${contact.draft.toFixed(1)} m` : null,
  ].filter(Boolean)

  return parts.join(' · ') || 'Dimensions unavailable'
}

export function formatTrafficMovement(contact: {
  sog?: number | null
  cog?: number | null
  heading?: number | null
}) {
  const speed = contact.sog
  const course = contact.cog ?? contact.heading

  if (speed === null || speed === undefined) {
    return 'Speed unavailable'
  }

  if (course === null || course === undefined) {
    return `${speed.toFixed(1)} kts`
  }

  return `${speed.toFixed(1)} kts · ${Math.round(course)}°`
}
