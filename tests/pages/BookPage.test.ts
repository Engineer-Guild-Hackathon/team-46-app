import { render } from '@testing-library/svelte'
import { describe, it } from 'vitest'
import BookPage from '$lib/pages/BookPage.svelte'

describe('BookPage', () => {
  it('shows not found for unknown id (post-mount)', () => {
    const { getByText } = render(BookPage, { bookId: 'nope' })
    getByText('Book not found.')
  })
})
