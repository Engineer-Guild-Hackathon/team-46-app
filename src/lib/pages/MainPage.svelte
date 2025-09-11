<script lang="ts">
  import BookCard from '../components/BookCard.svelte'
  import type { Book } from '../types'
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { createPaginatedBooksStore } from '$lib/api/books'
  import { onDestroy } from 'svelte'

  // UI state
  let search = ''
  let sort: 'recommended' | 'popularity' | 'year' = 'recommended'

  // Data state derived from API store
  const pageSize = 12
  let store = createPaginatedBooksStore({ size: pageSize })
  let books: Book[] = []
  let hasMore = true
  let loading = true
  let error: string | null = null
  const skeletonCount = pageSize
  const skeletonIndices = Array.from({ length: skeletonCount }, (_, i) => i)
  let unsubscribe = store.subscribe((p) => {
    books = p.items.map(b => ({ id: b.id, title: b.title, author: b.author, coverUrl: b.thumbnail }))
    hasMore = p.hasMore
    // Only stop loading when we have results or definitively no more pages (no results)
    if (loading && (books.length > 0 || !hasMore)) {
      loading = false
    }
  })
  onDestroy(() => unsubscribe())

  // Debounce search input
  let searchTimer: number | undefined
  $: if (search !== undefined) {
    // When search changes, debounce reload
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      refreshData()
    }, 350) as unknown as number
  }

  // React to sort changes (immediate)
  let prevSort = sort
  $: if (sort !== prevSort) {
    prevSort = sort
    refreshData()
  }

  async function refreshData() {
    loading = true
    error = null
    try {
  store = createPaginatedBooksStore({ size: pageSize, search: search.trim(), sort: backendSort(sort) })
  // re-subscribe
  unsubscribe()
  unsubscribe = store.subscribe((p) => {
        books = p.items.map(b => ({ id: b.id, title: b.title, author: b.author, coverUrl: b.thumbnail }))
        hasMore = p.hasMore
        // Maintain loading true until first results arrive or we know there are none
        if (loading && (books.length > 0 || !hasMore)) {
          loading = false
        }
      })
    } catch (e: any) {
      error = e.message || 'Failed to load books'
      loading = false
    }
  }

  function backendSort(value: string): string | undefined {
    switch (value) {
      case 'popularity': return 'pop'
      case 'year': return 'year'
      case 'recommended':
      default: return undefined
    }
  }

  function submitSearch(event?: Event) {
    event?.preventDefault?.()
    refreshData()
  }

  function openBook(book: Book) {
    location.hash = `#/book/${book.id}`
  }

  async function loadMore() {
    if (loading || !hasMore) return
    loading = true
    await store.loadMore()
  }

  // IntersectionObserver sentinel
  let sentinel: HTMLDivElement | null = null
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        loadMore()
      }
    })
  }, { rootMargin: '200px 0px 0px 0px', threshold: 0 })

  $: if (sentinel) observer.observe(sentinel)
  onDestroy(() => observer.disconnect())
</script>

<header class="topbar">
  <h1 class="brand">App</h1>
  <nav class="nav">
    <button class="login" title="Login">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="vertical-align:middle;">
        <circle cx="12" cy="8.5" r="4" stroke="currentColor" stroke-width="1.5" />
        <path d="M4 19c0-2.5 3.5-4 8-4s8 1.5 8 4" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <span class="login-label">Login</span>
    </button>
  </nav>
</header>

