import { describe, it, expect, beforeEach } from 'vitest'
import { saveProgress, loadProgress } from '$lib/pages/persistenceUtils'

describe('persistenceUtils', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('saves and loads progress', () => {
    const key = 'test:progress'
    const state = { bookId: 'b1', currentStart: 0, lastEnd: 10 }
    expect(saveProgress(key, state as any)).toBe(true)
    const loaded = loadProgress(key)
    expect(loaded).not.toBeNull()
    expect(loaded!.bookId).toBe('b1')
  })
  it('returns null on missing', () => {
    expect(loadProgress('nope')).toBeNull()
  })
})
