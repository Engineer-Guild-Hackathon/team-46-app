import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getBookText, getBookTextCached } from '../../../src/lib/api/text'

describe('getBookText', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('requests text with defaults', async () => {
    const mock = { text: 'Once upon a time.' }
    const fetchMock = vi.fn(async (input: RequestInfo) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const res = await getBookText({ bookId: 'B1', page: 0 })
    expect(res).toEqual(mock)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toMatch(/bookId=B1/)
    expect(url).toMatch(/page=0/)
    expect(url).toMatch(/level=ORIGINAL/)
  })

  it('supports custom level', async () => {
    const mock = { text: 'Simplified text.' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mock,
        text: async () => JSON.stringify(mock),
      })) as unknown as typeof fetch
    )

    const res = await getBookText({ bookId: 'B2', page: 3, level: 'A2' })
    expect(res.text).toBe('Simplified text.')
  })

  it('validates required parameters', async () => {
    await expect(getBookText({ bookId: '', page: 0 })).rejects.toThrow(/bookId/)
    // @ts-expect-error page missing intentionally
    await expect(getBookText({ bookId: 'X' })).rejects.toThrow(/page/)
  })
})

describe('getBookTextCached', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  it('caches identical requests', async () => {
    const mock = { text: 'Cached.' }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const r1 = await getBookTextCached({ bookId: 'B1', page: 1 })
    const r2 = await getBookTextCached({ bookId: 'B1', page: 1 })
    expect(r1.text).toBe('Cached.')
    expect(r2.text).toBe('Cached.')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await getBookTextCached({ bookId: 'B1', page: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