<main class="container">
  <section class="intro">
    <h2>Pick a book to start</h2>
    <p class="muted">Level-based text generation PoC</p>
  </section>

    <form class="controls" role="search" on:submit|preventDefault={submitSearch}>
      <Input
        class="w-[220px]"
        type="search"
        placeholder="Search books..."
        aria-label="Search books"
        bind:value={search}
        disabled={loading}
      />
      <Button size="sm" disabled={loading} aria-label="Run search" type="submit">Search</Button>
      <Select.Root type="single" bind:value={sort}>
        <Select.Trigger>
          {sort ? (sort === 'year' ? 'Year Released' : sort.charAt(0).toUpperCase() + sort.slice(1)) : 'Sort by...'}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="recommended">Recommended</Select.Item>
          <Select.Item value="popularity">Popularity</Select.Item>
          <Select.Item value="year">Year Released</Select.Item>
        </Select.Content>
      </Select.Root>
    </form>

  {#if error}
    <p class="warning">{error}</p>
  {/if}
  <section class="grid" aria-live="polite">
    {#if books.length === 0 && loading}
      {#each skeletonIndices as i (i)}
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-cover shimmer"></div>
          <div class="skeleton-body">
            <div class="skeleton-line w-85 shimmer"></div>
            <div class="skeleton-line w-60 shimmer"></div>
          </div>
          <div class="skeleton-footer">
            <div class="skeleton-badge shimmer"></div>
          </div>
        </div>
      {/each}
    {:else if books.length === 0}
      <div class="empty-state">No books found</div>
    {:else}
      {#each books as b (b.id)}
        <BookCard book={b} onOpen={openBook} />
      {/each}
      {#if loading}
        <!-- Loading indicator for pagination -->
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-cover shimmer"></div>
          <div class="skeleton-body">
            <div class="skeleton-line w-85 shimmer"></div>
            <div class="skeleton-line w-60 shimmer"></div>
          </div>
          <div class="skeleton-footer">
            <div class="skeleton-badge shimmer"></div>
          </div>
        </div>
      {/if}
    {/if}
  </section>
  <div bind:this={sentinel} class="infinite-sentinel" aria-hidden="true"></div>
</main>

<style>
  .topbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1rem;
    backdrop-filter: blur(6px);
    border-bottom: 1px solid color-mix(in oklab, currentColor 15%, transparent);
  }
  .brand { font-size: 1.15rem; margin: 0; letter-spacing: 0.02em; }
  .nav { display: flex; align-items: center; gap: 0.5rem; }
  .login {
    display: flex; align-items: center; gap: 0.3em;
    font-size: 1em;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0.2em 0.6em;
    border-radius: 6px;
    transition: background 0.2s;
  }
  .login:hover {
    background: color-mix(in oklab, currentColor 10%, transparent);
  }
  .login-label { display: inline-block; }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1rem 2.5rem;
  }
    .controls {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.75rem;
      margin: 0.5rem 0 1.25rem;
    }
  /* search input now uses shadcn <Input> */
  /* Button is styled by shadcn */
  .intro {
    text-align: left;
    margin: 0.25rem 0 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eee;
  }
  .intro h2 {
    margin: 0 0 0.25rem;
    font-size: 1.35rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .muted {
    opacity: 0.7;
    margin: 0;
    font-size: 1rem;
  }
  .warning {
    color: #c97;
    margin-bottom: 1rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 0.5rem;
    min-height: 520px; /* keep layout stable during loading/empty */
  }

  /* Skeleton styles */
  .skeleton-card {
    display: flex; flex-direction: column; border: 1px solid var(--border);
    background: var(--card); border-radius: 14px; overflow: hidden;
  }
  .skeleton-cover { aspect-ratio: 2/3; background: #eee; }
  .skeleton-body { padding: 8px 10px 0 10px; display: flex; flex-direction: column; gap: 8px }
  .skeleton-line { height: 12px; border-radius: 6px; background: #e9e9e9 }
  .skeleton-line.w-85 { width: 85% }
  .skeleton-line.w-60 { width: 60% }
  .skeleton-footer { padding: 8px 10px 10px 10px }
  .skeleton-badge { width: 110px; height: 22px; border-radius: 999px; background: #e9e9e9 }

  .shimmer { position: relative; overflow: hidden }
  .shimmer::after {
    content: ""; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.35), rgba(255,255,255,0));
    animation: shimmer 1.3s infinite;
  }
  @keyframes shimmer {
    100% { transform: translateX(100%) }
  }

  .empty-state { grid-column: 1 / -1; opacity: 0.6; padding: 0.5rem 0 }
  .infinite-sentinel { height: 1px; }
  @media (max-width: 520px) {
    .container { padding: 1rem 0.5rem; }
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
  }
</style>
