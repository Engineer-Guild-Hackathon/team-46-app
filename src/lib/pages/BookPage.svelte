<script lang="ts">
  import { onMount, tick, onDestroy } from 'svelte'
  // local Sentence shape for this component (keeps file self-contained)
  type Sentence = {
    type: 'text' | 'subtitle'
    en: string
    jp?: string
    jp_word?: string[]
    level?: string
    sentenceNo?: number
  }
  import { computeWordsPerPage, observeWordsPerPage } from '../hooks/useWordsPerPage'
  import { getTextPage } from '$lib/api/text'
  import { ChevronLeft, ChevronRight } from '@lucide/svelte'
  import Button from '$lib/components/ui/button/button.svelte'
  import { logOpenJapanese, logDifficultBtn, logOpenWord } from '$lib/api/logging'

  export let bookId: string

  let loading = true
  let error: string | null = null
  let sentences: Sentence[] = []
  // pagination state
  let currentStart = 0
  let lastEnd = 0
  let prevStarts: number[] = []
  let canNext = false
  let selected = new Set<number>()
  let bubbleVisible = new Set<number>()
  const elRefs: Record<number, HTMLElement | null> = {}
  // Removed popup auto-hide: translations stay until user toggles
  const WORD_TOOLTIP_MS = 5000 // match sentence duration for placeholder

  let readerEl: HTMLElement | null = null
  let wordsPerPage = 0
  let charCountForRequest = 800
  const AVG_CHARS_PER_WORD = 6 // average letters + space
  // Telemetry for backend: count sentence translation clicks, and time between loads
  let sentenceClickCountForRequest = 0
  let lastLoadCompletedAt: number | null = null
  // Simple page cache for going backwards: startSentenceNo -> displayed page
  const pageCache = new Map<number, { sentences: Sentence[]; endSentenceNo: number }>()
  // Word-level telemetry (long-press selects a word)
  let wordClickCountForRequest = 0
  // First load flag: initial request must send null counts (backend interprets as 'no prior page')
  let firstLoad = true
  // Persisted user reading rate (backend provided) stored per book
  let userRate: number | null = null
  const rateStorageKey = (id: string) => `bookRate:${id}`
  // Currently highlighted word indices per sentence (multiple allowed)
  let wordHighlights: Record<number, Set<number>> = {}
  // Track which specific word (per sentence) should display the tooltip
  let wordTooltipWordIndex: Record<number, number> = {}
  // Timestamp of last word selection (reference for potential suppression logic)
  let _lastWordSelectionAt = 0 // internal timestamp (not currently read)
  // Word tooltip visibility timers
  let wordTooltipVisible: Record<number, boolean> = {}
  const wordTooltipTimers = new Map<number, number>()
  // Touch long-press support (mobile simulate right-click)
  const touchPresses: Record<
    number,
    { timer: number; startX: number; startY: number; triggered: boolean }
  > = {}
  const LONG_PRESS_TOUCH_MS = 520
  const TOUCH_MOVE_CANCEL_PX = 16
  let suppressClickForSentence: number | null = null
  let lastLongPressAt = 0

  async function loadPage(start = 0, charCountParam?: number, preferCache = false) {
    loading = true
    error = null
    sentences = []
    // clear transient word render cache (recomputed lazily)
    try {
      let _fromCache = false
      let apiTextLength = 0
      // Compute telemetry: seconds since last completed page load
      const timeSec = lastLoadCompletedAt
        ? Math.max(0, Math.round((Date.now() - lastLoadCompletedAt) / 1000))
        : null
      let res: {
        text: Array<{
          type: 'text' | 'subtitle'
          sentenceNo: number
          en: string
          jp?: string
          jp_word?: string[]
        }>
        endSentenceNo: number
      }

      // Try cache for previous pages
      if (preferCache && pageCache.has(start)) {
        const cached = pageCache.get(start)!
        sentences = cached.sentences.slice()
        lastEnd = cached.endSentenceNo
        currentStart = start
        apiTextLength = sentences.length
        _fromCache = true
        console.debug('[BookPage] Loaded page from cache:', {
          start,
          cachedCount: sentences.length,
          endSentenceNo: lastEnd,
        })
      } else {
        // Build and log API params
        const apiParams = {
          bookId,
          startSentenceNo: start,
          userId:
            (typeof localStorage !== 'undefined' && localStorage.getItem('userId')) || 'anonymous',
          charCount: charCountParam ?? charCountForRequest,
          wordClickCount: firstLoad ? null : wordClickCountForRequest,
          sentenceClickCount: firstLoad ? null : sentenceClickCountForRequest,
          time: timeSec,
          rate: userRate,
        }
        console.debug('[BookPage] getTextPage params ->', apiParams)

        // Request real text page from backend
        const apiRes = await getTextPage(apiParams)
        res = apiRes
        if (apiRes.rate !== null && !Number.isNaN(apiRes.rate)) {
          userRate = apiRes.rate
          try {
            localStorage.setItem(rateStorageKey(bookId), String(userRate))
          } catch {
            /* ignore persist */
          }
        }

        // Map to local Sentence shape
        sentences = res.text.map((t) => ({
          type: t.type,
          en: t.en,
          jp: t.jp,
          jp_word: t.jp_word,
          level: String(t.sentenceNo),
          sentenceNo: t.sentenceNo,
        }))
        // update pagination state
        lastEnd = res.endSentenceNo
        currentStart = start
        apiTextLength = res.text.length
      }
      // Important: render the reader content now so measurement can find it
      loading = false

      // Reset counters for the next request (we've just reported them)
      sentenceClickCountForRequest = 0
      wordClickCountForRequest = 0
      if (firstLoad) firstLoad = false

      console.debug(
        '[BookPage] Initial sentences loaded:',
        sentences.length,
        'sentences from',
        currentStart,
        'to',
        lastEnd
      )

      // Wait for DOM to render so we can measure whether content overflows
      await tick()
      await new Promise((r) => requestAnimationFrame(r)) // Extra frame for element refs to be set
      await tick() // Extra tick to ensure element binding is ready

      // Ensure the reader element actually exists (loading branch swaps to reader)
      // Retry a few frames if needed
      if (!readerEl) {
        for (let tries = 0; tries < 8 && !readerEl; tries++) {
          readerEl = document.querySelector('article.reader') as HTMLElement | null
          if (readerEl) break
          await new Promise((r) => requestAnimationFrame(r))
          await tick()
        }
      }

      console.debug('[BookPage] 🔍 Starting overflow detection after tick+RAF+tick...', {
        hasReaderElBound: !!readerEl,
        sentencesCount: sentences.length,
        loadingState: loading,
        errorState: error,
        blocksLength: blocks.length,
        currentUrl: window.location.href,
      })

      try {
        console.debug('[BookPage] 🔍 Checking conditions:', {
          sentencesLength: sentences.length,
          hasReaderEl: !!readerEl,
          readerElFound: readerEl ? 'YES' : 'NO',
        })

        if (sentences.length > 0) {
          // Debug: ALWAYS check what's in the DOM, regardless of readerEl binding
          const allArticles = document.querySelectorAll('article')
          const allReaderClass = document.querySelectorAll('.reader')
          const articleReader = document.querySelector('article.reader')
          const bookTextSection = document.querySelector('.book-text')

          console.debug('[BookPage] 🔍 DOM INSPECTION:', {
            'article.reader found': !!articleReader,
            '.reader found': !!allReaderClass.length,
            'article count': allArticles.length,
            '.book-text found': !!bookTextSection,
            'readerEl bound': !!readerEl,
            'loading state': loading,
            'error state': error,
            allArticles: Array.from(allArticles).map((el) => ({
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              textContent: el.textContent?.substring(0, 50) + '...',
            })),
            'document.body classes': document.body.className,
            'current HTML structure':
              document.querySelector('main')?.innerHTML.substring(0, 800) || 'NO MAIN FOUND',
          })

          // Try to get readerEl if we don't have it (should be bound, but fallback just in case)
          if (!readerEl) {
            // Try multiple selectors to find the reader element
            readerEl = articleReader as HTMLElement | null
            if (!readerEl && allReaderClass.length > 0) {
              readerEl = allReaderClass[0] as HTMLElement | null
            }
            if (!readerEl && allArticles.length > 0) {
              readerEl = allArticles[0] as HTMLElement | null
            }

            console.debug(
              '[BookPage] 🔍 Final readerEl found via fallback:',
              !!readerEl,
              readerEl?.className
            )
          }

          if (readerEl) {
            console.debug('[BookPage] ✅ Proceeding with overflow detection')

            const readerRect = readerEl.getBoundingClientRect()
            const readerStyles = window.getComputedStyle(readerEl)

            console.debug('[BookPage] 🔍 READER CONTAINER:', {
              maxHeight: readerStyles.maxHeight,
              actualHeight: Math.round(readerRect.height),
              overflow: readerStyles.overflow,
              bottom: Math.round(readerRect.bottom),
              sentenceCount: sentences.length,
              elRefsCount: Object.keys(elRefs).length,
              elRefsObject: Object.fromEntries(Object.entries(elRefs).map(([k, v]) => [k, !!v])),
            })

            // Check for overflow and trim if needed
            let cutOffFound = false
            let firstCutOffIndex = -1

            // Check each sentence element to see if its bottom overflows the container
            // Note: we need to check based on block structure since elRefs uses block-based indices
            let sentenceIndex = 0
            for (const block of blocks) {
              if (block.kind === 'paragraph') {
                for (let j = 0; j < block.items.length; j++) {
                  const elementIndex = block.idxStart + j
                  const sentenceEl = elRefs[elementIndex]

                  if (sentenceEl && sentenceIndex < sentences.length) {
                    const sentenceRect = sentenceEl.getBoundingClientRect()
                    const sentenceBottom = sentenceRect.bottom
                    const containerBottom = readerRect.bottom
                    const overflows = sentenceBottom > containerBottom + 1 // 1px tolerance

                    console.debug(
                      `[BookPage] 📏 Sentence ${sentenceIndex} (elRef ${elementIndex}):`,
                      {
                        text: `"${sentences[sentenceIndex].en.substring(0, 40)}..."`,
                        sentenceBottom: Math.round(sentenceBottom),
                        containerBottom: Math.round(containerBottom),
                        overflowBy: Math.round(sentenceBottom - containerBottom),
                        overflows,
                        hasElement: !!sentenceEl,
                      }
                    )

                    if (overflows && firstCutOffIndex === -1) {
                      firstCutOffIndex = sentenceIndex
                      cutOffFound = true
                      console.debug(
                        `[BookPage] 🚨 BOTTOM OVERFLOW at sentence ${sentenceIndex} (elRef ${elementIndex}):`,
                        {
                          sentenceNo: sentences[sentenceIndex].sentenceNo,
                          text: sentences[sentenceIndex].en,
                          overflowBy: Math.round(sentenceBottom - containerBottom) + 'px',
                        }
                      )
                      break
                    }
                  } else {
                    console.debug(
                      `[BookPage] ⚠️ No element ref for sentence ${sentenceIndex} (elRef ${elementIndex})`
                    )
                  }

                  sentenceIndex++
                }
                if (cutOffFound) break
              } else if (block.kind === 'subtitle') {
                // Handle subtitle block
                const elementIndex = block.idx
                const sentenceEl = elRefs[elementIndex]

                if (sentenceEl && sentenceIndex < sentences.length) {
                  const sentenceRect = sentenceEl.getBoundingClientRect()
                  const sentenceBottom = sentenceRect.bottom
                  const containerBottom = readerRect.bottom
                  const overflows = sentenceBottom > containerBottom + 1 // 1px tolerance

                  console.debug(
                    `[BookPage] 📏 Subtitle ${sentenceIndex} (elRef ${elementIndex}):`,
                    {
                      text: `"${sentences[sentenceIndex].en.substring(0, 40)}..."`,
                      sentenceBottom: Math.round(sentenceBottom),
                      containerBottom: Math.round(containerBottom),
                      overflowBy: Math.round(sentenceBottom - containerBottom),
                      overflows,
                      hasElement: !!sentenceEl,
                    }
                  )

                  if (overflows && firstCutOffIndex === -1) {
                    firstCutOffIndex = sentenceIndex
                    cutOffFound = true
                    console.debug(
                      `[BookPage] 🚨 BOTTOM OVERFLOW at subtitle ${sentenceIndex} (elRef ${elementIndex}):`,
                      {
                        sentenceNo: sentences[sentenceIndex].sentenceNo,
                        text: sentences[sentenceIndex].en,
                        overflowBy: Math.round(sentenceBottom - containerBottom) + 'px',
                      }
                    )
                    break
                  }
                } else {
                  console.debug(
                    `[BookPage] ⚠️ No element ref for subtitle ${sentenceIndex} (elRef ${elementIndex})`
                  )
                }

                sentenceIndex++
              }
            }

            // If we found overflowing content, trim it
            if (cutOffFound && firstCutOffIndex > 0) {
              const originalLength = sentences.length
              const heldSentences = sentences.slice(firstCutOffIndex)
              sentences = sentences.slice(0, firstCutOffIndex)

              // Update pagination state
              const lastIncluded = sentences[sentences.length - 1]
              lastEnd = lastIncluded.sentenceNo ?? currentStart + sentences.length - 1
              const heldSentenceNo = heldSentences[0].sentenceNo ?? firstCutOffIndex
              canNext = true

              console.debug('[BookPage] ✂️ TRIMMED OVERFLOW SENTENCES:', {
                originalCount: originalLength,
                keptCount: sentences.length,
                trimmedCount: heldSentences.length,
                lastDisplayedSentenceNo: lastEnd,
                firstHeldSentenceNo: heldSentenceNo,
                trimmedSentences: heldSentences.map(
                  (s) => `${s.sentenceNo}: "${s.en.substring(0, 30)}..."`
                ),
              })

              // Force a re-render to ensure the trimmed sentences are removed
              await tick()
            } else {
              // No cut-off detected
              canNext = lastEnd + 1 > start && sentences.length > 0
              console.debug('[BookPage] ✅ No overflow detected, all content fits')
            }
          } else {
            console.debug('[BookPage] ❌ Cannot detect overflow: no reader element found')
            canNext = lastEnd + 1 > start && sentences.length > 0
          }
        } else {
          console.debug('[BookPage] ❌ No sentences to check')
          canNext = false
        }
      } catch (me: unknown) {
        // ignore measurement errors — fall back to previous canNext heuristic
        console.warn('[BookPage] measurement error', me)
        canNext = lastEnd + 1 > start && apiTextLength > 0
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load text'
    } finally {
      loading = false
      lastLoadCompletedAt = Date.now()
      if (sentences.length > 0)
        pageCache.set(currentStart, { sentences: sentences.slice(), endSentenceNo: lastEnd })
    }
  }

  // Test hook: only defined in test environment to allow forcing a second load without user interaction.
  if (typeof window !== 'undefined' && (window as any).__VITEST__) {
    ;(window as any).__bookPageForceNext = () => {
      // simulate advancing by lastEnd to request next chunk
      void loadPage(lastEnd)
    }
  }

  async function nextPage() {
    if (loading || !canNext) return
    // push current start to history so we can go back
    prevStarts.push(currentStart)
    const nextStart = lastEnd + 1
  // Clear current selections/highlights before navigating
  clearSelections()
  // Always fetch next page from API (do not use cache)
  await loadPage(nextStart, undefined, false)
  }

  async function previousPage() {
    if (loading || prevStarts.length === 0) return
    const prev = prevStarts.pop() as number
  // Clear current selections/highlights before navigating
  clearSelections()
  // Prefer cache for previous pages
  await loadPage(prev, undefined, true)
  }

  function toggleSentence(i: number) {
    const isNew = !selected.has(i)
    if (isNew) selected.add(i)
    selected = new Set(selected)
    sentenceClickCountForRequest++
    // Fire sentence translation open log (first time only)
    if (isNew) {
      const s = sentences[i]
      const _sentenceNo = s?.sentenceNo ?? i // currently unused; kept for potential future feedback extension
      // Fire-and-forget; swallow errors to avoid test noise / UI disruption
      void logOpenJapanese(
        (typeof localStorage !== 'undefined' && localStorage.getItem('userId')) || 'anonymous',
        userRate ?? 0,
        s?.sentenceNo ?? i
      ).catch(() => {})
    }
    showBubble(i)
  }

  // LEFT CLICK -> select / toggle word highlight (flipped behavior)
  function handleClick(i: number, e: MouseEvent) {
    if (e.button !== 0) return
    // If a long-press just triggered sentence translation, suppress immediate word selection
    if (suppressClickForSentence === i && Date.now() - lastLongPressAt < 600) {
      suppressClickForSentence = null
      return
    }
    const idx = getWordIndexAtPointer(i, e as unknown as PointerEvent)
    if (idx == null) return
    const set = wordHighlights[i] || (wordHighlights[i] = new Set<number>())
    if (set.has(idx)) {
      set.delete(idx)
      if (wordTooltipWordIndex[i] === idx) delete wordTooltipWordIndex[i]
      if (set.size === 0) delete wordHighlights[i]
      reassignWordHighlights()
      hideWordTooltip(i)
      return
    }
    set.add(idx)
    wordTooltipWordIndex[i] = idx
    reassignWordHighlights()
    wordClickCountForRequest++
    _lastWordSelectionAt = Date.now()
    try {
      const sentence = sentences[i]
      const rawText = sentence?.en ?? ''
      const re = /[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g
      const words: string[] = []
      let m: RegExpExecArray | null
      while ((m = re.exec(rawText)) !== null) words.push(m[0])
      const wordValue = words[idx] ?? String(idx)
      void logOpenWord(
        (typeof localStorage !== 'undefined' && localStorage.getItem('userId')) || 'anonymous',
        userRate ?? 0,
        wordValue
      )
    } catch {
      /* ignore word log */
    }
    showWordTooltip(i, idx)
  }

  // CONTEXT MENU (right-click) -> toggle sentence translation bubble (flipped)
  function handleContextMenu(i: number, e: MouseEvent) {
    e.preventDefault()
    toggleSentence(i)
  }

  // Fallback: capture right-button mousedown early (some browsers may not fire contextmenu quickly on mobile emulation)
  // RIGHT BUTTON mousedown -> toggle sentence translation (consistent with contextmenu)
  function handleMouseDown(i: number, e: MouseEvent) {
    if (e.button !== 2) return
    toggleSentence(i)
  }

  // Helper to get word index from pointer/mouse event
  function getWordIndexAtPointer(i: number, e: PointerEvent): number | undefined {
    return selectWordAtPointer(i, e)
  }

  // --- Touch long press (simulate right click) ---
  function touchPointerDown(i: number, e: PointerEvent) {
    if (e.pointerType !== 'touch') return
    if ((e as any).isPrimary === false) return
    const existing = touchPresses[i]
    if (existing && existing.timer) window.clearTimeout(existing.timer)
    touchPresses[i] = {
      startX: e.clientX,
      startY: e.clientY,
      triggered: false,
      timer: window.setTimeout(() => {
        // Long press elapsed -> toggle sentence translation (was word highlight)
        toggleSentence(i)
        suppressClickForSentence = i // suppress immediate word selection after releasing
        lastLongPressAt = Date.now()
        touchPresses[i].triggered = true
        try {
          window.getSelection()?.removeAllRanges()
        } catch {
          /* ignore selection */
        }
        console.debug('[BookPage] touch long-press sentence translation', { sentenceIndex: i })
      }, LONG_PRESS_TOUCH_MS),
    }
  }

  function touchPointerMove(i: number, e: PointerEvent) {
    if (e.pointerType !== 'touch') return
    const press = touchPresses[i]
    if (!press || press.triggered) return
    const dx = e.clientX - press.startX
    const dy = e.clientY - press.startY
    if (Math.hypot(dx, dy) > TOUCH_MOVE_CANCEL_PX) {
      window.clearTimeout(press.timer)
      delete touchPresses[i]
    }
  }

  function touchPointerUp(i: number, e: PointerEvent) {
    if (e.pointerType !== 'touch') return
    const press = touchPresses[i]
    if (!press) return
    window.clearTimeout(press.timer)
    const wasTriggered = press.triggered
    delete touchPresses[i]
    if (wasTriggered) {
      // prevent any stray selection
      try {
        window.getSelection()?.removeAllRanges()
      } catch {
        /* ignore selection */
      }
      e.preventDefault?.()
    }
  }

  function selectWordAtPointer(i: number, e: PointerEvent) {
    const spanEl = elRefs[i]
    if (!spanEl) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    if (el && spanEl.contains(el)) {
      const candidate = (el.closest('span.word') || el) as HTMLElement
      if (candidate && candidate.dataset?.wi !== undefined) {
        const idx = Number(candidate.dataset.wi)
        if (!Number.isNaN(idx)) return idx
      }
    }
    // Fallback ratio method across only word spans
    return pickWordByRatio(i, e)
  }

  function pickWordByRatio(i: number, e: PointerEvent): number | undefined {
    const spanEl = elRefs[i]
    if (!spanEl) return undefined
    const wordEls = Array.from(spanEl.querySelectorAll('span.word')) as HTMLElement[]
    if (wordEls.length === 0) return undefined
    const rect = spanEl.getBoundingClientRect()
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width)
    const ratio = rect.width > 0 ? x / rect.width : 0
    const idx = Math.min(wordEls.length - 1, Math.max(0, Math.floor(ratio * wordEls.length)))
    const target = wordEls[idx]
    if (target && target.dataset.wi) return Number(target.dataset.wi)
    return undefined
  }

  function reassignWordHighlights() {
    // clone sets to trigger Svelte reactivity
    const clone: Record<number, Set<number>> = {}
    for (const k in wordHighlights) clone[k] = new Set(wordHighlights[k])
    wordHighlights = clone
    console.debug(
      '[BookPage] wordHighlights state (multiple)',
      Object.fromEntries(Object.entries(wordHighlights).map(([k, v]) => [k, Array.from(v)]))
    )
  }

  function clearSelections() {
    // Sentences
    selected = new Set()
    bubbleVisible = new Set()
    // No sentence bubble timers anymore (persistent translations)
    // Word highlights
    wordHighlights = {}
    wordTooltipWordIndex = {}
    // Word tooltips & timers
    wordTooltipTimers.forEach((id) => window.clearTimeout(id))
    wordTooltipTimers.clear()
    wordTooltipVisible = {}
    // Touch long-press state
    Object.values(touchPresses).forEach((p) => p.timer && window.clearTimeout(p.timer))
    for (const k in touchPresses) delete touchPresses[k]
    // Force reactivity for anything mutated
    reassignWordHighlights()
    wordTooltipVisible = { ...wordTooltipVisible }
    console.debug('[BookPage] selections cleared on page change')
  }

  function showWordTooltip(i: number, wordIdx?: number) {
    // clear existing
    const existing = wordTooltipTimers.get(i)
    if (existing) window.clearTimeout(existing)
    if (wordIdx !== undefined) wordTooltipWordIndex[i] = wordIdx
    wordTooltipVisible[i] = true
    // force reactive update
    wordTooltipVisible = { ...wordTooltipVisible }
    // schedule hide
    const id = window.setTimeout(() => hideWordTooltip(i), WORD_TOOLTIP_MS)
    wordTooltipTimers.set(i, id)
    // next frame adjust position to avoid clipping
    requestAnimationFrame(() => adjustWordTooltipPosition(i))
  }

  function hideWordTooltip(i: number) {
    delete wordTooltipVisible[i]
    delete wordTooltipWordIndex[i]
    // force reactive update
    wordTooltipVisible = { ...wordTooltipVisible }
    const existing = wordTooltipTimers.get(i)
    if (existing) window.clearTimeout(existing)
    wordTooltipTimers.delete(i)
  }

  async function handleDifficult() {
    if (loading) return
    const prevRate = userRate ?? 0
    userRate = Math.max(0, prevRate - 300)
    try {
      localStorage.setItem(rateStorageKey(bookId), String(userRate))
    } catch {
      /* ignore persist */
    }
    console.debug('[BookPage] 難しい pressed: lowering rate', { previous: prevRate, new: userRate })
    // Log difficult button press with previous rate (state before adjustment)
    void logDifficultBtn(
      (typeof localStorage !== 'undefined' && localStorage.getItem('userId')) || 'anonymous',
      prevRate
    ).catch(() => {})
    // Re-load current page with same start & charCount using updated rate (force fresh fetch)
    await loadPage(currentStart, charCountForRequest, false)
  }

  // Ensure tooltip stays within viewport / reader container
  function adjustWordTooltipPosition(sentenceIdx: number) {
    const container = document.querySelector('article.reader') as HTMLElement | null
    if (!container) return
    const wordIdx = wordTooltipWordIndex[sentenceIdx]
    if (wordIdx == null) return
    const sentenceEl = elRefs[sentenceIdx]
    if (!sentenceEl) return
    const wordEl = sentenceEl.querySelector(`span.word[data-wi="${wordIdx}"]`) as HTMLElement | null
    if (!wordEl) return
    const tip = wordEl.querySelector('.word-tooltip') as HTMLElement | null
    if (!tip) return
    // Reset modifier classes
    tip.classList.remove('pos-left', 'pos-right', 'pos-flip')
    const tipRect = tip.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const padding = 4
    // Horizontal overflow check
    if (tipRect.left < containerRect.left + padding) {
      tip.classList.add('pos-left')
    } else if (tipRect.right > containerRect.right - padding) {
      tip.classList.add('pos-right')
    }
    // Vertical (if not enough space above, flip below)
    if (tipRect.top < containerRect.top + 4) {
      tip.classList.add('pos-flip')
    }
    // If flipped below, adjust transform via CSS class
  }

  function showBubble(i: number) {
    bubbleVisible.add(i)
    bubbleVisible = new Set(bubbleVisible)
  }

  function hideBubble(i: number) {
    bubbleVisible.delete(i)
    bubbleVisible = new Set(bubbleVisible)
  }

  onMount(async () => {
    // Load persisted user rate if available
    try {
      const stored = localStorage.getItem(rateStorageKey(bookId))
      if (stored) {
        const num = Number(stored)
        if (!Number.isNaN(num)) userRate = num
      }
    } catch {
      /* ignore localStorage */
    }
    // Ensure the .reader element exists in the DOM so we can measure it.
    await tick()
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    if (!readerEl) {
      readerEl = document.querySelector('.reader') as HTMLElement | null
    }

    // compute initial words-per-page based on reader element (or body fallback)
    if (readerEl) {
      wordsPerPage = computeWordsPerPage(readerEl) || 0
      console.debug('[wpp] initial wordsPerPage (reader) =', wordsPerPage)
      // observe for container changes and update wordsPerPage (does not auto-reload)
      const stop = observeWordsPerPage(readerEl, (n) => {
        wordsPerPage = n || 0
        console.debug('[wpp] wordsPerPage updated=', wordsPerPage)
      })
      onDestroy(() => stop && stop())
    } else {
      wordsPerPage = computeWordsPerPage(document.body) || 0
      console.debug('[wpp] reader not found, body wordsPerPage =', wordsPerPage)
    }

    // derive a conservative charCount from wordsPerPage and request the page
    const estimated = Math.max(80, Math.min(4000, Math.floor(wordsPerPage * AVG_CHARS_PER_WORD)))
    charCountForRequest = estimated
    console.debug('[BookPage] estimated charCount from wordsPerPage=', estimated)

    // load first page using estimated charCount
    await loadPage(0, charCountForRequest)
  })

  // Build book-like blocks: paragraphs of text and standalone subtitles
  type Block =
    | { kind: 'paragraph'; idxStart: number; idxEnd: number; items: Sentence[] }
    | { kind: 'subtitle'; item: Sentence; idx: number }
  function buildBlocks(list: Sentence[]): Block[] {
    const blocks: Block[] = []
    let idxStart = -1
    let acc: Sentence[] = []
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      if (s.type === 'subtitle') {
        if (acc.length > 0) {
          blocks.push({
            kind: 'paragraph',
            idxStart,
            idxEnd: idxStart + acc.length - 1,
            items: acc.slice(),
          })
          acc = []
          idxStart = -1
        }
        blocks.push({ kind: 'subtitle', item: s, idx: i })
      } else {
        if (idxStart === -1) idxStart = i
        acc.push(s)
      }
    }
    if (acc.length > 0 && idxStart !== -1) {
      blocks.push({
        kind: 'paragraph',
        idxStart,
        idxEnd: idxStart + acc.length - 1,
        items: acc.slice(),
      })
    }
    return blocks
  }

  $: blocks = buildBlocks(sentences)
  // $: paginatedSentences = paginateByWords(mockSentences, wordsPerPage)
  $: headerTitle = 'CHAPTER I. Down the Rabbit-Hole'
  $: rateDisplay = userRate !== null ? userRate : '—'

  // Escape util
  function esc(t: string) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function formatSentence(t: string): string {
    return t.replace(/\s+/g, ' ').trim()
  }
  // Render sentence where only word tokens (letters/digits + internal hyphens) become selectable spans.
  function renderSentenceHTML(
    i: number,
    s: Sentence,
    highlightSet?: Set<number>,
    tooltipVisible?: boolean,
    tooltipWordIdx?: number
  ): string {
    const raw = formatSentence(s.en)
    const re = /[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g
    let last = 0
    let wi = 0
    let out: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) {
        // punctuation / spaces chunk
        out.push(esc(raw.slice(last, m.index)))
      }
      const word = m[0]
      const isHighlighted = !!highlightSet && highlightSet.has(wi)
      const cls = isHighlighted ? 'word word-highlight' : 'word'
      if (isHighlighted && tooltipVisible && wi === tooltipWordIdx) {
        const jpWord = s.jp_word?.[wi]
        const tip = jpWord && jpWord.trim() !== '' ? esc(jpWord) : 'Translation unavailable'
        out.push(
          `<span class="${cls}" data-wi="${wi}">${esc(word)}<span class="word-tooltip" aria-label="Japanese translation">${tip}</span></span>`
        )
      } else {
        out.push(`<span class="${cls}" data-wi="${wi}">${esc(word)}</span>`)
      }
      wi++
      last = m.index + word.length
    }
    if (last < raw.length) out.push(esc(raw.slice(last)))
    return out.join('')
  }
