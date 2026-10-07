import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ConnectionIndicator } from './ConnectionIndicator.js'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('ConnectionIndicator', () => {
  test('on this machine the pill reads "Local" and folds away below sm with screen-size classes alone', () => {
    // jsdom serves the page from a loopback address, which is this machine's own daemon.
    render(<ConnectionIndicator />)
    const pill = screen.getByText('Local').parentElement as HTMLElement
    expect(pill.classList.contains('max-sm:hidden')).toBe(true)
    expect(pill.classList.contains('sm:inline-flex')).toBe(true)
    // Never a bare `hidden` or `inline-flex`: a tool page's stylesheet is loaded after the page's
    // and its own `.hidden` then decided, hiding the pill at every width.
    expect(pill.classList.contains('hidden')).toBe(false)
    expect(pill.classList.contains('inline-flex')).toBe(false)
  })
})
