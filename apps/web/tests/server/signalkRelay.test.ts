import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCAL_DEMO_SIGNALK_URL,
  isDemoAccountEmail,
  resolveDemoSignalKUrl,
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

  it('detects the seeded demo account email', () => {
    expect(isDemoAccountEmail('demo@example.com')).toBe(true)
    expect(isDemoAccountEmail(' Demo@Example.com ')).toBe(true)
    expect(isDemoAccountEmail('captain@example.com')).toBe(false)
  })

  it('replaces local seeded demo URLs with the current dev origin', () => {
    expect(
      resolveDemoSignalKUrl({
        appOrigin: 'http://127.0.0.1:4321',
        currentSignalKUrl: DEFAULT_LOCAL_DEMO_SIGNALK_URL,
        isDev: true,
        userEmail: 'demo@example.com',
      }),
    ).toBe('ws://127.0.0.1:4321/api/signalk/relay')
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
        currentSignalKUrl: 'wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=none',
        relaySignalKUrl: 'wss://mybo.at/api/signalk/relay',
      }),
    ).toEqual({
      signalKUrl: 'wss://signalk-public.tideye.com/signalk/v1/stream?subscribe=none',
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

  it('leaves non-demo or non-dev URLs untouched', () => {
    expect(
      resolveDemoSignalKUrl({
        appOrigin: 'http://localhost:3000',
        currentSignalKUrl: 'wss://custom.example.com/signalk',
        isDev: true,
        userEmail: 'captain@example.com',
      }),
    ).toBe('wss://custom.example.com/signalk')
    expect(
      resolveDemoSignalKUrl({
        appOrigin: 'http://localhost:3000',
        currentSignalKUrl: null,
        isDev: false,
        userEmail: 'demo@example.com',
      }),
    ).toBeNull()
  })
})
