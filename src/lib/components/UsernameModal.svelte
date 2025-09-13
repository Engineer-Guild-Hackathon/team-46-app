<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { setUsername, USERNAME_MIN, USERNAME_MAX } from '$lib/stores/user'
  const dispatch = createEventDispatcher<{ submitted: void }>()
  let name = ''
  let error: string | null = null

  const allowedPattern = /^[a-z]+$/

  function sanitize(raw: string) {
    return raw.toLowerCase().replace(/[^a-z]/g, '')
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    const cleaned = sanitize(target.value)
    if (cleaned !== target.value) {
      target.value = cleaned
    }
    name = cleaned
    if (error && cleaned) error = null
  }

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      error = 'Please enter a username'
      return
    }
    if (!allowedPattern.test(trimmed)) {
      error = 'Only lowercase a-z allowed'
      return
    }
    if (trimmed.length < USERNAME_MIN) {
      error = `Username must be at least ${USERNAME_MIN} characters`
      return
    }
    if (trimmed.length > USERNAME_MAX) {
      error = `Username must be at most ${USERNAME_MAX} characters`
      return
    }
    setUsername(trimmed)
    dispatch('submitted')
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      submit()
    }
  }
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="username-title">
  <div class="modal">
    <h2 id="username-title">Choose a username</h2>
    <p class="hint">We'll attach a random id to it locally. This never leaves your browser unless an API uses it.</p>
    <label>
      <span class="sr-only">Username</span>
      <input
        placeholder="e.g. korewata"
        value={name}
        on:input={handleInput}
        on:keydown={onKey}
        pattern="[a-z]+"
        inputmode="text"
        aria-invalid={!!error}
        aria-describedby={error ? 'username-error' : undefined}
      />
    </label>
    {#if error}
      <p id="username-error" class="error" role="alert">{error}</p>
    {/if}
    <div class="actions">
      <button type="button" class="btn" on:click={submit} aria-label="Save username">Continue</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal { background: var(--color-bg, #fff); color: var(--color-fg, #111); padding: 1.5rem; border-radius: 12px; max-width: 420px; width: 100%; box-shadow: 0 4px 24px -4px rgba(0,0,0,0.3); }
  h2 { margin: 0 0 .75rem; font-size: 1.25rem; }
  .hint { margin: 0 0 1rem; font-size: .875rem; line-height: 1.3; opacity: .8; }
  input { width: 100%; font-size: 1rem; padding: .6rem .75rem; border-radius: 8px; border: 1px solid #ccc; background: #fff; }
  input[aria-invalid="true"] { border-color: #d33; }
  .error { color: #b00020; font-size: .75rem; margin:.5rem 0 0; }
  .actions { margin-top: 1rem; display: flex; justify-content: flex-end; }
  .btn { background: #111; color: #fff; border: none; border-radius: 6px; padding: .6rem 1rem; cursor: pointer; font-size: .9rem; }
  .btn:hover { background: #333; }
  .sr-only { position: absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
</style>
