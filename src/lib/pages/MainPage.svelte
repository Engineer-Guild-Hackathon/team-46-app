<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { onMount, onDestroy } from "svelte";
  import Browse from "./Browse.svelte";
  import Stats from "./Stats.svelte";
  import Flashcards from "./Flashcards.svelte";

  // View selection state (moved here so it's available app-wide)
  let selectedView: "browse" | "stats" | "flashcards" = "browse";
  function updateFromHash() {
    if (location.hash.startsWith("#/stats")) selectedView = "stats";
    else if (location.hash.startsWith("#/flashcards"))
      selectedView = "flashcards";
    else selectedView = "browse";
  }
  onMount(() => {
    updateFromHash();
    window.addEventListener("hashchange", updateFromHash);
  });
  onDestroy(() => window.removeEventListener("hashchange", updateFromHash));
</script>

<header class="sticky top-0 z-10 bg-background backdrop-blur-lg border-0">
  <div
    class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between"
  >
    <div class="flex items-center gap-3">
      <div>
        <h1 class="text-lg font-semibold leading-5 mb-1">FlexRead</h1>
        <p class="text-xs text-secondary-foreground">
          自動で「ちょうどいい難易度」になる英語本リーダー
        </p>
      </div>
    </div>
  </div>
</header>

<main class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
  {#if selectedView === "browse"}
    <Browse />
  {:else if selectedView === "stats"}
    <Stats />
  {:else}
    <Flashcards />
  {/if}
</main>

<!-- Footer navigation: Browse / Stats / Flashcards -->
<footer class="fixed bottom-4 left-0 right-0 pointer-events-none z-10">
  <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div
      class="bg-card backdrop-blur-sm rounded-full mx-auto w-max px-3 py-2 flex items-center gap-2 shadow-sm pointer-events-auto"
    >
      <Button
        size="sm"
        variant="ghost"
        class={selectedView === "browse"
          ? "bg-accent-foreground rounded-xl"
          : "rounded-xl"}
        onclick={() => (location.hash = "#/")}>Browse</Button
      >
      <Button
        size="sm"
        variant="ghost"
        class={selectedView === "stats"
          ? "bg-accent-foreground rounded-xl"
          : "rounded-xl"}
        onclick={() => (location.hash = "#/stats")}>Stats</Button
      >
      <Button
        size="sm"
        variant="ghost"
        class={selectedView === "flashcards"
          ? "bg-accent-foreground rounded-xl"
          : "rounded-xl"}
        onclick={() => (location.hash = "#/flashcards")}>Flashcards</Button
      >
    </div>
  </nav>
</footer>
