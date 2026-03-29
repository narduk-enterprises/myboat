import type { H3Event } from 'h3'
import { getHeader, getMethod, getRequestHeaders, getRequestURL } from 'h3'
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

function toProxyRequest(event: H3Event, path: string) {
  const url = new URL(path, getRequestURL(event))
  const headers = new Headers()

  for (const [name, value] of Object.entries(getRequestHeaders(event))) {
    if (typeof value === 'string') {
      headers.set(name, value)
    }
  }

  return new Request(url.toString(), {
    method: getMethod(event),
    headers,
  })
}

export async function proxyVesselLiveUpgrade(event: H3Event, vesselId: string) {
  const upgrade = getHeader(event, 'upgrade')?.toLowerCase()

  if (upgrade !== 'websocket') {
    throw createError({
      statusCode: 426,
      message: 'Expected a websocket upgrade request.',
    })
  }

  return getVesselLiveBrokerStub(event, vesselId).fetch(toProxyRequest(event, '/connect'))
}

export async function publishVesselLiveMessage(
  event: H3Event,
  vesselId: string,
  payload: VesselLivePublishMessage,
) {
  const response = await getVesselLiveBrokerStub(event, vesselId).fetch(
    new Request('https://vessel-live.internal/publish', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    }),
  )

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: 'Failed to publish vessel live update.',
    })
  }
}
