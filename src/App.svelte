<script lang="ts">
  import './app.css';
  import MainPage from './lib/pages/MainPage.svelte';
  import BookPage from './lib/pages/BookPage.svelte';
  import UsernameModal from '$lib/components/UsernameModal.svelte';
  import { user } from '$lib/stores/user';
  import { get } from 'svelte/store';
  
  let route: 'main' | 'book' = 'main';
  let bookId: string | null = null;
  
  function parseHash() {
    const hash = window.location.hash;
  
    if (hash.startsWith('#/book/')) {
      route = 'book';
      bookId = hash.replace('#/book/', '');
    } else {
      route = 'main';
      bookId = null;
    }
  }
  
  parseHash();
  window.addEventListener('hashchange', parseHash);

  let showUserModal = false;
  function checkUser() {
    const u = get(user);
    showUserModal = !u.userId;
  }
  checkUser();
</script>

{#if route === 'main'}
  <MainPage />
{:else if route === 'book' && bookId}
  <BookPage bookId={bookId} />
{/if}

{#if showUserModal}
  <UsernameModal on:submitted={() => (showUserModal = false)} />
{/if}
