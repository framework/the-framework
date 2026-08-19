import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResolvedOptions } from './ResolvedOptions.js'
import type { OptionRow } from './OptionsMenu.js'
import { hoverTooltip, unhoverTooltip } from '../test-utils.js'

const rows = (over: Partial<Record<string, boolean>> = {}): OptionRow[] => [
  { key: 'transparent', patch: checked => ({ transparent: checked }), label: 'Transparent', title: 'a', description: 'a', checked: over.transparent ?? false },
  { key: 'vanilla', patch: checked => ({ vanilla: checked }), label: 'Disable system prompt', title: 't', description: 't', checked: over.vanilla ?? false },
  {
    key: 'browser',
    patch: checked => ({ browser: checked }),
    label: 'Browser',
    title: 'b',
    description: 'b',
    checked: over.browser ?? false,
    disabled: over.browserDisabled ?? false,
  },
]

describe('ResolvedOptions (#842)', () => {
  test('renders nothing when no option is on', () => {
    const { container } = render(<ResolvedOptions options={rows()} sources={{}} />)
    expect(container.innerHTML).toBe('')
  })

  test('lists the options in play without opening the gear', () => {
    render(<ResolvedOptions options={rows({ transparent: true, vanilla: true })} sources={{}} />)
    expect(screen.getByText('Transparent')).toBeTruthy()
    expect(screen.getByText('Disable system prompt')).toBeTruthy()
    expect(screen.queryByText('Browser')).toBeNull()
  })

  test('a disabled option is not in play, however it is stored', () => {
    render(
      <ResolvedOptions options={rows({ browser: true, browserDisabled: true })} sources={{}} />,
    )
    expect(screen.queryByText('Browser')).toBeNull()
  })

  test('a value inherited from the repo yml is marked as not yours', async () => {
    render(
      <ResolvedOptions
        options={rows({ transparent: true, vanilla: true })}
        sources={{ vanilla: 'repo', transparent: 'global' }}
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
})
