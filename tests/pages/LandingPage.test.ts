import { render, screen } from '@testing-library/svelte'
import LandingPage from '../../src/lib/pages/LandingPage.svelte'
import { describe, it, expect, vi } from 'vitest'

describe('LandingPage', () => {
  it('renders hero headline and CTA', () => {
    render(LandingPage)
    expect(screen.getByText('FlexRead')).toBeTruthy()
    expect(screen.getByRole('button', { name: /start reading/i })).toBeTruthy()
  })

  it('shows morph container', () => {
    render(LandingPage)
    expect(screen.getByText(/wish/i)).toBeTruthy()
  })

  it('morphs text to easy variant after some time', async () => {
    vi.useFakeTimers()
    render(LandingPage)
    // initial hard text
    expect(screen.getByText(/shut up like a telescope/i)).toBeTruthy()
    // advance timers past initial delay + morph duration + settle
    vi.advanceTimersByTime(1600 + 140 * 15)
    // Should now contain easy wording ("shrink")
    expect(screen.getByText(/shrink like a telescope/i)).toBeTruthy()
    vi.useRealTimers()
  })
})
