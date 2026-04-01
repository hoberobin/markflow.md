import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { detectServerUrlParallel, getServerCandidatesForClient, getServerUrl, getWsUrl, getWsUrlForServer } from './config'

const originalWindow = globalThis.window

function mockWindowLocation(location: Partial<Location>): Window {
  return {
    location: {
      protocol: location.protocol ?? 'http:',
      hostname: location.hostname ?? 'localhost',
      origin: location.origin ?? 'http://localhost:3000',
      port: location.port ?? '3000'
    } as Location
  } as Window
}

function setWindowForTest(win: Window): void {
  ;(globalThis as unknown as { window: Window }).window = win
}

describe('config URL resolution', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SERVER_URL', '')
    vi.stubEnv('VITE_WS_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (originalWindow) {
      globalThis.window = originalWindow
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (globalThis as Record<string, unknown>).window
    }
  })

  it('uses same-origin for deployed environments without dev ports', () => {
    setWindowForTest(mockWindowLocation({
      protocol: 'https:',
      hostname: 'docs.example.com',
      origin: 'https://docs.example.com',
      port: ''
    }))
    expect(getServerUrl()).toBe('https://docs.example.com')
    expect(getWsUrl()).toBe('wss://docs.example.com')
  })

  it('uses local fallback ports in local dev', () => {
    setWindowForTest(mockWindowLocation({
      protocol: 'http:',
      hostname: '127.0.0.1',
      origin: 'http://127.0.0.1:3000',
      port: '3000'
    }))
    expect(getServerUrl()).toBe('http://127.0.0.1:4000')
    expect(getWsUrl()).toBe('ws://127.0.0.1:4000')
  })

  it('respects explicit server URL env for ws conversion', () => {
    vi.stubEnv('VITE_SERVER_URL', 'https://api.markflow.dev')
    setWindowForTest(mockWindowLocation({
      protocol: 'https:',
      hostname: 'docs.example.com',
      origin: 'https://docs.example.com',
      port: ''
    }))
    expect(getServerUrl()).toBe('https://api.markflow.dev')
    expect(getWsUrl()).toBe('wss://api.markflow.dev')
  })

  it('maps server URL to websocket URL directly', () => {
    expect(getWsUrlForServer('https://api.example.com')).toBe('wss://api.example.com')
    expect(getWsUrlForServer('http://127.0.0.1:4000')).toBe('ws://127.0.0.1:4000')
  })

  it('can detect /api backend health when same-origin has no server health', async () => {
    setWindowForTest(mockWindowLocation({
      protocol: 'https:',
      hostname: 'docs.example.com',
      origin: 'https://docs.example.com',
      port: ''
    }))

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'https://docs.example.com/health') {
        return Promise.resolve({ ok: false } as Response)
      }
      if (url === 'https://docs.example.com/api/health') {
        return Promise.resolve({ ok: true } as Response)
      }
      return Promise.resolve({ ok: false } as Response)
    })

    await expect(detectServerUrlParallel()).resolves.toBe('https://docs.example.com/api')
    fetchSpy.mockRestore()
  })

  it('includes likely same-origin and api candidates', () => {
    setWindowForTest(mockWindowLocation({
      protocol: 'https:',
      hostname: 'docs.example.com',
      origin: 'https://docs.example.com',
      port: ''
    }))
    const candidates = getServerCandidatesForClient()
    expect(candidates).toContain('https://docs.example.com')
    expect(candidates).toContain('https://docs.example.com/api')
  })
})
