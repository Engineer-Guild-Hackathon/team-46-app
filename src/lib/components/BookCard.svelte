<script lang="ts">
  import type { Book } from "../types";
  export let book: Book;
  export let onOpen: (book: Book) => void;

  const handleClick = () => onOpen?.(book);
</script>

<button
  type="button"
  on:click={handleClick}
  aria-label={`Open ${book.title}`}
  class="bg-card flex flex-col border-0 rounded-[14px] overflow-hidden transition-transform duration-200 ease-out shadow-sm hover:-translate-y-1.5 hover:shadow-xl text-left cursor-pointer p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2"
>
  <div class="relative w-full">
    <div class="w-full aspect-[2/3] overflow-hidden chromatic-ignore">
      {#if book.coverUrl}
        <img
          class="w-full h-full object-cover block rounded-sm"
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
        />
      {:else}
        <div
          class="w-full h-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg"
          aria-hidden="true"
        ></div>
      {/if}
    </div>
  </div>

  <div class="flex pt-2 pr-0.5 pb-1.5 pl-0">
    <div class="flex flex-col gap-[2px] flex-1">
      <h3 class="m-0 font-semibold text-[1.04rem] leading-[1.15]">
        {book.title}
      </h3>
      {#if book.author}
        <p
          class="m-0 font-semibold text-secondary-foreground text-[0.9rem] truncate max-w-[90%] inline-block"
        >
          {book.author}
        </p>
      {/if}
    </div>
  </div>
</button>
