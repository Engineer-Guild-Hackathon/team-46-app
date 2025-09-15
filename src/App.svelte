<script lang="ts">
  import './app.css';
  import MainPage from './lib/pages/MainPage.svelte';
  import LandingPage from './lib/pages/LandingPage.svelte';
  import BookPage from './lib/pages/BookPage.svelte';
  import UsernameModal from '$lib/components/UsernameModal.svelte';
  import { user } from '$lib/stores/user';
  import { get } from 'svelte/store';
  
  let route: 'landing' | 'main' | 'book' = 'landing';
  let bookId: string | null = null;
  
  function parseHash() {
    const hash = window.location.hash;
  
    if (hash === '' || hash === '#' || hash === '#/' ) {
      route = 'landing';
      bookId = null;
    } else if (hash.startsWith('#/book/')) {
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

{#if route === 'landing'}
  <LandingPage />
{:else if route === 'main'}
  <MainPage />
{:else if route === 'book' && bookId}
  <BookPage bookId={bookId} />
{/if}

{#if showUserModal}
  <UsernameModal on:submitted={() => (showUserModal = false)} />
{/if}
