<script lang="ts">
  /**
   * BookPage.svelte
   * Reader view: renders sentences, supports word highlights and sentence
   * translation toggles, infinite loading, and resume-from-localStorage.
   */
  import { onMount, tick, onDestroy } from "svelte";
  // Local sentence type
  type Sentence = {
    type: "text" | "subtitle";
    en: string;
    jp?: string;
    jp_word?: string[];
    en_word?: string[];
    level?: string;
    sentenceNo?: number;
  };
  import { getTextPage } from "$lib/api/text";
  import { selectWordAtPointer as selectWordAtPointerHelper } from "$lib/pages/bookPageUtils";
  import {
    mergeWithSavedSentences,
    setSentenceClicked,
    addClickedWordIndex,
    removeClickedWordIndex,
    readPages,
    writePages,
  } from "$lib/pages/bookProgress";
  import { ChevronLeft } from "@lucide/svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import {
    logOpenJapanese,
    logDifficultBtn,
    logOpenWord,
  } from "$lib/api/logging";
  import SentenceInline from "$lib/pages/components/SentenceInline.svelte";

  export let bookId: string;

  // UI state
  let loading = true;
  let error: string | null = null;
  let sentences: Sentence[] = [];
  let selected = new Set<number>();
  let bubbleVisible = new Set<number>();

  // Pagination / reader state
  let currentStart = 0;
  let lastEnd = 0;
  let canNext = false;
  let readerEl: HTMLElement | null = null;
  let _wordsPerPage = 0;

  // Page boundary tracking (maps in-memory index -> API start sentence)
  let pageBoundaries: Set<number> = new Set();
  const boundaryEls: Record<number, HTMLElement | null> = {};
  const pageBoundaryMap: Record<number, number> = {};
  const pageNumberForBoundary: Record<number, number> = {};
  let pageCount = 0;

  let lastLoadCompletedAt: number | null = null;
  let firstLoad = true;

  // User-adjustable reading rate (persisted per-book)
  let userRate: number | null = null;
  let difficultBtnPending = false;
  const rateStorageKey = (id: string) => `bookRate:${id}`;
  // Per-book top-sentence number storage (stable across loads and resizes)
  const topSentenceStorageKey = (id: string) => `bookTopSentence:${id}`;
  let _scrollSaveTimer: number | null = null;
  const SCROLL_SAVE_DEBOUNCE = 200;

  function getTopVisibleSentenceIndex(): number | null {
    if (!readerEl) return null;
    const readerRect = readerEl.getBoundingClientRect();
    // prefer the first element whose top is at-or-below the reader top + 1px
    for (let i = 0; i < sentences.length; i++) {
      const el = elRefs[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= readerRect.top + 1) return i;
    }
    // fallback: find the last element whose top is <= reader top
    let lastMatch: number | null = null;
    for (let i = 0; i < sentences.length; i++) {
      const el = elRefs[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top <= readerRect.top + 1) lastMatch = i;
    }
    return lastMatch;
  }

  // Phrase highlight / tooltip state
  const WORD_TOOLTIP_MS = 5000;
  let wordHighlights: Record<number, Set<number>> = {};
  let wordTooltipWordIndex: Record<number, number> = {};
  let wordTooltipVisible: Record<number, boolean> = {};
  const wordTooltipTimers = new Map<number, number>();

  // Touch long-press helpers
  const touchPresses: Record<
    number,
    { timer: number; startX: number; startY: number; triggered: boolean }
  > = {};
  const LONG_PRESS_TOUCH_MS = 520;
  const TOUCH_MOVE_CANCEL_PX = 16;
  let suppressClickForSentence: number | null = null;
  let lastLongPressAt = 0;
  let _lastWordSelectionAt = 0;
  const elRefs: Record<number, HTMLElement | null> = {};
  const subtitleRefs: Record<number, HTMLElement | null> = {};
  let currentSubtitle: string | null = null;
  let _subtitleUpdateTimer: number | null = null;

  /** Fetch a page of sentences. start===0 replaces content; otherwise append. */
  async function loadPage(start = 0, charCountParam?: number) {
    const isInitial = start === 0;
    if (isInitial) loading = true;
    error = null;
    // If loading the first chunk, replace; otherwise append
    if (isInitial) {
      sentences = [];
      pageBoundaries = new Set();
    }
    // clear transient word render cache (recomputed lazily)
    try {
      // Compute telemetry: seconds since last completed page load
      const timeSec = lastLoadCompletedAt
        ? Math.max(0, Math.round((Date.now() - lastLoadCompletedAt) / 1000))
        : null;
      let res: {
        text: Array<{
          type: "text" | "subtitle";
          sentenceNo: number;
          en: string;
          jp?: string;
          jp_word?: string[];
        }>;
        endSentenceNo: number;
      };

      // Build and log API params
      // Telemetry counters: null on first page load, then zero if no interactions.
      // Determine if this is the very first load by checking firstLoad flag and start===0.
      const hasInteractions =
        Object.keys(wordHighlights).length > 0 || selected.size > 0;
      const wordClickCountParam = firstLoad && start === 0 ? null : 0;
      const sentenceClickCountParam = firstLoad && start === 0 ? null : 0;

      const apiParams = {
        bookId,
        startSentenceNo: start,
        userId:
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("userId")) ||
          "anonymous",
        charCount: charCountParam,
        time: timeSec,
        difficultBtn: difficultBtnPending ? true : undefined,
        wordClickCount: wordClickCountParam,
        sentenceClickCount: sentenceClickCountParam,
      };
      console.debug("[BookPage] getTextPage params ->", apiParams);

      // Request real text page from backend
      const apiRes = await getTextPage(apiParams);
      res = apiRes;
      // consume the pending difficult flag after the request so subsequent
      // calls are normal unless the user presses the button again.
      difficultBtnPending = false;
      if (apiRes.rate !== null && !Number.isNaN(apiRes.rate)) {
        userRate = apiRes.rate;
        try {
          localStorage.setItem(rateStorageKey(bookId), String(userRate));
        } catch {
          /* ignore persist */
        }
      }

      // Map to local Sentence shape and merge any saved progress
      const mapped = res.text.map((t) => ({
        type: t.type,
        en: t.en,
        jp: t.jp,
        jp_word: t.jp_word,
        en_word: (t as any).en_word ?? (t as any).en_phrase,
        level: String(t.sentenceNo),
        sentenceNo: t.sentenceNo,
      }));
      const newSentences = mergeWithSavedSentences(
        bookId,
        mapped,
      ) as Sentence[];
      if (start === 0) {
        sentences = newSentences;
        currentStart = start;
        pageCount = 1;
        // persist initial fetch as first page
        try {
          writePages(bookId, [[...sentences].map((s) => toStoredSentence(s))]);
        } catch {
          /* ignore */
        }
      } else {
        const beforeLen = sentences.length;
        // record soft page boundary at the index where new chunk begins
        pageBoundaries.add(beforeLen);
        pageBoundaries = new Set(pageBoundaries);
        // map the sentence array index to the API startSentenceNo requested
        pageBoundaryMap[beforeLen] = start;
        // record an ordinal page number for this boundary
        pageCount = (pageCount || 1) + 1;
        pageNumberForBoundary[beforeLen] = pageCount;
        sentences = sentences.concat(newSentences);
        console.debug("[BookPage] 📥 Appended sentences", {
          fetched: newSentences.length,
          beforeLen,
          afterLen: sentences.length,
          startSentenceNoRequested: start,
          page: pageCount,
        });
        // persist updated pages after append
        try {
          writePages(
            bookId,
            pagesFromSentences().map((pg) =>
              pg.map((s) => toStoredSentence(s)),
            ),
          );
        } catch {
          /* ignore */
        }
      }
      // update pagination state (lastEnd always moves forward if we received anything)
      if (newSentences.length > 0) {
        lastEnd = res.endSentenceNo;
        // backend provided content -> allow loading next
        canNext = true;
      }
      // Important: render the reader content now so measurement can find it
      loading = false;

      if (firstLoad) firstLoad = false;
    } catch (_e: unknown) {
      const e = _e as Error | undefined;
      error = e instanceof Error ? e.message : "Failed to load text";
    } finally {
      if (isInitial) loading = false;
      lastLoadCompletedAt = Date.now();
    }
  }

  // Convert current sentences and pageBoundaries into pages for persistence.
  function pagesFromSentences(): Sentence[][] {
    if (!sentences || sentences.length === 0) return [];
    const boundaries = Array.from(pageBoundaries).sort((a, b) => a - b);
    const pages: Sentence[][] = [];
    let start = 0;
    for (const b of boundaries) {
      pages.push(sentences.slice(start, b));
      start = b;
    }
    // last page
    pages.push(sentences.slice(start));
    return pages;
  }

  // Helper: convert our in-memory Sentence to the persisted StoredSentence shape
  // We intentionally read persisted fields if present (mergeWithSavedSentences
  // will attach them), and default to sensible empties otherwise.
  function toStoredSentence(s: Sentence) {
    return {
      type: s.type,
      sentenceNo: s.sentenceNo ?? -1,
      en: s.en,
      jp: s.jp,
      jp_word: s.jp_word,
      en_word: (s as any).en_word,
      clickedWordIndex: Array.isArray((s as any).clickedWordIndex)
        ? (s as any).clickedWordIndex.slice()
        : [],
      sentenceClicked: !!(s as any).sentenceClicked,
    };
  }

  // Test hook (Vitest): allow forcing a next load from tests
  if (typeof window !== "undefined" && (window as any).__VITEST__) {
    (window as any).__bookPageForceNext = () => {
      // simulate advancing by lastEnd to request next chunk
      void loadPage(lastEnd);
    };
  }

  // Infinite scroll helpers
  let loadingMore = false;
  async function loadMore() {
    if (loadingMore || loading) return;
    if (!canNext && sentences.length > 0) return;
    loadingMore = true;
    const nextStart = lastEnd + 1;
    await loadPage(nextStart, getCharCountForViewport());
    loadingMore = false;
  }

  function toggleSentence(i: number) {
    const wasSelected = selected.has(i);
    if (wasSelected) {
      // unselect
      selected.delete(i);
      selected = new Set(selected);
      // hide bubble when unselecting
      bubbleVisible.delete(i);
      bubbleVisible = new Set(bubbleVisible);
      // persist deselect
      try {
        const s = sentences[i];
        setSentenceClicked(bookId, s?.sentenceNo ?? i, s?.en ?? "", false);
      } catch {
        /* ignore */
      }
      return;
    }

    // select
    selected.add(i);
    selected = new Set(selected);

    // Fire sentence translation open log (first time only)
    {
      const s = sentences[i];
      const _sentenceNo = s?.sentenceNo ?? i; // currently unused; kept for potential future feedback extension
      // Fire-and-forget; swallow errors to avoid test noise / UI disruption
      void logOpenJapanese(
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("userId")) ||
          "anonymous",
        userRate ?? 0,
        s?.sentenceNo ?? i,
      ).catch(() => {});
      // persist that this sentence was clicked/opened
      try {
        setSentenceClicked(bookId, s?.sentenceNo ?? i, s?.en ?? "", true);
      } catch {
        /* ignore storage errors */
      }
    }
    showBubble(i);
  }

  // Interaction handlers
  // Left click: toggle/select a phrase
  function handleClick(i: number, e: MouseEvent) {
    if (e.button !== 0) return;
    // If a long-press just triggered sentence translation, suppress immediate word selection
    if (suppressClickForSentence === i && Date.now() - lastLongPressAt < 600) {
      suppressClickForSentence = null;
      return;
    }
    const idx = getWordIndexAtPointer(i, e as unknown as PointerEvent);
    if (idx == null) return;
    const set = wordHighlights[i] || (wordHighlights[i] = new Set<number>());
    if (set.has(idx)) {
      set.delete(idx);
      if (wordTooltipWordIndex[i] === idx) delete wordTooltipWordIndex[i];
      if (set.size === 0) delete wordHighlights[i];
      reassignWordHighlights();
      hideWordTooltip(i);
      // remove persisted clicked word index
      try {
        const s = sentences[i];
        removeClickedWordIndex(bookId, s?.sentenceNo ?? i, s?.en ?? "", idx);
      } catch {
        /* ignore */
      }
      return;
    }
    set.add(idx);
    wordTooltipWordIndex[i] = idx;
    reassignWordHighlights();

    _lastWordSelectionAt = Date.now();
    try {
      const sentence = sentences[i];
      const rawText = sentence?.en ?? "";
      // Prefer phrase text if provided; otherwise compute word by regex
      let wordValue: string | undefined;
      const phrases = (sentence as any)?.en_word as string[] | undefined;
      if (phrases && phrases[idx] != null) {
        wordValue = String(phrases[idx]);
      } else {
        const re = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
        const words: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(rawText)) !== null) words.push(m[0]);
        wordValue = words[idx];
      }
      if (!wordValue) wordValue = String(idx);
      void logOpenWord(
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("userId")) ||
          "anonymous",
        userRate ?? 0,
        wordValue,
      );
      // persist clicked word index for resume
      try {
        addClickedWordIndex(
          bookId,
          sentence?.sentenceNo ?? i,
          sentence?.en ?? "",
          idx,
        );
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore word log */
    }
    showWordTooltip(i, idx);
  }

  // Context menu (right-click): toggle sentence translation
  function handleContextMenu(i: number, e: MouseEvent) {
    e.preventDefault();
    // If a long-press already toggled this sentence, or a long-press is
    // currently armed for this sentence, suppress the following contextmenu
    // to avoid an immediate double-toggle.
    const press = touchPresses[i];
    if (
      (suppressClickForSentence === i && Date.now() - lastLongPressAt < 600) ||
      (press && press.triggered)
    ) {
      suppressClickForSentence = null;
      return;
    }
    toggleSentence(i);
  }

  // Fallback: right-button mousedown toggles sentence translation
  function handleMouseDown(i: number, e: MouseEvent) {
    if (e.button !== 2) return;
    toggleSentence(i);
  }

  // Helper to get word index from pointer/mouse event
  function getWordIndexAtPointer(
    i: number,
    e: PointerEvent,
  ): number | undefined {
    return selectWordAtPointer(i, e);
  }

  // --- Touch long press (simulate right click) ---
  function touchPointerDown(i: number, e: PointerEvent) {
    // Start a long-press timer for primary pointers (touch or mouse).
    if ((e as any).isPrimary === false) return;
    const existing = touchPresses[i];
    if (existing && existing.timer) window.clearTimeout(existing.timer);
    touchPresses[i] = {
      startX: e.clientX,
      startY: e.clientY,
      triggered: false,
      timer: window.setTimeout(() => {
        // Long press elapsed -> FIRE the long-press immediately so the UI
        // responds while the user is still holding the finger/mouse.
        try {
          touchPresses[i].triggered = true;
          console.debug("[BookPage] long-press fired", { sentenceIndex: i });
          // Perform the toggle now (instant feedback)
          toggleSentence(i);
          // Suppress the following click/contextmenu that the browser may emit
          // after pointerup so we don't get a duplicate toggle.
          suppressClickForSentence = i;
          lastLongPressAt = Date.now();
          // clear any text selection that may result from the press
          try {
            window.getSelection()?.removeAllRanges();
          } catch {
            /* ignore */
          }
        } catch {
          /* ignore */
        }
      }, LONG_PRESS_TOUCH_MS),
    };
  }

  function touchPointerMove(i: number, e: PointerEvent) {
    // Cancel long-press if pointer moved too far (for touch or mouse drag)
    const press = touchPresses[i];
    if (!press || press.triggered) return;
    const dx = e.clientX - press.startX;
    const dy = e.clientY - press.startY;
    if (Math.hypot(dx, dy) > TOUCH_MOVE_CANCEL_PX) {
      window.clearTimeout(press.timer);
      delete touchPresses[i];
    }
  }

  function touchPointerUp(i: number, e: PointerEvent) {
    const press = touchPresses[i];
    if (!press) return;
    window.clearTimeout(press.timer);
    const wasArmed = press.triggered;
    // remove the stored press entry immediately
    delete touchPresses[i];
    if (wasArmed) {
      // The long-press already fired on timer -> do NOT toggle again here.
      // Keep suppressClickForSentence in place (set when the timer fired)
      // and prevent default to avoid accidental selection.
      try {
        window.getSelection()?.removeAllRanges();
      } catch {
        /* ignore */
      }
      e.preventDefault?.();
    }
  }

  // Cancel all pending touch long-press timers
  function cancelAllTouchPresses() {
    for (const _k in touchPresses) {
      const t = touchPresses[_k];
      if (t && t.timer) window.clearTimeout(t.timer);
      delete touchPresses[Number(_k)];
    }
  }

  function selectWordAtPointer(i: number, e: PointerEvent) {
    const spanEl = elRefs[i];
    return selectWordAtPointerHelper(spanEl, e);
  }
  // pickWordByRatio helper intentionally removed to avoid unused symbol

  function reassignWordHighlights() {
    // clone sets to trigger Svelte reactivity
    const clone: Record<number, Set<number>> = {};
    for (const _k in wordHighlights) clone[_k] = new Set(wordHighlights[_k]);
    wordHighlights = clone;
    console.debug(
      "[BookPage] wordHighlights state (multiple)",
      Object.fromEntries(
        Object.entries(wordHighlights).map(([key, v]) => [key, Array.from(v)]),
      ),
    );
  }

  // Tooltip helpers
  function showWordTooltip(i: number, wordIdx?: number) {
    // clear existing
    const existing = wordTooltipTimers.get(i);
    if (existing) window.clearTimeout(existing);
    if (wordIdx !== undefined) wordTooltipWordIndex[i] = wordIdx;
    wordTooltipVisible[i] = true;
    // force reactive update
    wordTooltipVisible = { ...wordTooltipVisible };
    // schedule hide
    const id = window.setTimeout(() => hideWordTooltip(i), WORD_TOOLTIP_MS);
    wordTooltipTimers.set(i, id);
    // next frame adjust position to avoid clipping
    requestAnimationFrame(() => adjustWordTooltipPosition(i));
  }

  function hideWordTooltip(i: number) {
    delete wordTooltipVisible[i];
    delete wordTooltipWordIndex[i];
    // force reactive update
    wordTooltipVisible = { ...wordTooltipVisible };
    const existing = wordTooltipTimers.get(i);
    if (existing) window.clearTimeout(existing);
    wordTooltipTimers.delete(i);
  }
  // Difficulty button: adjust user rate and reload
  async function handleDifficult() {
    if (loading) return;
    const prevRate = userRate ?? 0;
    userRate = Math.max(0, prevRate - 300);
    try {
      localStorage.setItem(rateStorageKey(bookId), String(userRate));
    } catch {
      /* ignore persist */
    }
    console.debug("[BookPage] 難しい pressed: lowering rate", {
      previous: prevRate,
      new: userRate,
    });
    // Log difficult button press with previous rate (state before adjustment)
    void logDifficultBtn(
      (typeof localStorage !== "undefined" && localStorage.getItem("userId")) ||
        "anonymous",
      prevRate,
    ).catch(() => {});

    // mark that next getTextPage should include difficultBtn=true
    difficultBtnPending = true;

    // Re-load current page with same start & charCount. The pending flag
    // will cause the request to include `difficultBtn=true` so backend can
    // return an updated `rate` value which we persist locally when received.
    await loadPage(currentStart, getCharCountForViewport());
  }

  // Position word tooltip to avoid clipping
  function adjustWordTooltipPosition(sentenceIdx: number) {
    const container = document.querySelector(
      "article.reader",
    ) as HTMLElement | null;
    if (!container) return;
    const wordIdx = wordTooltipWordIndex[sentenceIdx];
    if (wordIdx == null) return;
    const sentenceEl = elRefs[sentenceIdx];
    if (!sentenceEl) return;
    const wordEl = sentenceEl.querySelector(
      `span.word[data-wi="${wordIdx}"]`,
    ) as HTMLElement | null;
    if (!wordEl) return;
    const tip = wordEl.querySelector(".word-tooltip") as HTMLElement | null;
    if (!tip) return;
    // Reset modifier classes
    tip.classList.remove("pos-left", "pos-right", "pos-flip");
    const tipRect = tip.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const padding = 4;
    // Compute adjustments and apply inline styles to avoid custom CSS classes.
    // Reset any inline adjustments first
    tip.style.removeProperty("left");
    tip.style.removeProperty("right");
    tip.style.removeProperty("transform");
    tip.style.removeProperty("bottom");
    tip.style.removeProperty("top");
    // Horizontal overflow: nudge tooltip so it stays within container
    const overLeft = tipRect.left - (containerRect.left + padding);
    const overRight = tipRect.right - (containerRect.right - padding);
    if (overLeft < 0) {
      // shift tooltip right by the deficit
      const shift = Math.abs(overLeft);
      tip.style.transform = `translateX(${shift}px)`;
    } else if (overRight > 0) {
      const shift = -Math.abs(overRight);
      tip.style.transform = `translateX(${shift}px)`;
    }
    // Vertical: if not enough space above, flip below the word
    if (tipRect.top < containerRect.top + 4) {
      // place tooltip below the word
      tip.style.bottom = "auto";
      tip.style.top = "100%";
      tip.style.marginTop = "6px";
    } else {
      tip.style.bottom = "100%";
      tip.style.marginBottom = "8px";
    }
  }

  function showBubble(i: number) {
    bubbleVisible.add(i);
    bubbleVisible = new Set(bubbleVisible);
  }

  function hideBubble(i: number) {
    bubbleVisible.delete(i);
    bubbleVisible = new Set(bubbleVisible);
  }

  // Lifecycle: initial load and observers
  onMount(async () => {
    // Load persisted user rate if available
    try {
      const stored = localStorage.getItem(rateStorageKey(bookId));
      if (stored) {
        const num = Number(stored);
        if (!Number.isNaN(num)) userRate = num;
      }
    } catch {
      /* ignore localStorage */
    }
    // If we have stored pages for this book, use them and skip the API initial call.
    try {
      const storedPages = readPages(bookId);
      if (storedPages && storedPages.length > 0) {
        // flatten to sentences (use Array.flat to preserve types)
        sentences = storedPages.flat() as Sentence[];
        // restore selected sentences and word highlights from stored state
        selected = new Set<number>();
        bubbleVisible = new Set<number>();
        const wh: Record<number, Set<number>> = {};
        for (let i = 0; i < sentences.length; i++) {
          const s = sentences[i] as any;
          if (s.sentenceClicked) {
            selected.add(i);
            bubbleVisible.add(i);
          }
          if (
            Array.isArray(s.clickedWordIndex) &&
            s.clickedWordIndex.length > 0
          ) {
            wh[i] = new Set(s.clickedWordIndex as number[]);
          }
        }
        wordHighlights = wh;
        // recompute pageBoundaries and pageCount
        pageBoundaries = new Set<number>();
        let idx = 0;
        pageCount = storedPages.length;
        for (let p = 0; p < storedPages.length; p++) {
          if (p === 0) {
            // first page starts at 0
          } else {
            pageBoundaries.add(idx);
            pageNumberForBoundary[idx] = p + 1;
          }
          idx += storedPages[p].length;
        }
        lastEnd =
          sentences.length > 0
            ? (sentences[sentences.length - 1].sentenceNo ?? 0)
            : 0;
        currentStart = 0;
        loading = false;
        // after DOM updates, scroll to top of last page so user resumes there
        await tick();
        // Prefer restoring by top-visible sentence index; fall back to
        // previous 'last page start' jump when no saved index exists.
        let restored = false;
        try {
          const raw = localStorage.getItem(topSentenceStorageKey(bookId));
          if (raw != null) {
            const savedSentenceNo = Number(raw);
            if (!Number.isNaN(savedSentenceNo) && readerEl) {
              // find the current index of the saved sentence number
              const foundIdx = sentences.findIndex(
                (s) => (s.sentenceNo ?? -1) === savedSentenceNo,
              );
              if (foundIdx >= 0) {
                // show the previous sentence so the reader can re-read a bit
                const displayIdx = Math.max(0, foundIdx - 1);
                const el = elRefs[displayIdx];
                if (el) {
                  // Temporarily disconnect observer to avoid triggering loads while we programmatically scroll
                  try {
                    if (observer) observer.disconnect();
                  } catch {
                    /* ignore */
                  }
                  _suppressAutoLoad = true;
                  _lastScrollTriggerAt = Date.now();
                  // compute delta between element top and container top and adjust scrollTop
                  const containerRect = readerEl.getBoundingClientRect();
                  const elRect = el.getBoundingClientRect();
                  // Align the sentence top to the reader top with a small padding
                  const paddingTop = 8; // show the sentence from near the top
                  const targetScrollTop =
                    readerEl.scrollTop +
                    Math.round(elRect.top - containerRect.top - paddingTop);
                  readerEl.scrollTop = targetScrollTop;
                  window.setTimeout(() => {
                    _suppressAutoLoad = false;
                  }, 120);
                  await tick();
                  initInfiniteObserver();
                  restored = true;
                }
              }
            }
          }
        } catch {
          /* ignore localStorage */
        }
        if (!restored) {
          // compute index of last page start and jump there as a fallback
          const sortedBoundaries = Array.from(pageBoundaries).sort(
            (a, b) => a - b,
          );
          const lastPageStartIdx =
            sortedBoundaries.length > 0
              ? sortedBoundaries[sortedBoundaries.length - 1]
              : 0;
          const displayIdx = Math.max(0, lastPageStartIdx - 1);
          const el = elRefs[displayIdx];
          if (readerEl && el) {
            try {
              if (observer) observer.disconnect();
            } catch {
              /* ignore */
            }
            const containerRect = readerEl.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const paddingTop = 8;
            const targetScrollTop =
              readerEl.scrollTop +
              Math.round(elRect.top - containerRect.top - paddingTop);
            _suppressAutoLoad = true;
            _lastScrollTriggerAt = Date.now();
            readerEl.scrollTop = targetScrollTop;
            window.setTimeout(() => {
              _suppressAutoLoad = false;
            }, 120);
            await tick();
            initInfiniteObserver();
          }
        }
      } else {
        // initial load: compute charCount from viewport size and request first chunk
        try {
          const charCount = getCharCountForViewport();
          await loadPage(0, charCount);
        } catch (_e) {
          // fallback to calling without charCount
          await loadPage(0);
        }
      }
    } catch (_err) {
      // fallback to normal loading if storage read fails
      try {
        const charCount = getCharCountForViewport();
        await loadPage(0, charCount);
      } catch {
        await loadPage(0);
      }
    }

    // wait for DOM to update so sentinel binds inside readerEl
    await tick();
    // setup scroll listener and observer
    if (readerEl) {
      readerEl.addEventListener("scroll", updateScrollProgressDebounced, {
        passive: true,
      });
      // persist top-visible sentence index (debounced)
      const saveTopSentenceDebounced = () => {
        if (_scrollSaveTimer) window.clearTimeout(_scrollSaveTimer);
        _scrollSaveTimer = window.setTimeout(() => {
          try {
            const idx = getTopVisibleSentenceIndex();
            if (idx != null) {
              const s = sentences[idx];
              if (s && s.sentenceNo != null) {
                localStorage.setItem(
                  topSentenceStorageKey(bookId),
                  String(s.sentenceNo),
                );
              }
            }
          } catch {
            /* ignore */
          }
          _scrollSaveTimer = null;
        }, SCROLL_SAVE_DEBOUNCE) as unknown as number;
      };
      readerEl.addEventListener("scroll", saveTopSentenceDebounced, {
        passive: true,
      });
      // initial progress calc
      updateScrollProgressDebounced();
      // also update subtitle header on scroll
      readerEl.addEventListener("scroll", updateCurrentSubtitleDebounced, {
        passive: true,
      });
      // cancel any pending touch long-press timers when the user scrolls
      readerEl.addEventListener("scroll", cancelAllTouchPresses, {
        passive: true,
      });
    }
    initInfiniteObserver();
  });

  onDestroy(() => {
    // ensure scroll-save timer cleared
    if (_scrollSaveTimer) window.clearTimeout(_scrollSaveTimer);
  });

  onDestroy(() => {
    if (readerEl)
      readerEl.removeEventListener("scroll", updateScrollProgressDebounced);
    if (readerEl)
      readerEl.removeEventListener("scroll", updateCurrentSubtitleDebounced);
  });

  // Compute a conservative charCount based on viewport breakpoint sizing
  // using simple breakpoints similar to sm/md/lg. Return approximate
  // character count to pass to backend.
  function getCharCountForViewport(): number {
    // Use readerEl bounds when available, otherwise approximate from window
    const width = readerEl
      ? readerEl.clientWidth
      : typeof window !== "undefined"
        ? window.innerWidth
        : 800;
    // Breakpoints (approx): phone <= 640, md <= 1024, lg > 1024
    // Assign target character counts per viewport category. Tuned conservative values.
    if (width <= 640) return 1500;
    if (width <= 1024) return 3000;
    return 4500;
  }

  // Debounced near-bottom loader (kept as helper but uses direct event handling)
  let _scrollDebounceTimer: number | null = null;
  const SCROLL_DEBOUNCE_MS = 120;
  // trigger earlier: ~8 lines from bottom
  const LINES_FROM_BOTTOM = 8;
  const EXTRA_TRIGGER_PX = 12;
  const SCROLL_TRIGGER_COOLDOWN_MS = 2500;
  let _lastScrollTriggerAt = 0;
  let _suppressAutoLoad = false;

  function checkAndLoadNearBottom() {
    if (_suppressAutoLoad) return;
    if (!readerEl) return;
    try {
      const el = readerEl;
      const scrollTop = el.scrollTop;
      const clientHeight = el.clientHeight;
      const scrollHeight = el.scrollHeight;
      const distanceFromBottom = Math.max(
        0,
        scrollHeight - (scrollTop + clientHeight),
      );

      const cs = window.getComputedStyle(el);
      let lineHeight = parseFloat(cs.lineHeight || "");
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        const fontSize = parseFloat(cs.fontSize || "") || 16;
        lineHeight = Math.round(fontSize * 1.25);
      }

      const thresholdPx = LINES_FROM_BOTTOM * lineHeight + EXTRA_TRIGGER_PX;
      if (distanceFromBottom <= thresholdPx) {
        const now = Date.now();
        if (now - _lastScrollTriggerAt < SCROLL_TRIGGER_COOLDOWN_MS) return;
        _lastScrollTriggerAt = now;
        if (lastEnd && lastEnd > 0) {
          void loadPage(lastEnd + 1, getCharCountForViewport()).catch(() => {});
        } else {
          void loadMore().catch(() => {});
        }
      }
    } catch (_e) {
      console.debug("[BookPage] checkAndLoadNearBottom error", _e);
    }
  }

  function updateScrollProgressDebounced() {
    if (_scrollDebounceTimer) window.clearTimeout(_scrollDebounceTimer);
    _scrollDebounceTimer = window.setTimeout(() => {
      _scrollDebounceTimer = null;
      checkAndLoadNearBottom();
    }, SCROLL_DEBOUNCE_MS) as unknown as number;
  }

  // Intersection observer sentinel (bottom marker)
  let sentinel: HTMLElement | null = null;
  let observer: IntersectionObserver | null = null;
  function initInfiniteObserver() {
    if (observer) observer.disconnect();
    if (!readerEl) return;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            // determine the boundary index by searching boundaryEls
            const idx = Number(
              Object.entries(boundaryEls).find(([_k, v]) => v === el)?.[0],
            );
            if (!Number.isFinite(idx)) continue;
            // unobserve this boundary to avoid duplicate triggers
            observer?.unobserve(el);
            delete boundaryEls[idx];
            // map to API start sentence
            const startSentenceNo = pageBoundaryMap[idx];
            if (startSentenceNo != null) {
              // request next chunk for this boundary
              void loadPage(startSentenceNo, getCharCountForViewport());
            } else {
              // fallback to generic loadMore
              void loadMore();
            }
          }
        }
      },
      {
        root: readerEl,
        // trigger when the boundary is within the bottom 20% of the reader
        rootMargin: "0px 0px -20% 0px",
        threshold: 0,
      },
    );
    // observe all existing boundaryEls
    for (const _k in boundaryEls) {
      const el = boundaryEls[_k];
      // Only observe boundaries that have a mapped start sentence (from API runs).
      // If we loaded pages from storage, pageBoundaryMap may not have an entry
      // for these boundaries — do not observe them to avoid accidental API calls.
      if (el && pageBoundaryMap[_k] != null) observer.observe(el);
    }
  }
  onDestroy(() => observer && observer.disconnect());
  // Update the currently visible subtitle (the latest subtitle whose element
  // is within or above the top of the reader viewport). This keeps a sticky
  // header aligned with the content beneath.
  function updateCurrentSubtitle() {
    if (!readerEl) return;
    try {
      // Find the last subtitle element that is not below the reader's top
      const readerRect = readerEl.getBoundingClientRect();
      let lastSubtitle: { idx: number; text: string } | null = null;
      for (const b of blocks) {
        if (b.kind !== "subtitle") continue;
        const idx = b.idx;
        const el = subtitleRefs[idx];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        // If the subtitle's top is less than or equal to the reader's top + 4px
        // then it's considered at-or-above the top of the visible area.
        if (rect.top <= readerRect.top + 4) {
          lastSubtitle = { idx, text: b.item.en };
        }
      }
      const newText = lastSubtitle ? lastSubtitle.text : null;
      // If we didn't find any subtitle above the top, but we're on the
      // initial page (currentStart === 0), show the first subtitle as a
      // reasonable chapter heading instead of leaving the header empty.
      let finalText = newText;
      if (!finalText && currentStart === 0) {
        const firstSub = blocks.find((bb) => bb.kind === "subtitle") as
          | { kind: "subtitle"; item: Sentence; idx: number }
          | undefined;
        if (firstSub) finalText = firstSub.item.en;
      }
      if (finalText !== currentSubtitle) currentSubtitle = finalText;
    } catch (_e) {
      console.debug("[BookPage] updateCurrentSubtitle error", _e);
    }
  }

  function updateCurrentSubtitleDebounced() {
    if (_subtitleUpdateTimer) window.clearTimeout(_subtitleUpdateTimer);
    _subtitleUpdateTimer = window.setTimeout(() => {
      _subtitleUpdateTimer = null;
      updateCurrentSubtitle();
    }, 80) as unknown as number;
  }

  // Build book-like blocks: paragraphs of text and standalone subtitles
  type Block =
    | { kind: "paragraph"; idxStart: number; idxEnd: number; items: Sentence[] }
    | { kind: "subtitle"; item: Sentence; idx: number };
  function buildBlocks(list: Sentence[]): Block[] {
    const blocks: Block[] = [];
    let idxStart = -1;
    let acc: Sentence[] = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.type === "subtitle") {
        if (acc.length > 0) {
          blocks.push({
            kind: "paragraph",
            idxStart,
            idxEnd: idxStart + acc.length - 1,
            items: acc.slice(),
          });
          acc = [];
          idxStart = -1;
        }
        blocks.push({ kind: "subtitle", item: s, idx: i });
      } else {
        if (idxStart === -1) idxStart = i;
        acc.push(s);
      }
    }
    if (acc.length > 0 && idxStart !== -1) {
      blocks.push({
        kind: "paragraph",
        idxStart,
        idxEnd: idxStart + acc.length - 1,
        items: acc.slice(),
      });
    }
    return blocks;
  }

  $: blocks = buildBlocks(sentences);
  // $: paginatedSentences = paginateByWords(mockSentences, wordsPerPage)
  $: rateDisplay = userRate !== null ? userRate : "—";

  $: if (readerEl && blocks) {
    // ensure header reflects current content after DOM updates
    // schedule on next tick to allow bindings to settle
    tick().then(() => updateCurrentSubtitleDebounced());
  }

  // sentence rendering and pointer helpers moved to `src/lib/pages/bookPageUtils.ts`
