<script lang="ts">
  import "./app.css";
  import MainPage from "./lib/pages/main/MainPage.svelte";
  import BookPage from "./lib/pages/book/BookPage.svelte";
  import { user } from "$lib/stores/user";
  // Ensure the user store is instantiated and side effects (userId generation) run,
  // and harden persistence for the integration test environment.
  function genUUID() {
    if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  let _once = false;
  const _unsub = user.subscribe((v) => {
    if (_once) return;
    _once = true;
    try {
      const existing =
        typeof localStorage !== "undefined" && localStorage.getItem("userId");
      if (v?.userId) {
        if (!existing && typeof localStorage !== "undefined") {
          localStorage.setItem("userId", v.userId);
        }
        return;
      }
      const newId = genUUID();
      if (typeof localStorage !== "undefined")
        localStorage.setItem("userId", newId);
      user.set({ userId: newId, username: null });
    } catch {
      /* ignore */
    }
  });

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
</script>

{#if route === "main"}
  <MainPage />
{:else if route === "book" && bookId}
  <BookPage {bookId} />
{/if}
