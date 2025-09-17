<script lang="ts">
  import BookCard from "../components/BookCard.svelte";
  import * as Select from "$lib/components/ui/select";
  import { Input } from "$lib/components/ui/input";
  import { createPaginatedBooksStore } from "$lib/api/books";
  import { onDestroy } from "svelte";
  import type { Book } from "../types";

  let search = "";
  let sort: "recommended" | "popularity" | "year" = "recommended";

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
    if (loading && (books.length > 0 || !hasMore)) loading = false;
  });
  onDestroy(() => unsubscribe());

  let searchTimer: number | undefined;
  $: if (search !== undefined) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => refreshData(), 350) as unknown as number;
  }

  let prevSort: "recommended" | "popularity" | "year" = sort;
  $: if (sort !== prevSort) {
    prevSort = sort;
    refreshData();
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

  async function refreshData() {
    loading = true;
    error = null;
    try {
      store = createPaginatedBooksStore({
        size: pageSize,
        search: search.trim(),
        sort: backendSort(sort),
      });
      unsubscribe();
      unsubscribe = store.subscribe((p) => {
        books = p.items.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          coverUrl: b.thumbnail,
        }));
        hasMore = p.hasMore;
        if (loading && (books.length > 0 || !hasMore)) loading = false;
      });
    } catch (e: any) {
      error = e.message || "Failed to load books";
      loading = false;
    }
  }

  function submitSearch(e?: Event) {
    e?.preventDefault?.();
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

  let sentinel: HTMLDivElement | null = null;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) loadMore();
      });
    },
    { rootMargin: "200px 0px 0px 0px", threshold: 0 },
  );
  $: if (sentinel) observer.observe(sentinel);
  onDestroy(() => observer.disconnect());
</script>

<div class="mb-6">
  <form
    class="flex flex-row gap-3 items-center"
    role="search"
    on:submit|preventDefault={submitSearch}
  >
    <Input
      class="flex-grow min-w-0 w-full sm:w-[320px]"
      type="search"
      placeholder="Search books..."
      bind:value={search}
      disabled={loading}
    />
    <div class="flex items-center gap-2">
      <Select.Root type="single" bind:value={sort}>
        <Select.Trigger
          class="px-3 py-1 rounded-md bg-white border border-gray-200 shadow-sm"
          >{sort
            ? sort === "year"
              ? "Year Released"
              : sort.charAt(0).toUpperCase() + sort.slice(1)
            : "Sort by..."}</Select.Trigger
        >
        <Select.Content>
          <Select.Item value="recommended">Recommended</Select.Item>
          <Select.Item value="popularity">Popularity</Select.Item>
          <Select.Item value="year">Year Released</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>
  </form>
</div>

{#if error}
  <p class="text-sm text-red-600 mb-4">{error}</p>
{/if}

<section
  class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
>
  {#if books.length === 0 && loading}
    {#each skeletonIndices as i}
      <div class="rounded-lg bg-white shadow-sm overflow-hidden animate-pulse">
        <div class="aspect-[2/3] bg-gray-200"></div>
        <div class="p-4">
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    {/each}
  {:else if books.length === 0}
    <div class="col-span-full text-center text-gray-500 py-12">
      No books found
    </div>
  {:else}
    {#each books as b (b.id)}
      <div
        class="rounded-lg bg-white shadow-sm hover:shadow-md transition"
        role="article"
      >
        <BookCard book={b} onOpen={openBook} />
      </div>
    {/each}
    {#if loading}
      <div class="rounded-lg bg-white shadow-sm overflow-hidden animate-pulse">
        <div class="aspect-[2/3] bg-gray-200"></div>
        <div class="p-4">
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div class="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    {/if}
  {/if}
</section>

<div
  bind:this={sentinel}
  class="infinite-sentinel h-1"
  aria-hidden="true"
></div>