</script>

<main class="bookpage fixed inset-0 overflow-hidden overscroll-none box-border">
  <div
    class="w-full max-w-[800px] mx-auto h-full py-8 px-4 box-border flex flex-col"
  >
    <header
      class="topbar grid grid-cols-[auto_1fr_auto] items-center gap-2 mb-3"
    >
      <Button
        class="btn btn-ghost backBtn"
        type="button"
        variant="outline"
        aria-label="Go back"
        onclick={() => window.history.back()}
      >
        <ChevronLeft class="w-5 h-5" />
      </Button>
      <div
        class="pl-2"
        aria-hidden={currentSubtitle == null}
        style="pointer-events: none"
      >
        {#if currentSubtitle}
          <div class="text-sm text-slate-600 font-medium">
            {currentSubtitle}
          </div>
        {/if}
      </div>
    </header>
    <p
      class="interaction-help text-[0.7rem] text-gray-600 mt-3 text-center"
      aria-label="Usage help"
    >
      クリックで単語表示、長押しで文章の意味を表示
    </p>

    {#if loading}
      <section class="book-text mt-2">
        <ul class="sentences" aria-live="polite">
          {#each Array(6) as _, _i}
            <li class="sentence skeleton space-y-2">
              <div
                class="skeleton-line w-11/12 h-3 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse"
              ></div>
              <div
                class="skeleton-line w-2/3 h-3 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse"
              ></div>
            </li>
          {/each}
        </ul>
      </section>
    {:else if error}
      <p class="error">{error}</p>
    {:else}
      <section class="book-text mt-2">
        <article
          class="reader font-serif text-[1.25rem] leading-[1.7] text-[#1b1b1b] bg-white border border-slate-200 rounded-xl px-5 pt-5 pb-6 shadow-sm max-h-[75vh] overflow-scroll break-words"
          aria-live="polite"
          bind:this={readerEl}
        >
          {#each blocks as b}
            {#if b.kind === "paragraph"}
              <div class="mb-4 last:mb-0">
                {#each b.items as s, j}
                  {#key `${b.idxStart + j}`}
                    <SentenceInline
                      idx={b.idxStart + j}
                      {s}
                      selected={selected.has(b.idxStart + j)}
                      bubbleVisible={bubbleVisible.has(b.idxStart + j)}
                      wordHighlights={wordHighlights[b.idxStart + j]}
                      wordTooltipVisible={wordTooltipVisible[b.idxStart + j]}
                      wordTooltipWordIndex={wordTooltipWordIndex[
                        b.idxStart + j
                      ]}
                      on:sentenceClick={(ev) =>
                        handleClick(ev.detail.idx, ev.detail.event)}
                      on:sentenceContextmenu={(ev) =>
                        handleContextMenu(ev.detail.idx, ev.detail.event)}
                      on:sentenceMouseDown={(ev) =>
                        handleMouseDown(ev.detail.idx, ev.detail.event)}
                      on:sentencePointerDown={(ev) =>
                        touchPointerDown(ev.detail.idx, ev.detail.event)}
                      on:sentencePointerMove={(ev) =>
                        touchPointerMove(ev.detail.idx, ev.detail.event)}
                      on:sentencePointerUp={(ev) =>
                        touchPointerUp(ev.detail.idx, ev.detail.event)}
                      on:sentenceKeydown={(ev) => {
                        const e = ev.detail.event as KeyboardEvent;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSentence(ev.detail.idx);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          hideBubble(ev.detail.idx);
                        }
                      }}
                      on:mounted={(ev) => {
                        elRefs[ev.detail.idx] = ev.detail.el;
                      }}
                      on:destroyed={(ev) => {
                        delete elRefs[ev.detail.idx];
                      }}
                    />
                  {/key}
                  {#if pageBoundaries.has(b.idxStart + j + 1)}
                    <div
                      class="page-separator my-4 flex items-center text-sm text-slate-500"
                      aria-hidden="true"
                      data-boundary-index={b.idxStart + j + 1}
                      bind:this={boundaryEls[b.idxStart + j + 1]}
                    >
                      <div class="flex-1 h-[1px] bg-slate-200"></div>
                      <div class="px-3">
                        Page {pageNumberForBoundary[b.idxStart + j + 1] ?? "—"}
                      </div>
                      <div class="flex-1 h-[1px] bg-slate-200"></div>
                    </div>
                  {/if}
                {/each}
              </div>
              <!-- inline boundary sentinels are rendered after sentences when present -->
            {/if}
            {#if b.kind === "subtitle"}
              <div
                class="subtitle-block my-3 text-sm text-slate-700 font-medium text-center"
                bind:this={subtitleRefs[b.idx]}
                data-subtitle-index={b.idx}
              >
                {b.item.en}
              </div>
            {/if}
          {/each}
          {#if true}
            <!-- sentinel inside the scrollable reader so IntersectionObserver root can observe it -->
            <div
              bind:this={sentinel}
              class="infinite-sentinel h-2"
              aria-hidden="true"
            ></div>
          {/if}
        </article>
      </section>
    {/if}

    <div class="mt-4 text-center text-sm text-slate-600">
      Rate: {rateDisplay}
    </div>
    <div class="actions flex items-center gap-2">
      <Button
        onclick={handleDifficult}
        aria-label="Mark difficult"
        disabled={loading}
      >
        難易度を下げる
      </Button>
    </div>
  </div>
</main>
