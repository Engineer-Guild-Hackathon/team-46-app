// Lightweight helper to estimate how many words fit into a given container
// Strategy:
// - Measure average character width using a canvas with the container's computed font
// - Estimate average word width as avgCharWidth * avgCharsPerWord (6)
// - Compute lines per page from container height / line-height
// - Compute words per line from container width / avgWordWidth
// - Return floor(lines * wordsPerLine)

export function computeWordsPerPage(el: HTMLElement | null): number {
  if (!el) return 0
  const style = window.getComputedStyle(el)
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  // create canvas to measure text
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = font
  // measure a representative string of characters to estimate avg char width
  const sample = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const sampleWidth = ctx.measureText(sample).width
  const avgCharWidth = sampleWidth / sample.length

  // average word length including a trailing space (chars)
  const avgCharsPerWord = 6
  const avgWordWidth = avgCharWidth * avgCharsPerWord

  const containerWidth = el.clientWidth
  const containerHeight = el.clientHeight

  // debug logs to help diagnose zero results
  // eslint-disable-next-line no-console
  console.debug('[wpp] container', { containerWidth, containerHeight, font, avgCharWidth, avgWordWidth })

  // If element has no size yet, fall back to viewport-based estimate
  const fallbackWidth = Math.max(320, window.innerWidth * 0.8)
  const fallbackHeight = Math.max(200, window.innerHeight * 0.8)
  const effectiveWidth = containerWidth || fallbackWidth
  const effectiveHeight = containerHeight || fallbackHeight

  // derive line height from computed style or fallback to 1.2 * fontSize
  const lineHeightStr = style.lineHeight
  let lineHeight = 0
  if (lineHeightStr === 'normal') {
    const fontSize = parseFloat(style.fontSize) || 16
    lineHeight = fontSize * 1.2
  } else if (lineHeightStr.endsWith('px')) {
    lineHeight = parseFloat(lineHeightStr)
  } else {
    const fontSize = parseFloat(style.fontSize) || 16
    const multiplier = parseFloat(lineHeightStr) || 1.2
    lineHeight = fontSize * multiplier
  }

  const linesPerPage = Math.floor(effectiveHeight / lineHeight)
  const wordsPerLine = Math.floor(effectiveWidth / Math.max(1, avgWordWidth))
  const wordsPerPage = Math.max(0, linesPerPage * wordsPerLine)
  // eslint-disable-next-line no-console
  console.debug('[wpp] calc', { linesPerPage, wordsPerLine, wordsPerPage })
  return wordsPerPage
}

export function observeWordsPerPage(el: HTMLElement | null, cb: (n: number) => void) {
  if (!el) return () => {}
  const ro = new ResizeObserver(() => {
    // measure on next animation frame for stable layout
    requestAnimationFrame(() => cb(computeWordsPerPage(el)))
  })
  ro.observe(el)
  const onResize = () => requestAnimationFrame(() => cb(computeWordsPerPage(el)))
  window.addEventListener('resize', onResize)
  // initial measurement on next animation frame
  requestAnimationFrame(() => cb(computeWordsPerPage(el)))
  return () => {
    ro.disconnect()
    window.removeEventListener('resize', onResize)
  }
}
