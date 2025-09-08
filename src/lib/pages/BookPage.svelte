<script lang="ts">
  import type { Book } from '../types'
  import { onMount } from 'svelte'

  export let bookId: string
  let book: Book | null = null
  let text: string = ''
  let loading = true

  // Mocked book/text data
  const mockBooks: Book[] = [
    { id: '1', title: 'The Little Prince', author: 'Antoine de Saint‑Exupéry' },
    { id: '2', title: 'Alice in Wonderland', author: 'Lewis Carroll' },
    { id: '3', title: 'Treasure Island', author: 'R. L. Stevenson' },
    { id: '4', title: 'Gulliver\'s Travels', author: 'Jonathan Swift' },
  ]
  const mockTexts: Record<string, string> = {
    '1': 'Once upon a time, there was a little prince who lived on a tiny planet...',
    '2': 'Alice was beginning to get very tired of sitting by her sister on the bank...',
    '3': 'Squire Trelawney, Dr. Livesey, and the rest of these gentlemen...',
    '4': 'My father had a small estate in Nottinghamshire; I was the third of five sons...'
  }

  onMount(() => {
    book = mockBooks.find(b => b.id === bookId) || null
    text = mockTexts[bookId] || 'No text available.'
    loading = false
  })
</script>

<main class="bookpage">
  {#if loading}
    <p>Loading…</p>
  {:else if !book}
    <p>Book not found.</p>
  {:else}
    <section class="book-meta">
      <h2>{book.title}</h2>
      {#if book.author}<p class="author">{book.author}</p>{/if}
    </section>
    <section class="book-text">
      <pre>{text}</pre>
    </section>
    <button class="back" on:click={() => window.location.hash = '#/'}>Back</button>
  {/if}
</main>

<style>
  .bookpage { max-width: 700px; margin: 2rem auto; padding: 1rem; }
  .book-meta { margin-bottom: 1.5rem; }
  h2 { font-size: 1.5rem; margin: 0; }
  .author { opacity: 0.7; margin: 0.25rem 0 0; }
  .book-text pre {
    background: #f6f6f6;
    color: #222;
    padding: 1rem;
    border-radius: 8px;
    font-size: 1.05rem;
    white-space: pre-wrap;
    margin: 0 0 1.5rem;
  }
  .back {
    margin-top: 1rem;
    border-radius: 8px;
    border: 1px solid #ccc;
    background: #eee;
    padding: 0.5em 1em;
    cursor: pointer;
  }
</style>