import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/svelte'

// Auto cleanup DOM between tests
afterEach(() => {
  cleanup()
})

// Stub fetch for relative API calls to prevent Node URL parsing errors
// Basic typed mock of fetch for relative API calls
// Use loose `any` parameter types here to avoid DOM lib dependency in test TS config
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.fetch = (async (input: any): Promise<Response> => {
  const makeResponse = (status: number, statusText: string): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url:
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input?.url ?? ''),
      clone: () => makeResponse(status, statusText),
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      json: async () => [],
      text: async () => '',
    }) as Response

  const path =
    typeof input === 'string' ? input : input instanceof URL ? input.pathname : (input?.url ?? '')
  if (path.startsWith('/api/books')) {
    return makeResponse(503, 'Mock Service Unavailable')
  }
  return makeResponse(404, 'Not Mocked')
}) as typeof fetch
