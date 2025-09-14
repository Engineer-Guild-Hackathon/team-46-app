import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  logOpenJapanese,
  logDifficultBtn,
  logOpenWord,
  logHowWasIt,
} from '../../../src/lib/api/logging'

describe('logging API helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('logs openJapanese with required params (unified feedback)', async () => {
    const mock = { result: 'success' }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const res = await logOpenJapanese('u1', 3.2, 42)
    expect(res.result).toBe('success')
    type FetchArgs = Parameters<typeof fetch>
    const calls = fetchMock.mock.calls as unknown as FetchArgs[]
    expect(calls.length).toBeGreaterThan(0)
    const url = String(calls[0][0])
    expect(url).toMatch(/userId=u1/)
    expect(url).toMatch(/rate=3.2/)
    expect(url).toMatch(/type=openJapanese/)
    expect(url).toMatch(/value=42/)
  })

  it('logs difficultBtn with required params (unified feedback)', async () => {
    const mock = { result: 'success' }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const res = await logDifficultBtn('u9', 'A2')
    expect(res.result).toBe('success')
    type FetchArgs = Parameters<typeof fetch>
    const calls = fetchMock.mock.calls as unknown as FetchArgs[]
    expect(calls.length).toBeGreaterThan(0)
    const url = String(calls[0][0])
    expect(url).toMatch(/userId=u9/)
    expect(url).toMatch(/rate=A2/)
    expect(url).toMatch(/type=difficultBtn/)
  })

  it('logs openWord and howWasIt variants', async () => {
    const mock = { result: 'success' }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    await logOpenWord('u2', 10, 5)
    await logHowWasIt('u2', 10, 'easy')
    const urls = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(urls.some((u) => /type=openWord/.test(u))).toBe(true)
    // word index is incremented to 1-based inside logOpenWord, so expect value=6
    expect(urls.some((u) => /value=6/.test(u))).toBe(true)
    expect(urls.some((u) => /type=howWasIt/.test(u))).toBe(true)
    expect(urls.some((u) => /value=easy/.test(u))).toBe(true)
  })

  it('validates required fields', async () => {
    await expect(logOpenJapanese('', 1.1, 1)).rejects.toThrow(/userId/)
    await expect(logDifficultBtn('abc', '')).rejects.toThrow(/rate/)
  })
})
