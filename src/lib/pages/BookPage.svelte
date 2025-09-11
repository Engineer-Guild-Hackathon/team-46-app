<script lang="ts">
  import { onMount, tick } from 'svelte'
  // local Sentence shape for this component (keeps file self-contained)
  type Sentence = { type: 'text' | 'subtitle'; en: string; jp?: string; level?: string }
  import { computeWordsPerPage } from '../hooks/useWordsPerPage'
  import { ChevronLeft, ChevronRight } from '@lucide/svelte'
    import Button from '$lib/components/ui/button/button.svelte'

  export let bookId: string

  let loading = true
  let error: string | null = null
  let sentences: Sentence[] = []
  let selected = new Set<number>()
  let bubbleVisible = new Set<number>()
  const bubbleTimers = new Map<number, number>()
  const elRefs: Record<number, HTMLElement | null> = {}
  const AUTO_HIDE_MS = 2600 // auto-hide translation after a short delay

  let readerEl: HTMLElement | null = null
  let wordsPerPage = 0

  // --- Mock data (replace with API later) ---
  const mockSentences: Sentence[] = Array.from({ length: 100 }, (_, i) => ({
    type: 'text',
    en: `Sentence number ${i + 1} with some additional words to test the layout.`,
    jp: `文番号${i + 1}。レイアウトをテストするための追加の単語を含む。`,
    level: `${100 + i}`,
  }))

  async function loadPage(_p = 0) {
    loading = true
    error = null
    try {
      // simulate network delay
      await new Promise((r) => setTimeout(r, 650))
      sentences = mockSentences
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load text'
    } finally {
      loading = false
    }
  }

  function toggleSentence(i: number) {
    const isNew = !selected.has(i)
    // Always keep highlighted once clicked
    if (isNew) {
      selected.add(i)
    }
    selected = new Set(selected)
    // Show translation bubble (re-click re-shows)
    showBubble(i)
  }

  function showBubble(i: number) {
    bubbleVisible.add(i)
    bubbleVisible = new Set(bubbleVisible)
    void positionBubbleNextTick(i)
    // reset auto-hide timer
    const prev = bubbleTimers.get(i)
    if (prev) window.clearTimeout(prev)
    const id = window.setTimeout(() => hideBubble(i), AUTO_HIDE_MS)
    bubbleTimers.set(i, id)
  }

  function hideBubble(i: number) {
    bubbleVisible.delete(i)
    bubbleVisible = new Set(bubbleVisible)
    const prev = bubbleTimers.get(i)
    if (prev) window.clearTimeout(prev)
    bubbleTimers.delete(i)
  }


  async function positionBubbleNextTick(i: number) {
    await tick()
    adjustBubblePosition(i)
  }

  function adjustBubblePosition(_i: number) {
    const host = elRefs[_i]
    if (!host) return
    const bubble = host.querySelector('.jp-bubble') as HTMLElement | null
    if (!bubble) return
    // Reset modifiers
    bubble.classList.remove('align-left', 'align-right', 'align-center', 'pos-above', 'pos-below')
    bubble.style.setProperty('--shiftX', '0px')

    const margin = 8
    let rect = bubble.getBoundingClientRect()
    const vw = window.innerWidth

    // Prefer above by default, fallback below if needed
    // Temporarily mark as above to measure
    bubble.classList.add('pos-above')
    rect = bubble.getBoundingClientRect()
    if (rect.top < margin) {
      bubble.classList.remove('pos-above')
      bubble.classList.add('pos-below')
      rect = bubble.getBoundingClientRect()
    }

    // Horizontal alignment
    if (rect.left < margin) {
      bubble.classList.add('align-left')
    } else if (rect.right > vw - margin) {
      bubble.classList.add('align-right')
    } else {
      bubble.classList.add('align-center')
    }

    // Re-measure and clamp to viewport horizontally with a pixel shift
    rect = bubble.getBoundingClientRect()
    const overflowLeft = Math.max(0, margin - rect.left)
    const overflowRight = Math.max(0, rect.right - (vw - margin))
    const delta = overflowLeft > 0 ? overflowLeft : (overflowRight > 0 ? -overflowRight : 0)
    if (delta !== 0) {
      bubble.style.setProperty('--shiftX', `${delta}px`)
    }
  }

  onMount(async () => {
    // load content first so the `.reader` element is rendered
    await loadPage(0)
    // allow DOM to update
    await tick()
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))

    if (!readerEl) {
      readerEl = document.querySelector('.reader') as HTMLElement | null
    }

    // diagnostic: log presence and rect
    // eslint-disable-next-line no-console
    console.debug('[wpp] onMount readerEl found?', !!readerEl)
    if (readerEl) {
      // log bounding box
      const r = readerEl.getBoundingClientRect()
      // eslint-disable-next-line no-console
      console.debug('[wpp] reader rect', r)
      // compute initial value synchronously
      wordsPerPage = computeWordsPerPage(readerEl) || 0
      // eslint-disable-next-line no-console
      console.log('[wpp] initial wordsPerPage (reader) =', wordsPerPage)
      // observe for container changes and recompute
      // const stop = observeWordsPerPage(readerEl, (n) => {
      //   wordsPerPage = n || 0
      //   // eslint-disable-next-line no-console
      //   console.log('[wpp] wordsPerPage updated=', wordsPerPage)
      // })
      // store stop if you want to disconnect on destroy
    } else {
      // fallback: measure body and set
      wordsPerPage = computeWordsPerPage(document.body) || 0
      // eslint-disable-next-line no-console
      console.log('[wpp] reader not found, body wordsPerPage =', wordsPerPage)
    }
  })

  // Build book-like blocks: paragraphs of text and standalone subtitles
  type Block = { kind: 'paragraph'; idxStart: number; idxEnd: number; items: Sentence[] } | { kind: 'subtitle'; item: Sentence; idx: number }
  function buildBlocks(list: Sentence[]): Block[] {
    const blocks: Block[] = []
    let idxStart = -1
    let acc: Sentence[] = []
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      if (s.type === 'subtitle') {
        if (acc.length > 0) {
          blocks.push({ kind: 'paragraph', idxStart, idxEnd: idxStart + acc.length - 1, items: acc.slice() })
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
      blocks.push({ kind: 'paragraph', idxStart, idxEnd: idxStart + acc.length - 1, items: acc.slice() })
    }
    return blocks
  }

  // function paginateByWords(sentencesList: Sentence[], wordsPerPg: number) {
  //   if (!wordsPerPg || wordsPerPg < 1) return [sentencesList]
  //   const pages: Sentence[][] = []
  //   let current: Sentence[] = []
  //   let count = 0
  //   for (const s of sentencesList) {
  //     const w = (s.en || '').split(/\s+/).filter(Boolean).length
  //     if (count + w > wordsPerPg && current.length > 0) {
  //       pages.push(current)
  //       current = []
  //       count = 0
  //     }

  //     if (w > wordsPerPg) {
  //       // split long sentence into multiple chunks of wordsPerPg
  //       const words = (s.en || '').split(/\s+/).filter(Boolean)
  //       for (let k = 0; k < words.length; k += wordsPerPg) {
  //         const chunkWords = words.slice(k, k + wordsPerPg)
  //         const chunkText = chunkWords.join(' ')
  //         const chunkSentence: Sentence = {
  //           type: s.type,
  //           en: chunkText,
  //           jp: s.jp,
  //           level: s.level,
  //         }
  //         pages.push([chunkSentence])
  //       }
  //       count = 0
  //       continue
  //     }

  //     current.push(s)
  //     count = count + w
  //   }
  //   if (current.length) pages.push(current)
  //   return pages
  // }

  $: blocks = buildBlocks(sentences)
  // $: paginatedSentences = paginateByWords(mockSentences, wordsPerPage)
  $: headerTitle = (sentences.find((s) => s.type === 'subtitle')?.en?.replace(/\r?\n/g, ' ')) ?? `Book ${bookId}`
  
  function formatSentence(t: string): string {
    return t.replace(/\s+/g, ' ').trim()
  }
</script>

<main class="bookpage">
  <header class="topbar">
    <Button class="btn btn-ghost backBtn" type="button" variant="outline" aria-label="Go back" onclick={() => window.history.back()}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </Button>
    <h2 class="title" title={headerTitle}>{headerTitle}</h2>
    <div class="actions">
      <Button class="btn btn-primary difficultBtn" type="button" aria-label="Mark difficult">難しい</Button>
    </div>
  </header>

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
                    on:click={() => toggleSentence(b.idxStart + j)}
                    on:keydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSentence(b.idxStart + j) }
                      if (e.key === 'Escape') { e.preventDefault(); hideBubble(b.idxStart + j) }
                    }}
                    aria-pressed={selected.has(b.idxStart + j)}
                  >
                    {formatSentence(s.en)}
                    {#if bubbleVisible.has(b.idxStart + j)}
                      <span class="jp-bubble" aria-label="Japanese translation">{s.jp}</span>
                    {/if}
                  </span>
                {/key}
              {/each}
            </p>
          {/if}
        {/each}
      </article>
    </section>
  {/if}

  <nav class="pagination" aria-label="Page navigation">
    <Button class="btn btn-outline" variant="outline" type="button" aria-label="Previous page">
      <span class="icon"><ChevronLeft size={16} /></span>
      <span class="btn-label">Previous</span>
    </Button>
    <span class="page-info">Page 1 of 10</span>
  <Button class="btn btn-outline" variant="outline" type="button" aria-label="Next page">
      <span class="btn-label">Next</span>
      <span class="icon"><ChevronRight size={16} /></span>
    </Button>
  </nav>
</main>

<style>
  .bookpage { max-width: 800px; margin: 2rem auto; padding: 1rem; }
  .topbar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: .5rem;
    margin-bottom: .75rem;
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

  .error { color: #b00020; }

  .book-text { margin-top: 0.5rem; }
  .reader {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.1rem;
    line-height: 1.75;
    color: #1b1b1b;
    background: #fff;
    border: 1px solid #eceff3;
    border-radius: 12px;
    padding: 1.25rem 1.25rem 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    max-height: 80vh; /* Limit to 80% of the viewport height */
    overflow: hidden; /* Hide overflowing content and rely on pagination */
  }
  /* Subtitle now shown in topbar title */
  .sentence.skeleton { background: #f2f4f8; overflow: hidden; }
  .skeleton-line {
    height: 12px; border-radius: 6px; background: linear-gradient(90deg, #e9edf3 25%, #f5f7fb 50%, #e9edf3 75%);
    background-size: 200% 100%; animation: shimmer 1.2s infinite;
  }
  .w-90 { width: 90%; }
  .w-60 { width: 60%; }
  .mt-6 { margin-top: 6px; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .sentenceInline {
    all: unset;
    display: inline;
    position: relative;
    cursor: pointer;
    border-radius: 4px;
    padding: 0 .06em;
  }
  /* add a natural space after each sentence inline element */
  .sentenceInline::after { content: ' '; }
  /* but not after the last sentence in a paragraph */
  .reader p > .sentenceInline:last-child::after { content: ''; }
  .sentenceInline:hover { background: #fff1be; }
  .sentenceInline.selected { background: #ffe9a8; }
  .sentenceInline:focus-visible { outline: 2px solid rgba(100,150,250,.55); outline-offset: 2px; }
  .jp-bubble {
    position: absolute;
    left: 0; right: auto;
    bottom: -2.2em;
  width: max-content;
  min-width: 260px;
  max-width: min(72ch, 80vw);
  white-space: normal;
  word-break: normal;
  overflow-wrap: anywhere;
  line-break: auto;
  font-size: .95rem;
    line-height: 1.4;
    color: #3a2c00;
    background: #fffef8;
    border: 1px solid #ffd18a;
    border-radius: 6px;
  padding: .4rem .6rem;
    box-shadow: 0 2px 6px rgba(0,0,0,.08);
    z-index: 1;
  }
  /* Horizontal alignment modifiers */
  :global(.jp-bubble.align-left) { left: 0; right: auto; transform: translateX(var(--shiftX, 0)); }
  :global(.jp-bubble.align-right) { right: 0; left: auto; transform: translateX(var(--shiftX, 0)); }
  :global(.jp-bubble.align-center) { left: 50%; transform: translateX(calc(-50% + var(--shiftX, 0))); }
  /* Vertical placement modifiers */
  :global(.jp-bubble.pos-above) { bottom: auto; top: -2.2em; }
  :global(.jp-bubble.pos-below) { bottom: -2.2em; top: auto; }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }
  .pagination .page-info { color: #444; font-size: .95rem; }
</style>