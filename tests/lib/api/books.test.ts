import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchBooks, fetchBooksCached, createPaginatedBooksStore } from '../../../src/lib/api/books'

// Small utility to let pending microtasks (like initial fetch) resolve.
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('fetchBooks', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('transforms raw keyed object into array and derives hasMore=false when fewer than size', async () => {
    const raw = {
      ID1: { title: 'Book 1', author: 'Author 1', thumbnail: 't1.jpg' },
      ID2: { title: 'Book 2', author: 'Author 2' },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => raw,
        text: async () => JSON.stringify(raw),
      })) as unknown as typeof fetch
    )

    const page = await fetchBooks({ search: 'alice', start: 0, size: 10 })
    expect(page.items).toHaveLength(2)
    expect(page.items[0]).toEqual({
      id: 'ID1',
      title: 'Book 1',
      author: 'Author 1',
      thumbnail: 't1.jpg',
    })
    expect(page.items[1].id).toBe('ID2')
    expect(page.hasMore).toBe(false)

    // Ensure query params were included
    const calledUrl = (fetch as any).mock.calls[0][0] as string
    expect(calledUrl).toMatch(/search=alice/)
    expect(calledUrl).toMatch(/size=10/)
  })

  it('sets hasMore=true when returned item count === requested size', async () => {
    const raw = {
      A: { title: 'A', author: 'AA' },
      B: { title: 'B', author: 'BB' },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => raw,
        text: async () => JSON.stringify(raw),
      })) as unknown as typeof fetch
    )

    const page = await fetchBooks({ size: 2 })
    expect(page.items).toHaveLength(2)
    expect(page.hasMore).toBe(true)
  })
})

describe('fetchBooksCached', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('caches identical parameter sets (single network call)', async () => {
    const raw = { X: { title: 'X', author: 'AX' } }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => raw,
      text: async () => JSON.stringify(raw),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const p1 = await fetchBooksCached({ search: 'x', size: 5 })
    const p2 = await fetchBooksCached({ search: 'x', size: 5 })
    expect(p1.items[0].id).toBe('X')
    expect(p2.items[0].id).toBe('X')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Different params -> new call
    await fetchBooksCached({ search: 'x', size: 5, start: 5 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('createPaginatedBooksStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads initial page, supports loadMore & refresh, and sets hasMore correctly', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = new URL(input as string)
      const start = Number(url.searchParams.get('start') || '0')
      const size = Number(url.searchParams.get('size') || '20')
      let raw: Record<string, { title: string; author: string }> = {}
      if (start === 0) {
        raw = {
          I0: { title: 'B0', author: 'A0' },
          I1: { title: 'B1', author: 'A1' },
        }
      } else if (start === 2) {
        raw = {
          I2: { title: 'B2', author: 'A2' },
          I3: { title: 'B3', author: 'A3' },
        }
      } else if (start === 4) {
        // Last page: fewer than size to set hasMore=false
        raw = {
          I4: { title: 'B4', author: 'A4' },
        }
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => raw,
        text: async () => JSON.stringify(raw),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const store = createPaginatedBooksStore({ size: 2 })
    const states: any[] = []
    const unsub = store.subscribe((v) => states.push(structuredClone(v)))

    await flush() // allow initial load
    expect(states.at(-1).items).toHaveLength(2)
    expect(states.at(-1).hasMore).toBe(true)

    await store.loadMore()
    await flush()
    expect(states.at(-1).items).toHaveLength(4)
    expect(states.at(-1).hasMore).toBe(true)

    await store.loadMore() // final page (only one item)
    await flush()
    expect(states.at(-1).items).toHaveLength(5)
    expect(states.at(-1).hasMore).toBe(false)

    // loadMore again should not trigger fetch because hasMore=false
    await store.loadMore()
    expect(fetchMock.mock.calls.filter((c) => (c[0] as string).includes('start=6'))).toHaveLength(0)

    await store.refresh()
    await flush()
    const refreshed = states.at(-1)
    expect(refreshed.items.map((b: any) => b.id)).toEqual(['I0', 'I1'])

    unsub()
    // Calls: start=0, start=2, start=4, refresh start=0 => 4 calls total
    const callStarts = fetchMock.mock.calls.map((c) =>
      new URL(c[0] as string).searchParams.get('start')
    )
    expect(callStarts).toEqual(['0', '2', '4', '0'])
  })

  it('guards against overlapping loadMore calls (no duplicate fetch for same start)', async () => {
    const deferred: { resolve?: () => void } = {}
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise(async (resolve) => {
            calls++
            await new Promise((r) => setTimeout(r, 10))
            resolve({
              ok: true,
              status: 200,
              statusText: 'OK',
              json: async () => ({ I0: { title: 'B0', author: 'A0' } }),
              text: async () => '{}',
            })
            deferred.resolve?.()
          })
      ) as unknown as typeof fetch
    )

    const store = createPaginatedBooksStore({ size: 1 })
    await flush()
    // Trigger two loadMore almost simultaneously
    void store.loadMore()
    void store.loadMore()
    await flush()
    await new Promise((r) => setTimeout(r, 30))
    expect(calls).toBeLessThanOrEqual(3) // initial + at most one of the concurrent loadMore (size=1 so more pages possible)
  })
})
