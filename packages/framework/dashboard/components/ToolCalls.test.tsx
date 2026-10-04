import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToolCalls, type ToolStep } from './ToolCalls.js'

afterEach(cleanup)

const bash = (detail: string): ToolStep => ({ type: 'action', label: 'Bash', detail })

describe('ToolCalls', () => {
  test('a lone call is its own line: the verb in grey, what it was done to in dark', () => {
    render(<ToolCalls steps={[{ type: 'action', label: 'Read', detail: '/repo/AGENTS.md' }]} />)
    const line = screen.getByRole('button', { name: 'Read AGENTS.md' })
    expect(line.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('AGENTS.md').className).toContain('text-foreground')
    expect(screen.getByText('Read').className).not.toContain('text-foreground')
    expect(screen.queryByText(/1 file/)).toBeNull()
  })

  test('a lone call opens to its detail whole, and folds again', () => {
    render(<ToolCalls steps={[{ type: 'action', label: 'Read', detail: '/repo/AGENTS.md' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Read AGENTS.md' }))
    expect(screen.getByText('/repo/AGENTS.md').tagName).toBe('PRE')
    fireEvent.click(screen.getByRole('button', { name: 'Read AGENTS.md' }))
    expect(screen.queryByText('/repo/AGENTS.md')).toBeNull()
  })

  test('a call with no detail is a line that does not open', () => {
    render(<ToolCalls steps={[{ type: 'action', label: 'TodoWrite' }]} />)
    expect(screen.getByText('Updated todos')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('several calls are one line counting them, folded', () => {
    render(<ToolCalls steps={[bash('pnpm build'), bash('pnpm test')]} />)
    expect(screen.getByRole('button', { name: 'Ran 2 commands' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('pnpm build')).toBeNull()
  })

  test('the line opens to a bordered box with one line per call, in order, each opening further', () => {
    const { container } = render(<ToolCalls steps={[bash('pnpm build'), { type: 'action', label: 'Edit', detail: '/repo/src/app.ts' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ran 1 command, edited 1 file' }))
    const box = container.querySelector('.border')!
    expect(Array.from(box.querySelectorAll('button')).map(b => b.textContent)).toEqual(['Ranpnpm build', 'Editedapp.ts'])
    fireEvent.click(screen.getByRole('button', { name: 'Edited app.ts' }))
    expect(screen.getByText('/repo/src/app.ts')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ran 1 command, edited 1 file' }))
    expect(container.querySelector('.border')).toBeNull()
  })

  test("Codex's calls read the same: its item kinds have their own verbs", () => {
    render(<ToolCalls steps={[{ type: 'action', label: 'commandExecution', detail: 'pnpm test' }, { type: 'action', label: 'fileChange', detail: '/repo/a.ts' }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ran 1 command, edited 1 file' }))
    expect(screen.getByRole('button', { name: 'Ran pnpm test' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edited a.ts' })).toBeTruthy()
  })

  test('a thought is no line of its own: it is inside the opened box, folded, where it was thought', () => {
    const { container } = render(<ToolCalls steps={[{ type: 'thought', text: 'look at the docs first' }, bash('ls')]} />)
    expect(screen.queryByText(/Thought|look at the docs/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ran 1 command' }))
    expect(Array.from(container.querySelectorAll('.border button')).map(b => b.textContent)).toEqual(['Thought', 'Ranls'])
    expect(screen.queryByText('look at the docs first')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thought' }))
    expect(screen.getByText('look at the docs first')).toBeTruthy()
  })

  test('thoughts with no call draw nothing', () => {
    const { container } = render(<ToolCalls steps={[{ type: 'thought', text: 'hm' }]} />)
    expect(container.firstChild).toBeNull()
  })
})
