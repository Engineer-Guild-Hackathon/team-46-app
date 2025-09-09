import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildQuery, getJson } from './client'

describe('buildQuery', () => {
  it('builds query string skipping empty values', () => {
    const qs = buildQuery({ a: 1, b: undefined, c: null, d: '', e: 'ok' })
    expect(qs).toBe('?a=1&e=ok')
  })
  it('returns empty string for no params', () => {
    expect(buildQuery()).toBe('')
  })
})

describe('getJson', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  it('performs GET and parses JSON', async () => {
    const mockData = { hello: 'world' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockData,
        text: async () => JSON.stringify(mockData),
      })) as unknown as typeof fetch
    )
    const data = await getJson<typeof mockData>('https://example.com/api')
    expect(data).toEqual(mockData)
    expect(fetch).toHaveBeenCalledWith('https://example.com/api', expect.any(Object))
  })
  it('throws on non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: async () => ({}),
        text: async () => 'fail',
      })) as unknown as typeof fetch
    )
    await expect(getJson('https://x.test')).rejects.toThrow(/500/)
  })
})
