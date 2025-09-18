<script lang="ts">
  import BookCard from "../components/BookCard.svelte";
  import type { Book } from "../types";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { createPaginatedBooksStore } from "$lib/api/books";
  import { onDestroy, onMount } from "svelte";
  import Browse from "./Browse.svelte";

  // UI state
  let search = "";
  let sort: "recommended" | "popularity" | "year" = "recommended";

  // Data state derived from API store
  const pageSize = 12;
  let store = createPaginatedBooksStore({ size: pageSize });
  let books: Book[] = [];
  let hasMore = true;
  let loading = true;
  let error: string | null = null;
  const skeletonCount = pageSize;
  const skeletonIndices = Array.from({ length: skeletonCount }, (_, i) => i);
  let unsubscribe = store.subscribe((p) => {
    books = p.items.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      coverUrl: b.thumbnail,
    }));
    hasMore = p.hasMore;
    // Only stop loading when we have results or definitively no more pages (no results)
    if (loading && (books.length > 0 || !hasMore)) {
      loading = false;
    }
  });
  onDestroy(() => unsubscribe());

  // Debounce search input
  let searchTimer: number | undefined;
  $: if (search !== undefined) {
    // When search changes, debounce reload
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      refreshData();
    }, 350) as unknown as number;
  }

  // React to sort changes (immediate)
  let prevSort: "recommended" | "popularity" | "year" = sort;
  $: if (sort !== prevSort) {
    prevSort = sort;
    refreshData();
  }

  async function refreshData() {
    loading = true;
    error = null;
    try {
      store = createPaginatedBooksStore({
        size: pageSize,
        search: search.trim(),
        sort: backendSort(sort),
      });
      // re-subscribe
      unsubscribe();
      unsubscribe = store.subscribe((p) => {
        books = p.items.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          coverUrl: b.thumbnail,
        }));
        hasMore = p.hasMore;
        // Maintain loading true until first results arrive or we know there are none
        if (loading && (books.length > 0 || !hasMore)) {
          loading = false;
        }
      });
    } catch (e: any) {
      error = e.message || "Failed to load books";
      loading = false;
    }
  }

  function backendSort(value: string): string | undefined {
    switch (value) {
      case "popularity":
        return "pop";
      case "year":
        return "year";
      case "recommended":
      default:
        return undefined;
    }
  }

  function submitSearch(event?: Event) {
    event?.preventDefault?.();
    refreshData();
  }

  function openBook(book: Book) {
    location.hash = `#/book/${book.id}`;
  }

  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;
    await store.loadMore();
  }

  // IntersectionObserver sentinel
  let sentinel: HTMLDivElement | null = null;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          loadMore();
        }
      });
    },
    { rootMargin: "200px 0px 0px 0px", threshold: 0 },
  );

  $: if (sentinel) observer.observe(sentinel);
  onDestroy(() => observer.disconnect());
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

<header
  class="sticky top-0 z-20 bg-transparent backdrop-blur-lg border-b border-gray-200"
>
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

<main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {#if selectedView === "browse"}
    <Browse />
  {:else if selectedView === "stats"}
    <div class="py-12 text-center text-gray-600">
      Statistics page (placeholder)
    </div>
  {:else}
    <div class="py-12 text-center text-gray-600">
      Flashcards page (placeholder)
    </div>
  {/if}
</main>

<!-- Footer navigation: Browse / Stats / Flashcards -->
<footer class="fixed bottom-4 left-0 right-0 pointer-events-none z-20">
  <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div
      class="bg-white backdrop-blur-sm border border-gray-200 rounded-full mx-auto w-max px-3 py-2 flex items-center gap-2 shadow-sm pointer-events-auto"
    >
      <Button
        size="sm"
        variant="ghost"
        class={selectedView === "browse" ? "selected" : ""}
        on:click={() => (location.hash = "#/")}>Browse</Button
      >
      <Button
        size="sm"
        variant="ghost"
        class={selectedView === "stats" ? "selected" : ""}
        on:click={() => (location.hash = "#/stats")}>Stats</Button
      >
      <Button
        size="sm"
        variant="ghost"
        class={selectedView === "flashcards" ? "selected" : ""}
        on:click={() => (location.hash = "#/flashcards")}>Flashcards</Button
      >
    </div>
  </nav>
</footer>
