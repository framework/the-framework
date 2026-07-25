import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResolvedOptions } from './ResolvedOptions.js'
import type { OptionRow } from './OptionsMenu.js'
import { hoverTooltip, unhoverTooltip } from '../test-utils.js'

const rows = (over: Partial<Record<string, boolean>> = {}): OptionRow[] => [
  { key: 'autopilot', label: 'Autopilot', title: 'a', description: 'a', checked: over.autopilot ?? false },
  { key: 'technical', label: 'Technical control', title: 't', description: 't', checked: over.technical ?? false },
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
    render(<ResolvedOptions options={rows({ autopilot: true, technical: true })} sources={{}} fileConfig={{}} />)
    expect(screen.getByText('Autopilot')).toBeTruthy()
    expect(screen.getByText('Technical control')).toBeTruthy()
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
        options={rows({ autopilot: true, technical: true })}
        sources={{ technical: 'repo', autopilot: 'global' }}
        fileConfig={{}}
      />,
    )
    const repo = screen.getByText('Technical control')
    const yours = screen.getByText('Autopilot')
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
