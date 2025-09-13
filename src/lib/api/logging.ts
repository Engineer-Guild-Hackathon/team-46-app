// Logging endpoints for user interactions
// - Sentence translation open
// - Difficult button feedback
// These endpoints are currently simple GETs with query params returning { result: "success" }

import { getJson } from './client'

// Extend endpoints object locally (non-breaking if properties already added elsewhere)
// Using relative paths so the same origin serving the frontend can proxy them.
export const LOG_ENDPOINTS = {
  openJapanese: 'https://us-central1-flexread-egh.cloudfunctions.net/log/openJapanese',
  difficultBtn: 'https://us-central1-flexread-egh.cloudfunctions.net/difficultBtn',
} as const

export interface LogResult {
  result: string // expected to be 'success' on success
}

export interface OpenJapaneseLogParams {
  userId: string
  rate: number | string
  sentenceNo: number
}

export async function logOpenJapanese(params: OpenJapaneseLogParams): Promise<LogResult> {
  const { userId, rate, sentenceNo } = params || ({} as OpenJapaneseLogParams)
  if (!userId) throw new Error('userId is required')
  if (rate === undefined || rate === null || rate === '') throw new Error('rate is required')
  if (sentenceNo === undefined || sentenceNo === null || Number.isNaN(sentenceNo)) {
    throw new Error('sentenceNo is required')
  }
  // Use GET for simplicity (backend spec used query params). Could switch to POST later.
  return getJson<LogResult>(LOG_ENDPOINTS.openJapanese, { userId, rate, sentenceNo })
}

export interface DifficultBtnLogParams {
  userId: string
  rate: number | string
}

export async function logDifficultBtn(params: DifficultBtnLogParams): Promise<LogResult> {
  const { userId, rate } = params || ({} as DifficultBtnLogParams)
  if (!userId) throw new Error('userId is required')
  if (rate === undefined || rate === null || rate === '') throw new Error('rate is required')
  return getJson<LogResult>(LOG_ENDPOINTS.difficultBtn, { userId, rate })
}
