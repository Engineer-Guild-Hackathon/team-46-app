<script lang="ts">
  /**
   * BookPage.svelte - Refactored
   * A cleaner, more modular reader component using composition of smaller components
   */
  import { onMount, tick, onDestroy } from "svelte";
  import { createBookPageStore } from "./stores/bookPageStore";
  import { createInteractionHandlers } from "./services/interactionService";
  import { selectWordAtPointer as selectWordAtPointerHelper } from "./bookPageUtils";
  import BookPageHeader from "./components/BookPageHeader.svelte";
  import BookPageUsageHelp from "./components/BookPageUsageHelp.svelte";
  import BookPageReader from "./components/BookPageReader.svelte";

  // API and utilities
  import { getTextPage } from "$lib/api/text";
  import {
    mergeWithSavedSentences,
    readPages,
    writePages,
  } from "./bookProgress";
  import { logDifficultBtn } from "$lib/api/logging";
  import { recordWordsRead as persistWordsRead } from "./readingStats";

  export let bookId: string;

  // Create the store for this book page
  const store = createBookPageStore();

  // Reference objects that need to be shared
  const elRefs: Record<number, HTMLElement | null> = {};
  const subtitleRefs: Record<number, HTMLElement | null> = {};
  const boundaryEls: Record<number, HTMLElement | null> = {};

  // Reader element references
  let readerEl: HTMLElement | null = null;
  let sentinel: HTMLElement | null = null;

  // Pagination and loading state
  let loadingMore = false;
  let firstLoad = true;
  let lastLoadCompletedAt: number | null = null;

  // Infinite scroll state
  let _currentlyLoading = false;
  let _suppressAutoLoad = false;
  let _lastScrollTriggerAt = 0;
  let _scrollDebounceTimer: number | null = null;
  let _subtitleUpdateTimer: number | null = null;
  let _scrollSaveTimer: number | null = null;
  let _beforeUnloadHandler: (() => void) | null = null;
  let observer: IntersectionObserver | null = null;

  // Constants
  const SCROLL_DEBOUNCE_MS = 120;
  const LINES_FROM_BOTTOM = 8;
  const EXTRA_TRIGGER_PX = 12;
  const SCROLL_TRIGGER_COOLDOWN_MS = 2500;
  const SCROLL_SAVE_DEBOUNCE = 200;

  // Storage keys
  const rateStorageKey = (id: string) => `bookRate:${id}`;
  const topSentenceStorageKey = (id: string) => `bookTopSentence:${id}`;
  const helpStorageKey = "reader:usageHelpOpen";

  // Create interaction handlers
  const interactionHandlers = createInteractionHandlers(
    bookId,
    store,
    () => $store.sentences,
    () => $store.userRate,
    selectWordAtPointer,
    elRefs,
  );

  // Reactive store subscriptions
  $: sentences = $store.sentences;
  $: loading = $store.loading;
  $: error = $store.error;
  $: selected = $store.selected;
  $: bubbleVisible = $store.bubbleVisible;
  $: wordHighlights = $store.wordHighlights;
  $: wordTooltipVisible = $store.wordTooltipVisible;
  $: wordTooltipWordIndex = $store.wordTooltipWordIndex;
  $: blocks = $store.blocks;
  $: rateDisplay = $store.rateDisplay;
  $: helpOpen = $store.helpOpen;
  $: currentSubtitle = $store.currentSubtitle;
  $: pageBoundaries = $store.pageBoundaries;
  $: pageNumberForBoundary = $store.pageNumberForBoundary;
  $: lastEnd = $store.lastEnd;
  $: lastRequestedStart = $store.lastRequestedStart;
  $: lastForceReplacedStart = $store.lastForceReplacedStart;

  function selectWordAtPointer(sentenceIndex: number, event: PointerEvent) {
    const spanEl = elRefs[sentenceIndex];
    return selectWordAtPointerHelper(spanEl, event);
  }

  /** Load a page of sentences from the API */
  async function loadPage(
    start = 0,
    charCountParam?: number,
    isDifficult?: boolean,
    forceReplace?: boolean,
  ) {
    const isInitial = start === 0;
    if (isInitial) store.setLoading(true);
    store.setError(null);

    if (isInitial) {
      store.setSentences([]);
      store.updatePagination({ currentStart: 0, pageCount: 1 });
      // Reset boundaries
      $store.pageBoundaries.forEach((idx) => store.removePageBoundary(idx));
    }

    try {
      const timeSec = lastLoadCompletedAt
        ? Math.max(0, Math.round((Date.now() - lastLoadCompletedAt) / 1000))
        : null;

      const apiParams = {
        bookId,
        startSentenceNo: start,
        userId:
          (typeof localStorage !== "undefined" &&
            localStorage.getItem("userId")) ||
          "anonymous",
        charCount: charCountParam,
        difficultBtn: isDifficult || null,
        time: timeSec,
      };

      console.debug("[BookPage] getTextPage params ->", apiParams);
      store.updatePagination({ lastRequestedStart: start });

      if (forceReplace) {
        store.updatePagination({ lastForceReplacedStart: start });
        _suppressAutoLoad = true;
        _lastScrollTriggerAt = Date.now();
        console.debug("[BookPage] Suppressing auto-load due to force replace");
      } else {
        store.updatePagination({ lastForceReplacedStart: -1 });
      }

      const res = await getTextPage(apiParams);

      if (res.rate !== null && !Number.isNaN(res.rate)) {
        store.setUserRate(res.rate);
        try {
          localStorage.setItem(rateStorageKey(bookId), String(res.rate));
        } catch {
          // ignore persist
        }
      }

      const mapped = res.text.map((t) => ({
        type: t.type,
        en: t.en,
        jp: t.jp,
        jp_word: t.jp_word,
        en_word: (t as any).en_word ?? (t as any).en_phrase,
        word_difficulty: (t as any).word_difficulty,
        level: String(t.sentenceNo),
        sentenceNo: t.sentenceNo,
      }));

      const newSentences = mergeWithSavedSentences(bookId, mapped);

      if (start === 0 && !forceReplace) {
        // Initial page load
        store.setSentences(newSentences);
        persistPages([newSentences]);
      } else if (forceReplace) {
        if (start === 0) {
          // Force replacing from sentence 0
          store.setSentences(newSentences);
          persistPages([newSentences]);
        } else {
          // Targeted page replacement - this is complex, for now just append
          // TODO: Implement proper targeted replacement
          const beforeLen = sentences.length;
          store.addPageBoundary(beforeLen, start, ($store.pageCount || 1) + 1);
          store.appendSentences(newSentences);
          store.updatePagination({ pageCount: ($store.pageCount || 1) + 1 });
          console.debug("[BookPage] 📥 Appended sentences (force replace)", {
            fetched: newSentences.length,
            beforeLen,
            afterLen: beforeLen + newSentences.length,
            startSentenceNoRequested: start,
          });
        }
      } else {
        // Normal append
        const beforeLen = sentences.length;
        store.addPageBoundary(beforeLen, start, ($store.pageCount || 1) + 1);
        store.appendSentences(newSentences);
        store.updatePagination({ pageCount: ($store.pageCount || 1) + 1 });
        console.debug("[BookPage] 📥 Appended sentences", {
          fetched: newSentences.length,
          beforeLen,
          afterLen: beforeLen + newSentences.length,
          startSentenceNoRequested: start,
          page: $store.pageCount,
        });
        persistPages(pagesFromSentences());
      }

      if (newSentences.length > 0) {
        store.updatePagination({
          lastEnd: res.endSentenceNo,
          canNext: true,
        });

        // Track words read
        try {
          const words = newSentences.reduce((acc, s) => {
            const text = s?.en ?? "";
            const matches = text.match(/[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*/g);
            return acc + (matches ? matches.length : 0);
          }, 0);
          if (words > 0) persistWordsRead(words);
        } catch {
          // ignore stats errors
        }
      }

      store.setLoading(false);

      // Handle force replace cleanup
      if (forceReplace) {
        await tick();

        // Re-establish scroll event listeners
        if (readerEl) {
          setupScrollListeners();
          console.debug(
            "[BookPage] Re-established scroll event listeners after force replace",
          );
        }

        // Suppress auto-loading temporarily
        setTimeout(() => {
          _suppressAutoLoad = false;
          console.debug(
            "[BookPage] Re-enabled auto-load after force replace cooldown",
          );

          // Clean up stale boundary elements
          for (const key in boundaryEls) {
            delete boundaryEls[key];
          }
          console.debug(
            "[BookPage] Cleaned up stale boundary elements before observer reinit",
          );

          initInfiniteObserver();
        }, 3000);
      }

      if (firstLoad) firstLoad = false;
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Failed to load text";
      store.setError(error);
    } finally {
      if (isInitial) store.setLoading(false);
      lastLoadCompletedAt = Date.now();
    }
  }

  function pagesFromSentences() {
    if (!sentences || sentences.length === 0) return [];
    const boundaries = Array.from($store.pageBoundaries).sort((a, b) => a - b);
    const pages = [];
    let start = 0;
    for (const b of boundaries) {
      pages.push(sentences.slice(start, b));
      start = b;
    }
    pages.push(sentences.slice(start));
    return pages;
  }

  function persistPages(pages: any[]) {
    try {
      writePages(
        bookId,
        pages.map((pg) => pg.map((s) => toStoredSentence(s))),
      );
    } catch {
      // ignore
    }
  }

  function toStoredSentence(s: any) {
    return {
      type: s.type,
      sentenceNo: s.sentenceNo ?? -1,
      en: s.en,
      jp: s.jp,
      jp_word: s.jp_word,
      en_word: s.en_word,
      clickedWordIndex: Array.isArray(s.clickedWordIndex)
        ? s.clickedWordIndex.slice()
        : [],
      sentenceClicked: !!s.sentenceClicked,
    };
  }

  async function loadMore() {
    if (loadingMore || loading || _currentlyLoading) return;
    if (!$store.canNext && sentences.length > 0) return;

    loadingMore = true;
    _currentlyLoading = true;
    const nextStart = lastEnd + 1;

    if (nextStart !== lastForceReplacedStart) {
      await loadPage(nextStart, getCharCountForViewport());
    }

    loadingMore = false;
    _currentlyLoading = false;
  }

  function getCharCountForViewport(): number {
    const width =
      readerEl?.clientWidth ??
      (typeof window !== "undefined" ? window.innerWidth : 800);
    if (width <= 640) return 1500;
    if (width <= 1024) return 3000;
    return 4500;
  }

  async function handleDifficult() {
    if (loading) return;

    void logDifficultBtn(
      (typeof localStorage !== "undefined" && localStorage.getItem("userId")) ||
        "anonymous",
      $store.userRate,
    ).catch(() => {});

    console.debug("[BookPage] Reloading last requested page", {
      lastRequestedStart,
    });
    await loadPage(lastRequestedStart, getCharCountForViewport(), true, true);
  }

  function handleBack() {
    window.history.back();
  }

  function handleToggleHelp() {
    store.toggleHelp();
    try {
      localStorage.setItem(helpStorageKey, $store.helpOpen ? "1" : "0");
    } catch {
      // ignore
    }
  }

  // Scroll management
  function setupScrollListeners() {
    if (!readerEl) return;

    // Remove existing listeners
    readerEl.removeEventListener("scroll", updateScrollProgressDebounced);
    readerEl.removeEventListener("scroll", saveTopSentenceDebounced);
    readerEl.removeEventListener("scroll", updateCurrentSubtitleDebounced);

    // Add listeners
    readerEl.addEventListener("scroll", updateScrollProgressDebounced, {
      passive: true,
    });
    readerEl.addEventListener("scroll", saveTopSentenceDebounced, {
      passive: true,
    });
    readerEl.addEventListener("scroll", updateCurrentSubtitleDebounced, {
      passive: true,
    });
  }

  function updateScrollProgressDebounced() {
    console.debug("[BookPage] Scroll event detected!");
    if (_scrollDebounceTimer) window.clearTimeout(_scrollDebounceTimer);
    _scrollDebounceTimer = window.setTimeout(() => {
      _scrollDebounceTimer = null;
      checkAndLoadNearBottom();
    }, SCROLL_DEBOUNCE_MS) as unknown as number;
  }

  function checkAndLoadNearBottom() {
    if (_suppressAutoLoad || _currentlyLoading || !readerEl) return;

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

      console.debug("[BookPage] Scroll handler check", {
        scrollTop,
        clientHeight,
        scrollHeight,
        distanceFromBottom,
        thresholdPx,
        isNearBottom: distanceFromBottom <= thresholdPx,
        lastEnd,
        lastForceReplacedStart,
      });

      if (distanceFromBottom <= thresholdPx) {
        const now = Date.now();
        if (now - _lastScrollTriggerAt < SCROLL_TRIGGER_COOLDOWN_MS) {
          console.debug("[BookPage] Scroll trigger on cooldown");
          return;
        }

        _lastScrollTriggerAt = now;
        _currentlyLoading = true;

        if (lastEnd && lastEnd > 0) {
          const nextStart = lastEnd + 1;
          if (nextStart !== lastForceReplacedStart) {
            console.debug("[BookPage] Scroll handler triggering loadPage", {
              nextStart,
            });
            void loadPage(nextStart, getCharCountForViewport()).finally(() => {
              _currentlyLoading = false;
            });
          } else {
            console.debug(
              "[BookPage] Scroll handler skipped - matches force replaced start",
              { nextStart, lastForceReplacedStart },
            );
            _currentlyLoading = false;
          }
        } else {
          console.debug("[BookPage] Scroll handler triggering loadMore");
          void loadMore().finally(() => {
            _currentlyLoading = false;
          });
        }
      }
    } catch (e) {
      console.debug("[BookPage] checkAndLoadNearBottom error", e);
    }
  }

  function saveTopSentenceDebounced() {
    if (_scrollSaveTimer) window.clearTimeout(_scrollSaveTimer);
    _scrollSaveTimer = window.setTimeout(() => {
      try {
        const idx = getTopVisibleSentenceIndex();
        if (idx != null) {
          const s = sentences[idx];
          if (s && s.sentenceNo != null) {
            let offset = 0;
            try {
              const el = elRefs[idx];
              if (el && readerEl) {
                const containerRect = readerEl.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                offset = Math.max(
                  0,
                  Math.round(elRect.top - containerRect.top),
                );
              }
            } catch {
              // ignore offset calc
            }
            const payload = { sentenceNo: s.sentenceNo, offset };
            localStorage.setItem(
              topSentenceStorageKey(bookId),
              JSON.stringify(payload),
            );
          }
        }
      } catch {
        // ignore
      }
      _scrollSaveTimer = null;
    }, SCROLL_SAVE_DEBOUNCE) as unknown as number;
  }

  function getTopVisibleSentenceIndex(): number | null {
    if (!readerEl) return null;
    const readerRect = readerEl.getBoundingClientRect();

    for (let i = 0; i < sentences.length; i++) {
      const el = elRefs[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= readerRect.top + 1) return i;
    }

    let lastMatch: number | null = null;
    for (let i = 0; i < sentences.length; i++) {
      const el = elRefs[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top <= readerRect.top + 1) lastMatch = i;
    }
    return lastMatch;
  }

  function updateCurrentSubtitleDebounced() {
    if (_subtitleUpdateTimer) window.clearTimeout(_subtitleUpdateTimer);
    _subtitleUpdateTimer = window.setTimeout(() => {
      _subtitleUpdateTimer = null;
      updateCurrentSubtitle();
    }, 80) as unknown as number;
  }

  function updateCurrentSubtitle() {
    if (!readerEl) return;

    try {
      const readerRect = readerEl.getBoundingClientRect();
      let lastSubtitle: { idx: number; text: string } | null = null;

      for (const b of blocks) {
        if (b.kind !== "subtitle") continue;
        const idx = b.idx;
        const el = subtitleRefs[idx];
        if (!el) continue;
        const rect = el.getBoundingClientRect();

        if (rect.top <= readerRect.top + 4) {
          lastSubtitle = { idx, text: b.item.en };
        }
      }

      let finalText = lastSubtitle ? lastSubtitle.text : null;

      // Show first subtitle if on initial page and no subtitle above top
      if (!finalText && $store.currentStart === 0) {
        const firstSub = blocks.find((b) => b.kind === "subtitle");
        if (firstSub && firstSub.kind === "subtitle") {
          finalText = firstSub.item.en;
        }
      }

      if (finalText !== currentSubtitle) {
        store.setCurrentSubtitle(finalText);
      }
    } catch (e) {
      console.debug("[BookPage] updateCurrentSubtitle error", e);
    }
  }

  function initInfiniteObserver() {
    if (observer) observer.disconnect();
    if (!readerEl) return;

    observer = new IntersectionObserver(
      (entries) => {
        console.debug("[BookPage] Intersection observer callback triggered", {
          entriesCount: entries.length,
        });

        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (_suppressAutoLoad || _currentlyLoading) {
              console.debug(
                "[BookPage] Infinite scroll observer triggered but auto-load is suppressed or already loading",
                {
                  suppressAutoLoad: _suppressAutoLoad,
                  currentlyLoading: _currentlyLoading,
                },
              );
              return;
            }

            const el = entry.target as HTMLElement;
            const idx = Number(
              Object.entries(boundaryEls).find(([_k, v]) => v === el)?.[0],
            );

            console.debug("[BookPage] Boundary element intersecting", {
              idx,
              isFinite: Number.isFinite(idx),
            });

            if (!Number.isFinite(idx)) continue;

            const startSentenceNo = $store.pageBoundaryMap[idx];

            // Clean up this boundary
            observer?.unobserve(el);
            delete boundaryEls[idx];
            store.removePageBoundary(idx);

            if (startSentenceNo != null) {
              console.debug("[BookPage] Loading next page from boundary", {
                idx,
                startSentenceNo,
              });
              _currentlyLoading = true;
              void loadPage(startSentenceNo, getCharCountForViewport()).finally(
                () => {
                  _currentlyLoading = false;
                },
              );
            } else {
              console.debug("[BookPage] Falling back to loadMore");
              _currentlyLoading = true;
              void loadMore().finally(() => {
                _currentlyLoading = false;
              });
            }
          }
        }
      },
      {
        root: readerEl,
        rootMargin: "0px 0px -20% 0px",
        threshold: 0,
      },
    );

    // Observe boundary elements
    for (const key in boundaryEls) {
      const el = boundaryEls[key];
      if (el && $store.pageBoundaryMap[key] != null) {
        console.debug("[BookPage] Observing boundary element", {
          boundaryIndex: key,
          startSentenceNo: $store.pageBoundaryMap[key],
        });
        observer.observe(el);
      }
    }
  }

  // Event handlers for the reader
  function handleMounted(event: CustomEvent<{ idx: number; el: HTMLElement }>) {
    elRefs[event.detail.idx] = event.detail.el;
  }

  function handleDestroyed(event: CustomEvent<{ idx: number }>) {
    delete elRefs[event.detail.idx];
  }

  // Component lifecycle
  onMount(async () => {
    // Load persisted user rate
    try {
      const stored = localStorage.getItem(rateStorageKey(bookId));
      if (stored) {
        const num = Number(stored);
        if (!Number.isNaN(num)) store.setUserRate(num);
      }
    } catch {
      // ignore localStorage
    }

    // Try to load from stored pages first
    try {
      const storedPages = readPages(bookId);
      if (storedPages && storedPages.length > 0) {
        const flatSentences = storedPages.flat();
        store.setSentences(flatSentences);

        // Restore UI state
        const newSelected = new Set<number>();
        const newBubbleVisible = new Set<number>();
        const newWordHighlights: Record<number, Set<number>> = {};

        for (let i = 0; i < flatSentences.length; i++) {
          const s = flatSentences[i] as any;
          if (s.sentenceClicked) {
            newSelected.add(i);
            newBubbleVisible.add(i);
          }
          if (
            Array.isArray(s.clickedWordIndex) &&
            s.clickedWordIndex.length > 0
          ) {
            newWordHighlights[i] = new Set(s.clickedWordIndex);
          }
        }

        // Update store
        store.selected.set(newSelected);
        store.bubbleVisible.set(newBubbleVisible);
        store.wordHighlights.set(newWordHighlights);

        // Restore pagination
        let idx = 0;
        const pageCount = storedPages.length;
        store.updatePagination({ pageCount });

        for (let p = 0; p < storedPages.length; p++) {
          if (p > 0) {
            store.addPageBoundary(idx, 0, p + 1); // startSentenceNo not available from storage
          }
          idx += storedPages[p].length;
        }

        const lastSentence = flatSentences[flatSentences.length - 1];
        store.updatePagination({
          lastEnd: lastSentence?.sentenceNo ?? 0,
          currentStart: 0,
        });

        store.setLoading(false);

        // Restore scroll position after DOM updates
        await tick();
        await restoreScrollPosition();
      } else {
        // Initial load
        const charCount = getCharCountForViewport();
        await loadPage(0, charCount);
      }
    } catch {
      // Fallback to normal loading
      try {
        const charCount = getCharCountForViewport();
        await loadPage(0, charCount);
      } catch {
        await loadPage(0);
      }
    }

    await tick();
    setupScrollListeners();
    initInfiniteObserver();

    // Setup beforeunload handler
    _beforeUnloadHandler = () => {
      try {
        persistPages(pagesFromSentences());
      } catch {
        // ignore
      }
    };
    window.addEventListener("beforeunload", _beforeUnloadHandler);
  });

  async function restoreScrollPosition() {
    if (!readerEl) return;

    try {
      const raw = localStorage.getItem(topSentenceStorageKey(bookId));
      if (!raw) return;

      let savedSentenceNo: number | null = null;
      let savedOffset = 0;

      try {
        if (raw.trim().startsWith("{")) {
          const obj = JSON.parse(raw);
          if (typeof obj?.sentenceNo === "number")
            savedSentenceNo = obj.sentenceNo;
          if (typeof obj?.offset === "number")
            savedOffset = Math.max(0, Math.round(obj.offset));
        } else {
          const num = Number(raw);
          if (!Number.isNaN(num)) savedSentenceNo = num;
        }
      } catch {
        const num = Number(raw);
        if (!Number.isNaN(num)) savedSentenceNo = num;
      }

      if (savedSentenceNo != null) {
        const foundIdx = sentences.findIndex(
          (s) => (s.sentenceNo ?? -1) === savedSentenceNo,
        );
        if (foundIdx >= 0) {
          const el = elRefs[foundIdx];
          if (el) {
            // Temporarily disconnect observer during programmatic scroll
            if (observer) observer.disconnect();
            _suppressAutoLoad = true;
            _lastScrollTriggerAt = Date.now();

            const containerRect = readerEl.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const targetScrollTop =
              readerEl.scrollTop +
              Math.round(elRect.top - containerRect.top - savedOffset);
            readerEl.scrollTop = targetScrollTop;

            setTimeout(() => {
              _suppressAutoLoad = false;
            }, 120);

            await tick();
            initInfiniteObserver();
          }
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }

  onDestroy(() => {
    if (_scrollSaveTimer) window.clearTimeout(_scrollSaveTimer);
    if (_scrollDebounceTimer) window.clearTimeout(_scrollDebounceTimer);
    if (_subtitleUpdateTimer) window.clearTimeout(_subtitleUpdateTimer);
    if (observer) observer.disconnect();
    if (_beforeUnloadHandler) {
      window.removeEventListener("beforeunload", _beforeUnloadHandler);
    }
  });
</script>

<main class="book-page h-screen flex flex-col bg-white">
  <BookPageHeader
    {currentSubtitle}
    {rateDisplay}
    onDifficultyClick={handleDifficult}
    onBackClick={handleBack}
  />

  <BookPageUsageHelp {helpOpen} onToggle={handleToggleHelp} />

  <BookPageReader
    {blocks}
    {selected}
    {bubbleVisible}
    {wordHighlights}
    {wordTooltipVisible}
    {wordTooltipWordIndex}
    {pageBoundaries}
    {pageNumberForBoundary}
    {boundaryEls}
    {loading}
    {error}
    bind:readerEl
    bind:sentinel
    on:sentenceClick={(e) =>
      interactionHandlers.handleSentenceClick(e.detail.idx, e.detail.event)}
    on:sentenceContextmenu={(e) =>
      interactionHandlers.handleSentenceContextMenu(
        e.detail.idx,
        e.detail.event,
      )}
    on:sentenceMouseDown={(e) =>
      interactionHandlers.handleSentenceMouseDown(e.detail.idx, e.detail.event)}
    on:sentencePointerDown={(e) =>
      interactionHandlers.handleTouchPointerDown(e.detail.idx, e.detail.event)}
    on:sentencePointerMove={(e) =>
      interactionHandlers.handleTouchPointerMove(e.detail.idx, e.detail.event)}
    on:sentencePointerUp={(e) =>
      interactionHandlers.handleTouchPointerUp(e.detail.idx, e.detail.event)}
    on:sentenceDblclick={(e) =>
      interactionHandlers.handleSentenceDoubleClick(
        e.detail.idx,
        e.detail.event,
      )}
    on:sentenceKeydown={(e) =>
      interactionHandlers.handleSentenceKeydown(e.detail.idx, e.detail.event)}
    on:mounted={handleMounted}
    on:destroyed={handleDestroyed}
  />
</main>
