<script lang="ts">
  import type { Book } from '../types'
  export let book: Book
  export let onOpen: (book: Book) => void

  const handleClick = () => onOpen?.(book)
</script>

<button class="card" type="button" on:click={handleClick} aria-label={`Open ${book.title}`}>
  <div class="cover-wrap">
    <div class="cover">
      {#if book.coverUrl}
        <img src={book.coverUrl} alt={`Cover of ${book.title}`} />
      {:else}
        <div class="placeholder" aria-hidden="true"></div>
      {/if}
    </div>
  </div>

  <div class="card-body">
    <div class="meta">
      <h3 class="title">{book.title}</h3>
      {#if book.author}
        <p class="author">{book.author}</p>
      {/if}
    </div>
  </div>
</button>

<style>
  .card {
    appearance:none;
    display:flex;
    flex-direction:column;
    background:var(--card);
    color:var(--card-foreground);
    border: 1px solid rgba(48, 48, 48, 0.1);
    border-radius:14px;
    overflow:hidden;
    transition:transform .18s ease, box-shadow .18s ease;
    box-shadow:0 1px 6px rgba(16,24,40,0.04);
    text-align:left;
    cursor:pointer;
  padding:10px;
  }
  .card:hover { transform:translateY(-6px); box-shadow:0 12px 30px rgba(16,24,40,0.12) }
  .card:focus { outline:2px solid rgba(59,130,246,0.35); outline-offset:2px }

  .cover-wrap { width:100%; position:relative }
  .cover { width:100%; aspect-ratio:2/3; overflow:hidden; background:var(--muted) }
  .cover img { width:100%; height:100%; object-fit:cover; display:block }
  .placeholder { width:100%; height:100%; background:linear-gradient(90deg,#f3f4f6,#e5e7eb); border-radius:8px; margin:0 0 0 0}

  .card-body { display:flex; padding:8px 2px 5px 0px }
  .meta { display:flex; flex-direction:column; gap:2px; flex:1 }
  .title { margin:0; font-weight:700; font-size:1.04rem; line-height:1.15 }
.author { 
    margin: 0; 
    color: var(--muted-foreground); 
    font-size: 0.9rem; 
    text-overflow: ellipsis; 
    overflow: hidden; 
    white-space: nowrap; 
    max-width: 90%; 
    display: inline-block; 
}
</style>
