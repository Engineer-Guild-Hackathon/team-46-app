<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { Sentence } from '../api/text'

  export let bookId: string

  let loading = true
  let error: string | null = null
  let sentences: Sentence[] = []
  let selected = new Set<number>()
  let bubbleVisible = new Set<number>()
  const bubbleTimers = new Map<number, number>()
  const elRefs: Record<number, HTMLElement | null> = {}
  const AUTO_HIDE_MS = 2600 // auto-hide translation after a short delay

  // --- Mock data (replace with API later) ---
  const mockSentences: Sentence[] = [
    {
      type: 'subtitle',
      en: 'CHAPTER I.\r\nDown the Rabbit-Hole',
      jp: 'チャプター1. ウサギの穴の中へ',
      level: '160',
    },
    {
      type: 'text',
      en: 'Alice said, "I feel strange. I am getting very small."',
      jp: 'アリスは「体が小さくなっていくよう！」と言いました',
      level: '145',
    },
    {
      type: 'text',
      en: 'She looked at the bottle and decided to drink.',
      jp: '彼女は瓶を見て、飲むことにしました。',
      level: '150',
    },
    {
      type: 'text',
      en: 'Suddenly, the room felt much larger than before.',
      jp: '突然、部屋が先ほどよりずっと大きく感じられました。',
      level: '140',
    },
    {
      type: 'text',
      en: 'Alice took a deep breath and continued on her way.',
      jp: 'アリスは深呼吸をして、先へ進みました。',
      level: '135',
    },
  ]

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

  onMount(() => {
    void loadPage(0)
  })

  // Build book-like blocks: paragraphs of text and standalone subtitles
  type Block = { kind: 'paragraph'; idxStart: number; idxEnd: number; items: Sentence[] } | { kind: 'subtitle'; item: Sentence; idx: number }
  function buildBlocks(list: Sentence[]): Block[] {
    const blocks: Block[] = []
    let para: { idxStart: number; items: Sentence[] } | null = null
    list.forEach((s, i) => {
      if (s.type === 'subtitle') {
        if (para && para.items.length) {
          blocks.push({ kind: 'paragraph', idxStart: para.idxStart, idxEnd: i - 1, items: para.items })
          para = null
        }
        blocks.push({ kind: 'subtitle', item: s, idx: i })
      } else {
        if (!para) para = { idxStart: i, items: [] }
        para.items.push(s)
      }
    })
    if (para && para.items.length) {
      blocks.push({ kind: 'paragraph', idxStart: para.idxStart, idxEnd: para.idxStart + para.items.length - 1, items: para.items })
    }
    return blocks
  }

  $: blocks = buildBlocks(sentences)
  $: headerTitle = (sentences.find((s) => s.type === 'subtitle')?.en?.replace(/\r?\n/g, ' ')) ?? `Book ${bookId}`

  function formatSentence(t: string): string {
    return t.replace(/\s+/g, ' ').trim()
  }
</script>

<main class="bookpage">
  <header class="topbar">
    <button class="btn btn-ghost backBtn" type="button" aria-label="Go back" on:click={() => window.history.back()}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
    <h2 class="title" title={headerTitle}>{headerTitle}</h2>
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
      <article class="reader" aria-live="polite">
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
</main>

<style>
  .bookpage { max-width: 800px; margin: 2rem auto; padding: 1rem; }
  .topbar {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: .5rem;
    margin-bottom: .75rem;
  }
  .btn { height: 2rem; padding: 0 .5rem; border-radius: 8px; border: 1px solid transparent; cursor: pointer; display: inline-flex; align-items: center; gap: .25rem; }
  .btn-ghost { background: transparent; border-color: #e3e7ee; }
  .btn-ghost:hover { background: #f6f7f9; }
  .backBtn { width: 2rem; justify-content: center; }
  .title { font-size: 1.1rem; margin: 0; }

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
</style>