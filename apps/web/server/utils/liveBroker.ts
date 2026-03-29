import type { H3Event } from 'h3'
import { getHeader, toWebRequest } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { AisContactSummary } from '../../app/types/myboat'
import type { VesselLivePublishMessage } from '../../shared/myboatLive'

type VesselLiveBrokerEnv = {
  VESSEL_LIVE_BROKER?: DurableObjectNamespace
}

function useVesselLiveBrokerNamespace(event: H3Event) {
  const env = event.context.cloudflare?.env as VesselLiveBrokerEnv | undefined
  const namespace = env?.VESSEL_LIVE_BROKER

  if (!namespace) {
    throw createError({
      statusCode: 500,
      message: 'Vessel live broker binding is not configured.',
    })
  }

  return namespace
}

function getVesselLiveBrokerStub(event: H3Event, vesselId: string) {
  return useVesselLiveBrokerNamespace(event).getByName(vesselId)
}

function getLocalBrokerOrigin(event: H3Event) {
  const configured = useRuntimeConfig(event).localBrokerOrigin
  return typeof configured === 'string' && configured.trim() ? configured.trim() : ''
}

function toProxyRequest(event: H3Event, url?: string | URL) {
  const request = toWebRequest(event)
  return url ? new Request(url, request) : request
}

async function fetchBrokerJson<T>(
  event: H3Event,
  vesselId: string,
  input: {
    path: string
    method?: 'GET' | 'POST'
    body?: string
  },
) {
  const localBrokerOrigin = getLocalBrokerOrigin(event)
  const request = localBrokerOrigin
    ? await fetch(new URL(`/vessels/${vesselId}${input.path}`, localBrokerOrigin), {
        method: input.method || 'GET',
        headers: input.body
          ? {
              'content-type': 'application/json',
            }
          : undefined,
        body: input.body,
      })
    : await getVesselLiveBrokerStub(event, vesselId).fetch(
        `https://vessel-live.internal${input.path}`,
        {
          method: input.method || 'GET',
          headers: input.body
            ? {
                'content-type': 'application/json',
              }
            : undefined,
          body: input.body,
        },
      )

  if (!request.ok) {
    return null
  }

  return (await request.json()) as T
}

export async function proxyVesselLiveUpgrade(event: H3Event, vesselId: string) {
  const upgrade = getHeader(event, 'upgrade')?.toLowerCase()
  const localBrokerOrigin = getLocalBrokerOrigin(event)

  if (upgrade !== 'websocket') {
    throw createError({
      statusCode: 426,
      message: 'Expected a websocket upgrade request.',
    })
  }

  if (localBrokerOrigin) {
    const target = new URL(`/vessels/${vesselId}/connect`, localBrokerOrigin)
    return fetch(toProxyRequest(event, target))
  }

  return getVesselLiveBrokerStub(event, vesselId).fetch(toProxyRequest(event))
}

export async function publishVesselLiveMessage(
  event: H3Event,
  vesselId: string,
  payload: VesselLivePublishMessage,
) {
  const localBrokerOrigin = getLocalBrokerOrigin(event)
  const response = localBrokerOrigin
    ? await fetch(new URL(`/vessels/${vesselId}/publish`, localBrokerOrigin), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    : await getVesselLiveBrokerStub(event, vesselId).fetch('https://vessel-live.internal/publish', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: 'Failed to publish vessel live update.',
    })
  }
}

export async function fetchVesselLiveContact(event: H3Event, vesselId: string, contactId: string) {
  const response = await fetchBrokerJson<{ contact: AisContactSummary | null }>(event, vesselId, {
    path: `/contacts/${encodeURIComponent(contactId)}`,
  })

  return response?.contact || null
}
