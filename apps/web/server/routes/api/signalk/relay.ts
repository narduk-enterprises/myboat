import type { Message, Peer } from 'crossws'
import { defineWebSocketHandler } from 'h3'
import { getSignalKRelayUpstreamUrl } from '#server/utils/signalkRelay'

type RelayPeerContext = {
  upstream?: WebSocket
}

function getRelayContext(peer: Peer) {
  return peer.context as RelayPeerContext
}

function getPeerUpstream(peer: Peer) {
  return getRelayContext(peer).upstream
}

function clearPeerUpstream(peer: Peer) {
  delete getRelayContext(peer).upstream
}

function closeUpstream(peer: Peer) {
  const upstream = getPeerUpstream(peer)

  if (upstream && upstream.readyState < WebSocket.CLOSING) {
    upstream.close()
  }

  clearPeerUpstream(peer)
}

async function forwardData(
  sink: Pick<WebSocket | Peer, 'send'>,
  data: Message['rawData'] | Blob | Event['type'],
) {
  if (typeof data === 'string') {
    sink.send(data)
    return
  }

  if (data instanceof Blob) {
    sink.send(new Uint8Array(await data.arrayBuffer()))
    return
  }

  if (data instanceof ArrayBuffer) {
    sink.send(new Uint8Array(data))
    return
  }

  if (typeof SharedArrayBuffer !== 'undefined' && data instanceof SharedArrayBuffer) {
    sink.send(new Uint8Array(data))
    return
  }

  if (ArrayBuffer.isView(data)) {
    sink.send(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
  }
}

export default defineWebSocketHandler({
  open(peer) {
    const upstream = new WebSocket(getSignalKRelayUpstreamUrl())
    upstream.binaryType = 'arraybuffer'
    getRelayContext(peer).upstream = upstream

    upstream.addEventListener('message', async (event) => {
      try {
        await forwardData(peer, event.data)
      } catch {
        peer.close(1011, 'Relay forwarding failed')
      }
    })

    upstream.addEventListener('close', () => {
      clearPeerUpstream(peer)

      if (peer.websocket.readyState === WebSocket.OPEN) {
        peer.close(1011, 'Upstream closed')
      }
    })

    upstream.addEventListener('error', () => {
      if (peer.websocket.readyState === WebSocket.OPEN) {
        peer.close(1013, 'Upstream unavailable')
      }

      closeUpstream(peer)
    })
  },
  async message(peer, message) {
    const upstream = getPeerUpstream(peer)

    if (!upstream || upstream.readyState !== WebSocket.OPEN) {
      return
    }

    await forwardData(upstream, message.rawData)
  },
  close(peer) {
    closeUpstream(peer)
  },
  error(peer) {
    closeUpstream(peer)
  },
})
