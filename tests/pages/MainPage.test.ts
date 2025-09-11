import { render, fireEvent } from '@testing-library/svelte'
import { describe, it } from 'vitest'
import MainPage from '$lib/pages/MainPage.svelte'

// jsdom lacks hashchange sometimes; we can simulate navigation by setting location.hash

describe('MainPage', () => {
  it('renders heading', () => {
    const { getByText } = render(MainPage)
    getByText('Pick a book to start')
  })

  it('search triggers on Enter', async () => {
    const { getByLabelText } = render(MainPage)
    const input = getByLabelText('Search books') as HTMLInputElement
    await fireEvent.input(input, { target: { value: 'alice' } })
    await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  })
})
