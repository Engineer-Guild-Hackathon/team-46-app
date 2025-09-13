import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logOpenJapanese, logDifficultBtn } from '../../../src/lib/api/logging'

describe('logging API helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('logs openJapanese with required params', async () => {
    const mock = { result: 'success' }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const res = await logOpenJapanese({ userId: 'u1', rate: 3.2, sentenceNo: 42 })
    expect(res.result).toBe('success')
  type FetchArgs = Parameters<typeof fetch>
  const calls = fetchMock.mock.calls as unknown as FetchArgs[]
  expect(calls.length).toBeGreaterThan(0)
  const url = String(calls[0][0])
    expect(url).toMatch(/userId=u1/)
    expect(url).toMatch(/rate=3.2/)
    expect(url).toMatch(/sentenceNo=42/)
  })

  it('logs difficultBtn with required params', async () => {
    const mock = { result: 'success' }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mock,
      text: async () => JSON.stringify(mock),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    const res = await logDifficultBtn({ userId: 'u9', rate: 'A2' })
    expect(res.result).toBe('success')
  type FetchArgs = Parameters<typeof fetch>
  const calls = fetchMock.mock.calls as unknown as FetchArgs[]
  expect(calls.length).toBeGreaterThan(0)
  const url = String(calls[0][0])
    expect(url).toMatch(/userId=u9/)
    expect(url).toMatch(/rate=A2/)
  })

  it('validates required fields', async () => {
    // @ts-expect-error missing sentenceNo
    await expect(logOpenJapanese({ userId: 'x', rate: 1.1 })).rejects.toThrow(/sentenceNo/)
    // @ts-expect-error missing userId
    await expect(logDifficultBtn({ rate: 2.2 })).rejects.toThrow(/userId/)
  })
})