</script>

<main class="bookpage">
  <header class="topbar">
    <Button
      class="btn btn-ghost backBtn"
      type="button"
      variant="outline"
      aria-label="Go back"
      onclick={() => window.history.back()}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </Button>
    <h2 class="title" title={headerTitle}>{headerTitle}</h2>
    <div class="actions">
      <button
        class="btn btn-primary difficultBtn"
        type="button"
        aria-label="Mark difficult"
        disabled={loading}
        on:click={handleDifficult}>難しい</button
      >
    </div>
  </header>
  <p class="interaction-help" aria-label="Usage help">
    クリックで単語表示、長押しで文章の意味を表示
  </p>

  {#if loading}
    <section class="book-text">
      <ul class="sentences" aria-live="polite">
        {#each Array(6) as _, _i}
          <li class="sentence skeleton">
            <div class="skeleton-line w-90"></div>
            <div class="skeleton-line w-60 mt-6"></div>
          </li>
        {/each}
      </ul>
    </section>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <section class="book-text">
      <article class="reader" aria-live="polite" bind:this={readerEl}>
        {#each blocks as b}
          {#if b.kind === 'paragraph'}
            <p>
              {#each b.items as s, j}
                {#key `${b.idxStart + j}`}
                  <span
                    role="button"
                    tabindex="0"
                    class="sentenceInline {selected.has(b.idxStart + j) ? 'selected' : ''}"
                    bind:this={elRefs[b.idxStart + j]}
                    on:click={(e) => handleClick(b.idxStart + j, e)}
                    on:mousedown={(e) => handleMouseDown(b.idxStart + j, e)}
                    on:contextmenu={(e) => handleContextMenu(b.idxStart + j, e)}
                    on:pointerdown={(e) => touchPointerDown(b.idxStart + j, e)}
                    on:pointermove={(e) => touchPointerMove(b.idxStart + j, e)}
                    on:pointerup={(e) => touchPointerUp(b.idxStart + j, e)}
                    on:keydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleSentence(b.idxStart + j)
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        hideBubble(b.idxStart + j)
                      }
                    }}
                    aria-pressed={selected.has(b.idxStart + j)}
                  >
                    {@html renderSentenceHTML(
                      b.idxStart + j,
                      s,
                      wordHighlights[b.idxStart + j],
                      wordTooltipVisible[b.idxStart + j],
                      wordTooltipWordIndex[b.idxStart + j]
                    )}
                  </span>
                  {#if bubbleVisible.has(b.idxStart + j)}
                    <span class="jp-translation" aria-label="Japanese translation">{s.jp}</span>
                  {/if}
                  <span class="sr-only">.</span>
                {/key}
              {/each}
            </p>
          {/if}
        {/each}
      </article>
    </section>
  {/if}

  <nav class="pagination" aria-label="Page navigation">
    <button class="btn btn-outline" type="button" aria-label="Previous page" on:click={previousPage} disabled={prevStarts.length === 0 || loading}>
      <span class="icon"><ChevronLeft size={16} /></span>
      <span class="btn-label">Previous</span>
    </button>
  <span class="page-info rate">Rate: {rateDisplay}</span>
  <button class="btn btn-outline" type="button" aria-label="Next page" on:click={nextPage} disabled={!canNext || loading}>
      <span class="btn-label">Next</span>
      <span class="icon"><ChevronRight size={16} /></span>
    </button>
  </nav>
</main>

<style>
  .bookpage {
    max-width: 800px;
    margin: 2rem auto;
    padding: 1rem;
  }
  .topbar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .actions { display: flex; gap: .5rem; align-items: center; }
  :global(.btn) { height: 2rem; padding: 0 .5rem; border-radius: 8px; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; gap: .25rem; }
  :global(.btn-ghost) { background: transparent; border-color: #e3e7ee; }
  :global(.btn-ghost):hover { background: #f6f7f9; }
  :global(.backBtn) { width: 2rem; justify-content: center; }
  .title { font-size: 1.1rem; margin: 0; }
  :global(.btn-primary) { background: #1f6feb; color: white; border-color: transparent; }
  :global(.btn-primary):hover { background: #145fd1; }
  :global(.pageBtn) svg { display: block; }
  :global(.btn) .icon { display: inline-flex; align-items: center; line-height: 1; }
  :global(.btn) .btn-label { display: inline-flex; align-items: center; }

  .error {
    color: #b00020;
  }

  .book-text {
    margin-top: 0.5rem;
  }
  .reader {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.1rem;
    line-height: 1.75;
    color: #1b1b1b;
    background: #fff;
    border: 1px solid #eceff3;
    border-radius: 12px;
    padding: 1.25rem 1.25rem 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    max-height: 75vh;
    overflow: scroll;
    word-break: normal;
    overflow-wrap: anywhere;
    hyphens: auto;
  }
  /* Subtitle now shown in topbar title */
  .sentence.skeleton {
    background: #f2f4f8;
    overflow: hidden;
  }
  .skeleton-line {
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(90deg, #e9edf3 25%, #f5f7fb 50%, #e9edf3 75%);
    background-size: 200% 100%;
    animation: shimmer 1.2s infinite;
  }
  .w-90 {
    width: 90%;
  }
  .w-60 {
    width: 60%;
  }
  .mt-6 {
    margin-top: 6px;
  }
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
  .sentenceInline {
    all: unset;
    display: inline;
    position: relative;
    cursor: pointer;
    border-radius: 4px;
    padding: 0 0.04em;
    box-decoration-break: clone;
    /* Allow native text selection */
    -webkit-touch-callout: none;
  }
  /* add a natural space after each sentence inline element */
  .sentenceInline::after {
    content: ' ';
  }
  /* but not after the last sentence in a paragraph */
  .reader p > .sentenceInline:last-child::after {
    content: '';
  }
  .sentenceInline.selected {
    background: #ffe9a8;
  }
  .sentenceInline:focus-visible {
    outline: 2px solid rgba(100, 150, 250, 0.55);
    outline-offset: 2px;
  }
  .jp-translation {
    display: block;
    font-size: 0.7rem;
    color: #0a56ad;
    margin: 0.15rem 0 0.4rem 0.25rem;
    line-height: 1.2;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }
  .interaction-help {
    font-size: 0.7rem;
    color: #666;
    margin: 0.75rem 0 0;
    text-align: center;
  }
  .pagination .page-info {
    color: #444;
    font-size: 0.95rem;
  }
  .pagination .rate {
    margin-left: 0.5rem;
  }
  :global(.word) {
    cursor: pointer;
    word-break: break-word;
  }
  :global(.word-highlight) {
    background: #e0f0ff;
    color: #0a56ad !important;
    border-radius: 3px;
    padding: 0 0.05em;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
    font-weight: 600;
    text-decoration: underline 2px solid #0a56ad;
    text-underline-offset: 2px;
  }
  :global(.word-highlight) {
    position: relative;
  }
  :global(.word-tooltip) {
    position: absolute;
    left: 50%;
    bottom: 100%;
    transform: translate(-50%, -4px);
    background: #232f3e;
    color: #fff;
    font-size: 0.65rem;
    line-height: 1.2;
    padding: 2px 4px;
    border-radius: 4px;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    pointer-events: none;
    z-index: 2;
  }
  :global(.word-tooltip.pos-left) {
    left: 0%;
    transform: translate(0, -4px);
  }
  :global(.word-tooltip.pos-right) {
    left: 100%;
    transform: translate(-100%, -4px);
  }
  :global(.word-tooltip.pos-flip) {
    bottom: auto;
    top: 100%;
    transform: translate(-50%, 4px);
  }
</style>
