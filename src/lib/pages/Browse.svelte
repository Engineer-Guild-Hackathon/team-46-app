<script lang="ts">
  import BookCard from "../components/BookCard.svelte";
  import * as Select from "$lib/components/ui/select";
  import { Input } from "$lib/components/ui/input";
  import { Search } from "@lucide/svelte";
  import type { Book } from "../types";
  import { fetchBooks } from "$lib/api/books";

  let search = $state("");

  const sortOptions = [
    { value: "recommended", label: "Recommended" },
    { value: "popularity", label: "Popular" },
    { value: "year", label: "Year Released" },
  ];

  let sortValue = $state("recommended");
  // Last submitted search term (used for fetching)
  let query = $state("");

  const pageSize = 12;
  let books: Book[] = $state([]);
  // no infinite scroll
  let loading = $state(false);
  let error: string | null = $state(null);
  const skeletonCount = pageSize;
  const skeletonIndices = Array.from({ length: skeletonCount }, (_, i) => i);

  // Fetch a page of books (initial and on searches)
  async function refreshData() {
    loading = true;
    error = null;
    try {
      const page = await fetchBooks({
        search: query || undefined,
        start: 0,
        size: pageSize,
        sort: backendSort(sortValue),
      });
      books = page.items.map((it) => ({
        id: it.id,
        title: it.title,
        author: it.author,
        coverUrl: it.thumbnail,
      }));
      // ignoring hasMore since infinite scroll is disabled
    } catch (e: any) {
      error = e?.message || "Failed to load books";
    } finally {
      loading = false;
    }
  }

  const triggerContent = $derived(
    sortOptions.find((s) => s.value === sortValue)?.label || "Sort by...",
  );

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

  function submitSearch(e?: Event) {
    e?.preventDefault?.();
    query = search.trim();
    // Trigger fetch explicitly on submit/icon click
    refreshData();
  }

  function openBook(book: Book) {
    location.hash = `#/book/${book.id}`;
  }

  // Initial load (once)
  $effect.pre(() => {
    refreshData();
  });
</script>

<div class="mb-6">
  <form
    class="flex flex-col gap-3"
    role="search"
    onsubmit={(e) => {
      e.preventDefault();
      submitSearch(e);
    }}
  >
    <div
      class="flex flex-grow rounded-2xl bg-accent-foreground h-12 items-center shadow-sm px-3 py-2 w-full max-w-md"
    >
      <button
        type="submit"
        class="m-2 p-0 border-0 bg-transparent cursor-pointer text-secondary-foreground inline-flex items-center justify-center"
        aria-label="Search"
        title="Search"
        disabled={loading}
      >
        <Search class="w-5 h-5" />
      </button>
      <Input
        class="flex-grow min-w-0 w-full sm:w-[320px] border-0 bg-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none h-12"
        type="search"
        placeholder="Search books..."
        bind:value={search}
        disabled={loading}
      />
    </div>
    <Select.Root type="single" bind:value={sortValue}>
      <Select.Trigger class="px-3 py-1 rounded-2xl h-12 bg-accent-foreground ">
        {triggerContent}
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          <Select.Label>Sort by...</Select.Label>
          {#each sortOptions as option (option.value)}
            <Select.Item value={option.value} label={option.label}>
              {option.label}
            </Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  </form>
</div>

{#if error}
  <p class="text-sm text-red-600 mb-4">{error}</p>
{/if}

<section
  class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
>
  {#if loading}
    {#each skeletonIndices as _}
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
      <BookCard book={b} onOpen={openBook} />
    {/each}
  {/if}
</section>
