import { endpoints, getJson } from "./client";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "ORIGINAL";

export interface GetTextParams {
  bookId: string;
  page: number;
  level?: CEFRLevel;
}

export interface BookTextResponse {
  text: string;
}

export async function getBookText({
  bookId,
  page,
  level = "ORIGINAL",
}: GetTextParams): Promise<BookTextResponse> {
  if (!bookId) throw new Error("bookId is required");
  if (page === undefined || page === null) throw new Error("page is required");
  return getJson<BookTextResponse>(endpoints.text, { bookId, page, level });
}

// Optional tiny cache (page-level)
const textCache = new Map<string, Promise<BookTextResponse>>();

export function getBookTextCached(
  params: GetTextParams,
): Promise<BookTextResponse> {
  const key = JSON.stringify({ ...params, level: params.level || "ORIGINAL" });
  if (!textCache.has(key)) {
    textCache.set(key, getBookText(params));
  }
  return textCache.get(key)!;
}

// --- New: page-based text endpoint matching frontend requirements ---
export type TextItemType = "text" | "subtitle";

export interface TextItem {
  type: TextItemType;
  sentenceNo: number;
  en: string;
  jp?: string;
}

export interface GetTextPageParams {
  bookId: string;
  startSentenceNo?: number;
  userId?: string;
  charCount?: number;
  wordClickCount?: number | null;
  sentenceClickCount?: number | null;
  time?: number | null;
  rate?: number | null;
}

export interface GetTextPageResponse {
  rate: number | null;
  endSentenceNo: number;
  text: TextItem[];
}

export async function getTextPage(
  params: GetTextPageParams,
): Promise<GetTextPageResponse> {
  if (!params?.bookId) throw new Error("bookId is required");
  const {
    bookId,
    startSentenceNo = 0,
    userId = "anonymous",
    charCount = 800,
    wordClickCount,
    sentenceClickCount,
    time,
    rate,
  } = params;

  // The backend expects these as query params. We forward them as-is.
  return getJson<GetTextPageResponse>(endpoints.text, {
    bookId,
    startSentenceNo,
    userId,
    charCount,
    wordClickCount,
    sentenceClickCount,
    time,
    rate,
  });
}
