<script lang="ts">
  import { logHowWasIt, type HowWasItValue } from '$lib/api/logging'
  import { createEventDispatcher } from 'svelte'
  export let userRate: number | null = 0
  export let userId: string = 'anonymous'
  export let onLogged: (val: HowWasItValue) => void = () => {}
  const dispatch = createEventDispatcher<{ rated: { value: HowWasItValue } }>()
  let value: HowWasItValue | null = null
  let logged = false
  let container: HTMLElement | null = null

  function select(val: HowWasItValue) {
    if (logged) return
    value = val
    try { void logHowWasIt(userId, userRate ?? 0, val) } catch { /* ignore */ }
    logged = true
    onLogged(val)
    dispatch('rated', { value: val })
  }
</script>

<section class="howwasit" aria-labelledby="howwasit-label" bind:this={container}>
  <h3 id="howwasit-label">このページはどうでした?</h3>
  <div class="rating-group" role="radiogroup" aria-labelledby="howwasit-label">
    {#each ['easy','normal','difficult'] as opt}
      <button
        type="button"
        class="rating-btn {value === opt ? 'active' : ''}"
        on:click={() => select(opt as HowWasItValue)}
        aria-pressed={value === opt}
        aria-label={`Mark page difficulty as ${opt}`}
        disabled={logged}
      >{opt}</button>
    {/each}
  </div>
  {#if logged}
    <p class="thanks" aria-live="polite">Thanks for your feedback!</p>
  {/if}
</section>

<style>
  .howwasit { margin-top: 1.25rem; padding: .75rem 0 0; border-top: 1px solid #eceff3; }
  .howwasit h3 { font-size: .95rem; margin: 0 0 .5rem; font-weight: 600; color: #333; }
  .rating-group { display: flex; gap: .5rem; }
  .rating-btn { text-transform: capitalize; background: #f4f6f9; border: 1px solid #d4dae2; padding: .4rem .75rem; border-radius: 20px; font-size: .8rem; cursor: pointer; }
  .rating-btn:hover:not(:disabled) { background: #e9edf3; }
  .rating-btn.active { background: #1f6feb; color: #fff; border-color: #1f6feb; }
  .rating-btn:disabled { opacity: .55; cursor: default; }
  .thanks { font-size: .75rem; color: #2d6b2d; margin: .5rem 0 0; }
</style>
