// Tooltip timing helpers
export function showWordTooltipState(wordTooltipVisible: Record<number, boolean>, i: number) {
  wordTooltipVisible[i] = true
  return { ...wordTooltipVisible }
}

export function hideWordTooltipState(wordTooltipVisible: Record<number, boolean>, i: number) {
  delete wordTooltipVisible[i]
  return { ...wordTooltipVisible }
}
