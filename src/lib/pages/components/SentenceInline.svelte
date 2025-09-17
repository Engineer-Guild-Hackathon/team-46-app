<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { renderSentenceHTML } from "$lib/pages/bookPageUtils";

  const dispatch = createEventDispatcher();

  export let idx: number;
  export let s: any;
  export let selected: boolean = false;
  export let bubbleVisible: boolean = false;
  export let wordHighlights: Set<number> | undefined;
  export let wordTooltipVisible: boolean = false;
  export let wordTooltipWordIndex: number | undefined;

  let elRef: HTMLElement | null = null;

  onMount(() => {
    dispatch("mounted", { idx, el: elRef });
  });
  onDestroy(() => dispatch("destroyed", { idx }));

  function onClick(e: MouseEvent) {
    dispatch("sentenceClick", { idx, event: e });
  }
  function onContextMenu(e: MouseEvent) {
    dispatch("sentenceContextmenu", { idx, event: e });
  }
  function onMouseDown(e: MouseEvent) {
    dispatch("sentenceMouseDown", { idx, event: e });
  }
  function onPointerDown(e: PointerEvent) {
    dispatch("sentencePointerDown", { idx, event: e });
  }
  function onPointerMove(e: PointerEvent) {
    dispatch("sentencePointerMove", { idx, event: e });
  }
  function onPointerUp(e: PointerEvent) {
    dispatch("sentencePointerUp", { idx, event: e });
  }
  function onKeydown(e: KeyboardEvent) {
    dispatch("sentenceKeydown", { idx, event: e });
  }
</script>

<span
  role="button"
  tabindex="0"
  class="sentenceInline inline relative cursor-pointer rounded px-[0.04em] {selected
    ? 'selected bg-amber-200'
    : ''} focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300"
  bind:this={elRef}
  on:click={onClick}
  on:mousedown={onMouseDown}
  on:contextmenu={onContextMenu}
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerup={onPointerUp}
  on:keydown={onKeydown}
  aria-pressed={selected}
>
  {@html renderSentenceHTML(
    idx,
    s,
    wordHighlights,
    wordTooltipVisible,
    wordTooltipWordIndex,
  )}
</span>

{#if bubbleVisible}
  <span
    class="jp-translation block text-[0.9rem] text-[#0a56ad] mt-1 ml-1 leading-[1.2]"
    aria-label="Japanese translation">{s.jp}</span
  >
{/if}
