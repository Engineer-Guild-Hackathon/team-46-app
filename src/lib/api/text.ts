import { endpoints, getJson } from './client'

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'ORIGINAL'

export interface GetTextParams {
  bookId: string
  page: number
  level?: CEFRLevel
}

export interface BookTextResponse {
  text: string
}

export async function getBookText({
  bookId,
  page,
  level = 'ORIGINAL',
}: GetTextParams): Promise<BookTextResponse> {
  if (!bookId) throw new Error('bookId is required')
  if (page === undefined || page === null) throw new Error('page is required')
  return getJson<BookTextResponse>(endpoints.text, { bookId, page, level })
}

// Optional tiny cache (page-level)
const textCache = new Map<string, Promise<BookTextResponse>>()

export function getBookTextCached(params: GetTextParams): Promise<BookTextResponse> {
  const key = JSON.stringify({ ...params, level: params.level || 'ORIGINAL' })
  if (!textCache.has(key)) {
    textCache.set(key, getBookText(params))
  }
  return textCache.get(key)!
}
