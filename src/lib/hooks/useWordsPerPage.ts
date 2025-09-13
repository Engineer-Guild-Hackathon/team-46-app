// Lightweight helper to estimate how many words fit into a given container
// Strategy (canvas-based):
// - Measure text width on a offscreen canvas using the container's computed font
// - Estimate avg word width = avgCharWidth * avgCharsPerWord + spaceWidth
// - Compute lines per page from container height / line-height
// - Compute words per line from container width / avgWordWidth
// - Return floor(lines * wordsPerLine)

export function computeWordsPerPage(el: HTMLElement | null): number {
  // Helper to compute from measured width/height and computed style
  function computeFromDims(
    containerWidth: number,
    containerHeight: number,
    style: CSSStyleDeclaration
  ): number {
    const fontSize = parseFloat(style.fontSize) || 16
    const fontFamily = style.fontFamily || 'serif'
    const fontWeight = style.fontWeight || '400'
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return 1
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`

    // measure a typical English short word with trailing space to approximate words-per-line
    const sampleWord = 'the '
    let wordWidth = ctx.measureText(sampleWord).width
    if (!wordWidth || wordWidth < 1) {
      // fallback to average char approach
      const sample = 'abcdefghijklmnopqrstuvwxyz'
      const sampleWidth = ctx.measureText(sample).width || fontSize * 10
      const avgCharWidth = sampleWidth / sample.length
      const avgCharsPerWord = 5
      wordWidth = Math.max(1, avgCharWidth * avgCharsPerWord)
    }

    // determine line height
    const lh = style.lineHeight
    let lineHeight = 0
    if (!lh || lh === 'normal') {
      lineHeight = fontSize * 1.2
    } else if (lh.endsWith('px')) {
      lineHeight = parseFloat(lh)
    } else {
      const parsed = parseFloat(lh)
      lineHeight =
        !Number.isNaN(parsed) && parsed > 0 && parsed < 10
          ? parsed * fontSize
          : parsed || fontSize * 1.2
    }

    const wordsPerLine = Math.max(1, Math.floor(containerWidth / Math.max(1, wordWidth)))
    const linesPerPage = Math.max(1, Math.floor(containerHeight / Math.max(1, lineHeight)))
    const result = wordsPerLine * linesPerPage
    console.debug('[wpp] computeFromDims', {
      containerWidth,
      containerHeight,
      fontSize,
      wordWidth,
      lineHeight,
      wordsPerLine,
      linesPerPage,
      result,
    })
    return Math.max(1, result)
  }

  // Probe-based exact measurement: binary search the maximum number of short words that fit into a box of the element's size.
  function measureByProbe(
    containerWidth: number,
    containerHeight: number,
    style: CSSStyleDeclaration
  ): number {
    const probe = document.createElement('div')
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.left = '-9999px'
    probe.style.top = '-9999px'
    probe.style.width = `${Math.floor(containerWidth)}px`
    probe.style.height = `${Math.floor(containerHeight)}px`
    probe.style.overflow = 'hidden'
    probe.style.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    probe.style.lineHeight = style.lineHeight
    probe.style.whiteSpace = 'normal'
    probe.style.padding = '0'
    probe.style.margin = '0'
    document.body.appendChild(probe)

    const testWord = 'word '
    const maxTry = 5000
    let lo = 1
    let hi = maxTry
    let best = 1
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      probe.textContent = testWord.repeat(mid)
      const overflow = probe.scrollHeight > probe.clientHeight
      if (!overflow) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    document.body.removeChild(probe)
    console.debug('[wpp] probe measured words-per-page (words) =', best)
    return Math.max(1, best)
  }

  if (!el) {
    // no element -> use viewport based estimate
    const w = Math.max(320, window.innerWidth * 0.8)
    const h = Math.max(200, window.innerHeight * 0.8)
    return computeFromDims(w, h, window.getComputedStyle(document.body))
  }

  const rect = el.getBoundingClientRect()
  let width = rect.width || el.clientWidth
  let height = rect.height || el.clientHeight
  const style = window.getComputedStyle(el)

  // If width/height are zero or extremely small, try probe measurement
  if (!width || !height || width < 20 || height < 20) {
    // try probe first
    const probe = measureByProbe(
      Math.max(320, window.innerWidth * 0.8),
      Math.max(200, window.innerHeight * 0.8),
      style
    )
    if (probe > 0) return probe
    // fallback to dims
    const p = computeFromDims(width || window.innerWidth, height || window.innerHeight, style)
    return p
  }

  const estimate = computeFromDims(width, height, style)
  // if estimate is tiny (likely wrong), run probe to get a reliable count
  if (estimate < 10) {
    return measureByProbe(width, height, style)
  }
  return estimate
}

export function observeWordsPerPage(el: HTMLElement | null, cb: (n: number) => void) {
  if (!el) return () => {}
  const ro = new ResizeObserver(() => {
    requestAnimationFrame(() => cb(computeWordsPerPage(el)))
  })
  ro.observe(el)
  const onResize = () => requestAnimationFrame(() => cb(computeWordsPerPage(el)))
  window.addEventListener('resize', onResize)
  requestAnimationFrame(() => cb(computeWordsPerPage(el)))
  return () => {
    ro.disconnect()
    window.removeEventListener('resize', onResize)
  }
}
