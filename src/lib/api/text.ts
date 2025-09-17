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
  // Optional telemetry params
  wordClickCount?: number | null;
  sentenceClickCount?: number | null;
  time?: number | null;
  difficultBtn?: boolean | null;
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
    difficultBtn,
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
    difficultBtn,
  });
}
