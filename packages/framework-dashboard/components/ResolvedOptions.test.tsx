import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResolvedOptions } from './ResolvedOptions.js'
import type { OptionRow } from './OptionsMenu.js'
import { hoverTooltip, unhoverTooltip } from '../test-utils.js'

const rows = (over: Partial<Record<string, boolean>> = {}): OptionRow[] => [
  { key: 'transparent', label: 'Transparent', title: 'a', description: 'a', checked: over.transparent ?? false },
  { key: 'vanilla', label: 'Disable system prompt', title: 't', description: 't', checked: over.vanilla ?? false },
  {
    key: 'browser',
    label: 'Browser',
    title: 'b',
    description: 'b',
    checked: over.browser ?? false,
    disabled: over.browserDisabled ?? false,
  },
]

describe('ResolvedOptions (#842)', () => {
  test('renders nothing when no option is on and the repo sets nothing', () => {
    const { container } = render(<ResolvedOptions options={rows()} sources={{}} fileConfig={{}} />)
    expect(container.innerHTML).toBe('')
  })

  test('lists the options in play without opening the gear', () => {
    render(<ResolvedOptions options={rows({ transparent: true, vanilla: true })} sources={{}} fileConfig={{}} />)
    expect(screen.getByText('Transparent')).toBeTruthy()
    expect(screen.getByText('Disable system prompt')).toBeTruthy()
    expect(screen.queryByText('Browser')).toBeNull()
  })

  test('a disabled option is not in play, however it is stored', () => {
    render(
      <ResolvedOptions options={rows({ browser: true, browserDisabled: true })} sources={{}} fileConfig={{}} />,
    )
    expect(screen.queryByText('Browser')).toBeNull()
  })

  test('a value inherited from the repo yml is marked as not yours', async () => {
    render(
      <ResolvedOptions
        options={rows({ transparent: true, vanilla: true })}
        sources={{ vanilla: 'repo', transparent: 'global' }}
        fileConfig={{}}
      />,
    )
    const repo = screen.getByText('Disable system prompt')
    const yours = screen.getByText('Transparent')
    expect(repo.textContent).toContain('repo')
    // Which tier a chip came from is a hover away, on the chip itself.
    expect((await hoverTooltip(repo)).textContent).toContain('the-framework.yml')
    unhoverTooltip(repo)
    expect(yours.textContent).not.toContain('repo')
    expect((await hoverTooltip(yours)).textContent).toContain('Your setting')
  })

  test('shows the yml keys the gear cannot set, always as the repo tier', () => {
    render(
      <ResolvedOptions options={rows()} sources={{}} fileConfig={{ preset: 'software-development', event: 'bug-fix' }} />,
    )
    expect(screen.getByText(/preset: software-development/).textContent).toContain('repo')
    expect(screen.getByText(/kind: bug-fix/).textContent).toContain('repo')
  })
})
