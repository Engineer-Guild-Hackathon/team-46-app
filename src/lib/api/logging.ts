// Unified feedback logging endpoint
// Endpoint: /feedback
// Required params: userId, rate, type
// Optional: value (string - usage depends on type)
// type values:
// - openJapanese (sentence translation opened)
// - openWord (word meaning shown)
// - difficultBtn ("難しい" button pressed)
// - howWasIt (sentence difficulty rating at end; value = easy|normal|difficult)

import { getJson } from "./client";

export const FEEDBACK_ENDPOINT =
  "https://us-central1-flexread-egh.cloudfunctions.net/feedback";

export interface FeedbackResult {
  result: string;
}

export type FeedbackType =
  | "openJapanese"
  | "openWord"
  | "difficultBtn"
  | "howWasIt";

export interface BaseFeedbackParams {
  userId: string;
  rate: number | string;
  type: FeedbackType;
  value?: string;
}

function assertBase(p: BaseFeedbackParams) {
  if (!p.userId) throw new Error("userId is required");
  if (p.rate === undefined || p.rate === null || p.rate === "")
    throw new Error("rate is required");
  if (!p.type) throw new Error("type is required");
}

export async function logFeedback(
  params: BaseFeedbackParams,
): Promise<FeedbackResult> {
  assertBase(params);
  // Spread into a plain object to satisfy generic Record<string, unknown>
  return getJson<FeedbackResult>(FEEDBACK_ENDPOINT, { ...params });
}

// Convenience wrappers with stronger typing ---------------------------------
export function logOpenJapanese(
  userId: string,
  rate: number | string,
  sentenceNo: number | string,
): Promise<FeedbackResult> {
  return logFeedback({
    userId,
    rate,
    type: "openJapanese",
    value: String(sentenceNo),
  });
}

export function logOpenWord(
  userId: string,
  rate: number | string,
  wordIndex: number,
): Promise<FeedbackResult> {
  wordIndex += 1; // convert 0-based to 1-based index
  return logFeedback({
    userId,
    rate,
    type: "openWord",
    value: String(wordIndex),
  });
}

export function logDifficultBtn(
  userId: string,
  rate: number | string,
): Promise<FeedbackResult> {
  return logFeedback({ userId, rate, type: "difficultBtn" });
}

export type HowWasItValue = "easy" | "normal" | "difficult";
export function logHowWasIt(
  userId: string,
  rate: number | string,
  value: HowWasItValue,
): Promise<FeedbackResult> {
  return logFeedback({ userId, rate, type: "howWasIt", value });
}

// Backward compatibility export names (if other modules still import prior types)
export type LogResult = FeedbackResult;
