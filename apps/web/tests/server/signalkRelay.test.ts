import { describe, expect, it } from 'vitest'
import {
  resolveInstallationSignalKConfig,
  resolveSignalKRelayOrigin,
  resolveScopedSignalKUrl,
  resolveSignalKRelayUrl,
} from '../../shared/signalkRelay'

describe('signalk relay helpers', () => {
  it('rewrites app origins to websocket relay URLs', () => {
    expect(resolveSignalKRelayUrl('http://localhost:3000')).toBe(
      'ws://localhost:3000/api/signalk/relay',
    )
    expect(resolveSignalKRelayUrl('https://mybo.at')).toBe('wss://mybo.at/api/signalk/relay')
  })

  it('derives websocket origins for CSP connect-src rules', () => {
    expect(resolveSignalKRelayOrigin('http://localhost:3000')).toBe('ws://localhost:3000')
    expect(resolveSignalKRelayOrigin('https://mybo.at/dashboard/')).toBe('wss://mybo.at')
  })

  it('forces the relay URL when the account is explicitly scoped to it', () => {
    expect(
      resolveScopedSignalKUrl({
        appOrigin: 'https://mybo.at',
        currentSignalKUrl: 'wss://other.example.com/signalk',
        forceRelay: true,
      }),
    ).toBe('wss://mybo.at/api/signalk/relay')
  })

  it('prefers the app relay for Tideye-compatible sources when available', () => {
    expect(
      resolveInstallationSignalKConfig({
        currentSignalKUrl: 'wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all',
        relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      }),
    ).toEqual({
      signalKUrl: 'wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=all',
      collectorSignalKUrl: 'wss://mybo.at/api/signalk/relay',
      relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      signalKAccessMode: 'relay',
    })

    expect(
      resolveInstallationSignalKConfig({
        currentSignalKUrl: 'wss://signalk-public.tideye.com/signalk/v1/stream',
        relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      }),
    ).toEqual({
      signalKUrl: 'wss://signalk-public.tideye.com/signalk/v1/stream',
      collectorSignalKUrl: 'wss://mybo.at/api/signalk/relay',
      relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      signalKAccessMode: 'relay',
    })
  })

  it('keeps explicit direct Signal K URLs when the collector should bypass the relay', () => {
    expect(
      resolveInstallationSignalKConfig({
        currentSignalKUrl: 'wss://boat-pi.local/signalk/v1/stream',
        relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      }),
    ).toEqual({
      signalKUrl: 'wss://boat-pi.local/signalk/v1/stream',
      collectorSignalKUrl: 'wss://boat-pi.local/signalk/v1/stream',
      relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      signalKAccessMode: 'direct',
    })
  })

  it('surfaces relay mode when no direct Signal K URL is stored yet', () => {
    expect(
      resolveInstallationSignalKConfig({
        currentSignalKUrl: null,
        relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      }),
    ).toEqual({
      signalKUrl: null,
      collectorSignalKUrl: 'wss://mybo.at/api/signalk/relay',
      relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      signalKAccessMode: 'relay',
    })
  })

  it('leaves explicit direct urls untouched without a relay override', () => {
    expect(
      resolveScopedSignalKUrl({
        appOrigin: 'http://localhost:3000',
        currentSignalKUrl: 'wss://custom.example.com/signalk',
      }),
    ).toBe('wss://custom.example.com/signalk')
  })
})
