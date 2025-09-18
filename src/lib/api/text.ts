import { endpoints, getJson } from "./client";

// --- New: page-based text endpoint matching frontend requirements ---
export type TextItemType = "text" | "subtitle";

export interface TextItem {
  type: TextItemType;
  sentenceNo: number;
  en: string;
  jp: string;
  en_word: string[];
  jp_word: string[];
  // Optional phrase-level segmentation (new backend shape)
  en_phrase?: string[];
  jp_phrase?: string[];
  word_difficulty: string[];
  is_paragraph_start: boolean;
  is_paragraph_end: boolean;
}

export interface GetTextPageParams {
  bookId: string;
  startSentenceNo?: number;
  userId?: string;
  charCount?: number;
  difficultBtn?: boolean;
  time?: number | null;
  wordClickCount?: number;
  sentenceClickCount?: number;
  rate?: number;
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
    difficultBtn,
    time,
    wordClickCount,
    sentenceClickCount,
    rate,
  } = params;

  // The backend expects these as query params. We forward them as-is.
  return getJson<GetTextPageResponse>(endpoints.text, {
    bookId,
    startSentenceNo,
    userId,
    charCount,
    difficultBtn,
    time,
    wordClickCount,
    sentenceClickCount,
    rate,
  });
}
