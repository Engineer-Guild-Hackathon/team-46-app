<script lang="ts">
  import "./app.css";
  import MainPage from "./lib/pages/MainPage.svelte";
  import BookPage from "./lib/pages/BookPage.svelte";
  // Username modal removed; userId is generated automatically
  import "$lib/stores/user";

  let route: "main" | "book" = "main";
  let bookId: string | null = null;

  function parseHash() {
    const hash = window.location.hash;

    if (hash.startsWith("#/book/")) {
      route = "book";
      bookId = hash.replace("#/book/", "");
    } else {
      route = "main";
      bookId = null;
    }
  }

  parseHash();
  window.addEventListener("hashchange", parseHash);

  // No user modal; user store initializes userId automatically
</script>

{#if route === "main"}
  <MainPage />
{:else if route === "book" && bookId}
  <BookPage {bookId} />
{/if}
