import { render, fireEvent, waitFor } from '@testing-library/svelte'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../../src/App.svelte'

function resetStorage() {
  try {
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
  } catch {}
}

describe('App user modal integration', () => {
  beforeEach(() => {
    resetStorage()
    // Mock fetch for books list to silence network errors
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/books')) {
        return Promise.resolve(
          new Response(JSON.stringify({ books: [], total: 0 }), { status: 200 })
        ) as any
      }
      return Promise.resolve(new Response('{}', { status: 200 })) as any
    })
  })

  it('shows modal when no userId and hides after submit', async () => {
    const { getByPlaceholderText, queryByText, getByRole } = render(App)

    // Modal visible
    const input = getByPlaceholderText('e.g. korewata') as HTMLInputElement
    expect(input).toBeTruthy()

    await fireEvent.input(input, { target: { value: 'reader' } })
    const btn = getByRole('button', { name: 'Save username' })
    await fireEvent.click(btn)

    await waitFor(() => {
      // Modal removed
      expect(queryByText('Choose a username')).toBeNull()
    })

    expect(localStorage.getItem('userId')).toMatch(/^reader-/)
  })
})
