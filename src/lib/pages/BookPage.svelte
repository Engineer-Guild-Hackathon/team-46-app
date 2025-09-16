<script lang="ts">
  import { onMount, tick, onDestroy } from "svelte";
  // Local sentence type
  type Sentence = {
    type: "text" | "subtitle";
    en: string;
    jp?: string;
    jp_word?: string[];
    level?: string;
    sentenceNo?: number;
  };
  import { getTextPage } from "$lib/api/text";
  import {
    renderSentenceHTML,
    esc,
    formatSentence,
    selectWordAtPointer as selectWordAtPointerHelper,
    pickWordByRatio as pickWordByRatioHelper,
  } from "$lib/pages/bookPageUtils";
  import { ChevronLeft } from "@lucide/svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import {
    logOpenJapanese,
    logDifficultBtn,
    logOpenWord,
  } from "$lib/api/logging";

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
  let wordsPerPage = 0;

  // Page boundary tracking (for mapping appended chunks)
  let pageBoundaries: Set<number> = new Set();
  const boundaryEls: Record<number, HTMLElement | null> = {};
  const pageBoundaryMap: Record<number, number> = {};
  const pageNumberForBoundary: Record<number, number> = {};
  let pageCount = 0;

  // Telemetry counters
  let sentenceClickCountForRequest = 0;
  let wordClickCountForRequest = 0;
  let lastLoadCompletedAt: number | null = null;
  let firstLoad = true;

  // User-adjustable reading rate (persisted per-book)
  let userRate: number | null = null;
  const rateStorageKey = (id: string) => `bookRate:${id}`;

  // Word highlight / tooltip state
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

  /**
   * Fetch a page of sentences. start===0 replaces content; otherwise append.
   */
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
      const apiParams = {
        bookId,
        startSentenceNo: start,
        userId:
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("userId")) ||
          "anonymous",
        charCount: charCountParam,
        wordClickCount: firstLoad ? null : wordClickCountForRequest,
        sentenceClickCount: firstLoad ? null : sentenceClickCountForRequest,
        time: timeSec,
        rate: userRate,
      };
      console.debug("[BookPage] getTextPage params ->", apiParams);

      // Request real text page from backend
      const apiRes = await getTextPage(apiParams);
      res = apiRes;
      if (apiRes.rate !== null && !Number.isNaN(apiRes.rate)) {
        userRate = apiRes.rate;
        try {
          localStorage.setItem(rateStorageKey(bookId), String(userRate));
        } catch {
          /* ignore persist */
        }
      }

      // Map to local Sentence shape
      const newSentences = res.text.map((t) => ({
        type: t.type,
        en: t.en,
        jp: t.jp,
        jp_word: t.jp_word,
        level: String(t.sentenceNo),
        sentenceNo: t.sentenceNo,
      }));
      if (start === 0) {
        sentences = newSentences;
        currentStart = start;
        pageCount = 1;
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
      }
      // update pagination state (lastEnd always moves forward if we received anything)
      if (newSentences.length > 0) {
        lastEnd = res.endSentenceNo;
        // backend provided content -> allow loading next
        canNext = true;
      }
      // Important: render the reader content now so measurement can find it
      loading = false;

      // Reset counters for the next request (we've just reported them)
      sentenceClickCountForRequest = 0;
      wordClickCountForRequest = 0;
      if (firstLoad) firstLoad = false;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Failed to load text";
    } finally {
      if (isInitial) loading = false;
      lastLoadCompletedAt = Date.now();
    }
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
    const isNew = !selected.has(i);
    if (isNew) selected.add(i);
    selected = new Set(selected);
    sentenceClickCountForRequest++;
    // Fire sentence translation open log (first time only)
    if (isNew) {
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
    }
    showBubble(i);
  }

  // Interaction handlers
  // Left click: toggle/select a word
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
      return;
    }
    set.add(idx);
    wordTooltipWordIndex[i] = idx;
    reassignWordHighlights();
    wordClickCountForRequest++;
    _lastWordSelectionAt = Date.now();
    try {
      const sentence = sentences[i];
      const rawText = sentence?.en ?? "";
      // match words including internal apostrophes (ASCII and Unicode) and hyphens
      const re = /[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g;
      const words: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(rawText)) !== null) words.push(m[0]);
      const wordValue = words[idx] ?? String(idx);
      void logOpenWord(
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("userId")) ||
          "anonymous",
        userRate ?? 0,
        wordValue,
      );
    } catch {
      /* ignore word log */
    }
    showWordTooltip(i, idx);
  }

  // Context menu (right-click): toggle sentence translation
  function handleContextMenu(i: number, e: MouseEvent) {
    e.preventDefault();
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
    if (e.pointerType !== "touch") return;
    if ((e as any).isPrimary === false) return;
    const existing = touchPresses[i];
    if (existing && existing.timer) window.clearTimeout(existing.timer);
    touchPresses[i] = {
      startX: e.clientX,
      startY: e.clientY,
      triggered: false,
      timer: window.setTimeout(() => {
        // Long press elapsed -> toggle sentence translation (was word highlight)
        toggleSentence(i);
        suppressClickForSentence = i; // suppress immediate word selection after releasing
        lastLongPressAt = Date.now();
        touchPresses[i].triggered = true;
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          /* ignore selection */
        }
        console.debug("[BookPage] touch long-press sentence translation", {
          sentenceIndex: i,
        });
      }, LONG_PRESS_TOUCH_MS),
    };
  }

  function touchPointerMove(i: number, e: PointerEvent) {
    if (e.pointerType !== "touch") return;
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
    if (e.pointerType !== "touch") return;
    const press = touchPresses[i];
    if (!press) return;
    window.clearTimeout(press.timer);
    const wasTriggered = press.triggered;
    delete touchPresses[i];
    if (wasTriggered) {
      // prevent any stray selection
      try {
        window.getSelection()?.removeAllRanges();
      } catch {
        /* ignore selection */
      }
      e.preventDefault?.();
    }
  }

  // Cancel all pending touch long-press timers (used when the user scrolls or
  // moves substantially so we don't accidentally trigger long-press behavior)
  function cancelAllTouchPresses() {
    for (const k in touchPresses) {
      const t = touchPresses[k];
      if (t && t.timer) window.clearTimeout(t.timer);
      delete touchPresses[Number(k)];
    }
  }

  function selectWordAtPointer(i: number, e: PointerEvent) {
    const spanEl = elRefs[i];
    return selectWordAtPointerHelper(spanEl, e);
  }

  function pickWordByRatio(i: number, e: PointerEvent): number | undefined {
    const spanEl = elRefs[i];
    return pickWordByRatioHelper(spanEl, e);
  }

  function reassignWordHighlights() {
    // clone sets to trigger Svelte reactivity
    const clone: Record<number, Set<number>> = {};
    for (const k in wordHighlights) clone[k] = new Set(wordHighlights[k]);
    wordHighlights = clone;
    console.debug(
      "[BookPage] wordHighlights state (multiple)",
      Object.fromEntries(
        Object.entries(wordHighlights).map(([k, v]) => [k, Array.from(v)]),
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

    // Re-load current page with same start & charCount using updated rate (force fresh fetch)
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
    // initial load: compute charCount from viewport size and request first chunk
    try {
      const charCount = getCharCountForViewport();
      await loadPage(0, charCount);
    } catch (e) {
      // fallback to calling without charCount
      await loadPage(0);
    }

    // wait for DOM to update so sentinel binds inside readerEl
    await tick();
    // setup scroll listener and observer
    if (readerEl) {
      readerEl.addEventListener("scroll", updateScrollProgressDebounced, {
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

  function checkAndLoadNearBottom() {
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
    } catch (e) {
      console.debug("[BookPage] checkAndLoadNearBottom error", e);
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
              Object.entries(boundaryEls).find(([k, v]) => v === el)?.[0],
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
    for (const k in boundaryEls) {
      const el = boundaryEls[k];
      if (el) observer.observe(el);
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
    } catch (e) {
      console.debug("[BookPage] updateCurrentSubtitle error", e);
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
                    <span
                      role="button"
                      tabindex="0"
                      class="sentenceInline inline relative cursor-pointer rounded px-[0.04em] {selected.has(
                        b.idxStart + j,
                      )
                        ? 'selected bg-amber-200'
                        : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300"
                      bind:this={elRefs[b.idxStart + j]}
                      on:click={(e) => handleClick(b.idxStart + j, e)}
                      on:mousedown={(e) => handleMouseDown(b.idxStart + j, e)}
                      on:contextmenu={(e) =>
                        handleContextMenu(b.idxStart + j, e)}
                      on:pointerdown={(e) =>
                        touchPointerDown(b.idxStart + j, e)}
                      on:pointermove={(e) =>
                        touchPointerMove(b.idxStart + j, e)}
                      on:touchmove={() => cancelAllTouchPresses()}
                      on:pointerup={(e) => touchPointerUp(b.idxStart + j, e)}
                      on:keydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSentence(b.idxStart + j);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          hideBubble(b.idxStart + j);
                        }
                      }}
                      aria-pressed={selected.has(b.idxStart + j)}
                    >
                      {@html renderSentenceHTML(
                        b.idxStart + j,
                        s,
                        wordHighlights[b.idxStart + j],
                        wordTooltipVisible[b.idxStart + j],
                        wordTooltipWordIndex[b.idxStart + j],
                      )}
                    </span>
                    {#if bubbleVisible.has(b.idxStart + j)}
                      <span
                        class="jp-translation block text-[0.9rem] text-[#0a56ad] mt-1 ml-1 leading-[1.2]"
                        aria-label="Japanese translation">{s.jp}</span
                      >
                    {/if}
                    <span class="sr-only">.</span>
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
        type="button"
        aria-label="Mark difficult"
        disabled={loading}
        on:click={handleDifficult}>難易度を下げる</Button
      >
    </div>
    <div
      bind:this={sentinel}
      class="infinite-sentinel h-2"
      aria-hidden="true"
    ></div>
  </div>
</main>
