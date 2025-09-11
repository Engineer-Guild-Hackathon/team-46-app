// Generic API client helpers for the FlexRead backend
// The backend currently exposes a Google Cloud Function endpoint for books.
// We keep this file intentionally small and framework agnostic so it can be
// reused inside Svelte load functions, components, or custom stores.

// Ensure DOM lib types; if ambient types missing (node test), fall back to minimal declarations.
// (ESLint no-undef flagged RequestInit in some contexts.)
// Infer the init type from global fetch without using explicit 'any'. Fallback to generic object.
type _FetchFn = typeof fetch extends (input: infer _I, init?: infer R) => Promise<unknown>
  ? { init: R }
  : never
type _RequestInit = _FetchFn extends { init: infer R } ? R : Record<string, unknown>

export interface RequestOptions {
  /** Additional fetch init overrides */
  init?: _RequestInit
  /** Abort controller signal to cancel an in-flight request */
  signal?: AbortSignal
}

// In a larger app this could come from an env var (e.g. import.meta.env.VITE_API_BASE)
// For now we hardcode because only one function endpoint is defined.
const BOOKS_ENDPOINT = import.meta.env.DEV
  ? '/api/books'
  : 'https://us-central1-flexread-egh.cloudfunctions.net/getBooks'
// Relative path for book text (served by local dev proxy / backend). Adjust with env var if needed.
const TEXT_ENDPOINT = 'https://us-central1-flexread-egh.cloudfunctions.net/getText'

/** Build a query string from an object, skipping undefined / null values */
export function buildQuery(params: Record<string, unknown> = {}): string {
  const usp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    usp.append(k, String(v))
  })
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

/** Low-level request wrapper (GET only for now) */
export async function getJson<T>(
  url: string,
  params?: Record<string, unknown>,
  options: RequestOptions = {}
): Promise<T> {
  const fullUrl = `${url}${buildQuery(params)}`
  const res = await fetch(fullUrl, {
    method: 'GET',
    ...(options.init || {}),
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(options.init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await safeText(res)
    throw new Error(`Request failed (${res.status} ${res.statusText}) for ${fullUrl}: ${text}`)
  }
  return (await res.json()) as T
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return '<no-body>'
  }
}

export const endpoints = {
  books: BOOKS_ENDPOINT,
  text: TEXT_ENDPOINT,
}
