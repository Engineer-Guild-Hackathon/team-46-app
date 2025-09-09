import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/svelte'

// Auto cleanup DOM between tests
afterEach(() => {
  cleanup()
})

// Stub fetch for relative API calls to prevent Node URL parsing errors
globalThis.fetch = (async (input: any) => {
  if (typeof input === 'string' && input.startsWith('/api/books')) {
    return {
      ok: false,
      status: 503,
      statusText: 'Mock Service Unavailable',
      json: async () => [],
    } as Response
  }
  return {
    ok: false,
    status: 404,
    statusText: 'Not Mocked',
    json: async () => [],
  } as Response
}) as any
