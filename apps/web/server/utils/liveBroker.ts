import type { H3Event } from 'h3'
import { getHeader, getMethod, getRequestHeaders, getRequestURL } from 'h3'
import { useRuntimeConfig } from '#imports'
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

function toProxyRequestInit(event: H3Event) {
  const headers = new Headers()

  for (const [name, value] of Object.entries(getRequestHeaders(event))) {
    if (typeof value === 'string') {
      headers.set(name, value)
    }
  }

  return {
    method: getMethod(event),
    headers,
  } satisfies RequestInit
}

export async function proxyVesselLiveUpgrade(event: H3Event, vesselId: string) {
  const upgrade = getHeader(event, 'upgrade')?.toLowerCase()

  if (upgrade !== 'websocket') {
    throw createError({
      statusCode: 426,
      message: 'Expected a websocket upgrade request.',
    })
  }

  const localBrokerOrigin = getLocalBrokerOrigin(event)
  const url = new URL('/connect', getRequestURL(event))
  if (localBrokerOrigin) {
    const target = new URL(`/vessels/${vesselId}/connect`, localBrokerOrigin)
    return fetch(target, toProxyRequestInit(event))
  }

  return getVesselLiveBrokerStub(event, vesselId).fetch(url.toString(), toProxyRequestInit(event))
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
