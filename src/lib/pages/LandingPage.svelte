<script lang="ts">
  import { onMount } from 'svelte'
  import Button from '$lib/components/ui/button/button.svelte'
  interface MorphPair {
    hard: string
    easy: string
  }
  let morphIndex = 0
  const morphPairs: MorphPair[] = [
    {
      hard: 'Oh, how I wish I could shut up like a telescope!',
      easy: 'I wish I could just shrink like a telescope.',
    },
    {
      hard: 'She was considering in her own mind...',
      easy: 'She was thinking to herself...',
    },
  ]
  let current = morphPairs[0]
  let display = current.hard
  let phase: 'hard' | 'morph' | 'easy' = 'hard'
  let lockHeight = 0 // locked pixel height for the line to prevent layout shift
  let morphEl: HTMLDivElement | null = null

  function measureLockHeight(pair: MorphPair) {
    // measure max height between hard & easy variants
    if (!morphEl) return
    const temp = document.createElement('span')
    temp.className = 'line measure'
    temp.style.position = 'absolute'
    temp.style.visibility = 'hidden'
    temp.style.pointerEvents = 'none'
    morphEl.appendChild(temp)
    let maxH = 0
    for (const txt of [pair.hard, pair.easy]) {
      temp.textContent = txt
      const h = temp.offsetHeight
      if (h > maxH) maxH = h
    }
    temp.remove()
    lockHeight = maxH
  }

  function cycle() {
    phase = 'morph'
    const hardWords = current.hard.split(/\s+/)
    const easyWords = current.easy.split(/\s+/)
    const max = Math.max(hardWords.length, easyWords.length)
    let step = 0
    const interval = 140
    const id = setInterval(() => {
      const out: string[] = []
      for (let i = 0; i < max; i++) {
        if (i < step) out.push(easyWords[i] ?? '')
        else out.push(hardWords[i] ?? '')
      }
      display = out.join(' ').replace(/\s+/g, ' ').trim()
      const ratio = Math.min(1, step / max)
      step++
      if (step > max) {
        clearInterval(id)
        phase = 'easy'
        setTimeout(() => {
          morphIndex = (morphIndex + 1) % morphPairs.length
          current = morphPairs[morphIndex]
          display = current.hard
          phase = 'hard'
          measureLockHeight(current)
          setTimeout(cycle, 1800)
        }, 2600)
      }
    }, interval) as unknown as number
  }

  onMount(() => {
    measureLockHeight(current)
    setTimeout(cycle, 1600)
  })

  function goToMain() {
    location.hash = '#/main'
  }
</script>

<section
  class="relative min-h-full overflow-x-hidden text-[#18211d] font-serif bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,.9),transparent_60%),linear-gradient(135deg,#faf9f4_0%,#f3efe6_100%)] after:content-[''] after:fixed after:inset-0 after:pointer-events-none after:[background:repeating-linear-gradient(0deg,rgba(0,0,0,.015)_0_2px,transparent_2px_4px),repeating-linear-gradient(90deg,rgba(0,0,0,.012)_0_3px,transparent_3px_6px)] after:mix-blend-multiply after:opacity-55"
>
  <div class="min-h-svh flex flex-col justify-center max-w-[640px] mx-auto px-5 pt-14 pb-10">
    <h1
      class="text-[clamp(2.4rem,9vw,3.2rem)] font-semibold tracking-[.04em] bg-gradient-to-r from-[#0d5e6f] to-[#39a3b4] text-transparent bg-clip-text m-0 mb-2"
    >
      FlexRead
    </h1>
    <p class="text-[0.95rem] m-0 mb-5 opacity-85">
      自動で「ちょうどいい難易度」になる英語本リーダー
    </p>
    <div
      bind:this={morphEl}
      aria-live="polite"
      class="relative flex flex-col gap-3 mb-6"
      style={`--lock-h:${lockHeight}px`}
    >
      <span class="inline-flex items-center" style={`height:${lockHeight}px`}
        ><span
          class={`text-[0.92rem] transition-[color,filter] duration-500 ${phase === 'hard' ? 'blur-[0.2px]' : ''} ${phase === 'morph' ? 'text-[#0d5e6f] animate-pulse' : ''} ${phase === 'easy' ? 'text-[#39a3b4]' : ''}`}
          >{display}</span
        ></span
      >
    </div>
    <Button class="mb-4" on:click={goToMain}>Start Reading</Button>
    <p class="text-[0.7rem] opacity-60 tracking-[0.05em]">Scroll to see how it works ↓</p>
  </div>

  <div class="py-10 px-4 bg-gradient-to-b from-[#faf9f4] to-white" aria-label="Sample books">
    <h2 class="text-[1.3rem] mb-4 tracking-[0.03em]">Library Glimpse</h2>
    <div class="flex gap-4 overflow-x-auto scrollbar-none py-2 pr-2 snap-x snap-mandatory">
      {#each Array(8) as _, i}
        <div
          class="flex-none w-40 snap-start animate-[float_6s_ease-in-out_infinite] [animation-delay:calc(var(--i)*-1s)]"
          style={`--i:${i}`}
          aria-hidden="true"
        >
          <div
            class="relative flex flex-col h-40 rounded-xl border border-[#e1d8c7] shadow-[0_2px_5px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.05)] bg-[radial-gradient(circle_at_30%_20%,#fff_0%,#f6f1e8_70%)] overflow-hidden p-3.5 pt-3"
          >
            <div
              class="text-[0.7rem] font-semibold tracking-[0.06em] uppercase text-[#0d5e6f] mb-1"
            >
              Book {i + 1}
            </div>
            <div class="mt-auto flex flex-col gap-1.5">
              {#each Array(5) as __, j}
                <div
                  class="h-[6px] rounded-md bg-[linear-gradient(90deg,#d1c9b9,#ece5d8)]"
                  style={`width:${40 + ((j * 8) % 50)}%`}
                ></div>
              {/each}
            </div>
            <div
              class="pointer-events-none absolute inset-0 opacity-35 mix-blend-multiply bg-[repeating-linear-gradient(180deg,rgba(0,0,0,.03)_0_2px,transparent_2px_4px)]"
            ></div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="py-10 px-4 bg-[#faf9f4]">
    <h2 class="text-[1.3rem] mb-4 tracking-[0.03em]">Why FlexRead?</h2>
    <ul
      class="list-none m-0 p-0 flex flex-col gap-3 text-[0.85rem] animate-in fade-in slide-in-from-bottom-2"
    >
      <li>
        <strong class="text-[#0d5e6f] font-semibold">Adaptive difficulty</strong>: text reshapes to
        your level.
      </li>
      <li>
        <strong class="text-[#0d5e6f] font-semibold">No manual searching</strong>: stop hunting for
        the "right" book.
      </li>
      <li>
        <strong class="text-[#0d5e6f] font-semibold">Inline support</strong>: tap for meaning,
        long-press for sentence.
      </li>
      <li>
        <strong class="text-[#0d5e6f] font-semibold">Faster progress</strong>: steady challenge, no
        overwhelm.
      </li>
    </ul>
  </div>
</section>
