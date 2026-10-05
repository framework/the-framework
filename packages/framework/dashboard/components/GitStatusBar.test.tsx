import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GitStatusBar } from './GitStatusBar.js'

afterEach(cleanup)

const pr = { number: 12, url: 'https://github.com/o/r/pull/12', state: 'OPEN', title: 'Dark mode' }
const SIZED = { checkout: { path: '/w', dirty: false, sizeBytes: 5 * 1024 * 1024 }, branch: 'agent-dark-mode' }

describe('GitStatusBar (#809)', () => {
  test('the name and the size, nothing else; not clean or dirty, not its branch, not its pull request', () => {
    for (const dirty of [true, false]) {
      const { container } = render(<GitStatusBar label="Dark mode" checkout={{ checkout: { path: '/w', dirty, sizeBytes: 5 * 1024 * 1024 }, branch: 'agent-dark-mode', pr }} />)
      expect(container.textContent).toBe('Dark mode5 MB')
      cleanup()
    }
    // Its checkout gone, or not read yet: the name alone.
    for (const checkout of [{ branch: 'agent-dark-mode', pr }, null]) {
      const { container } = render(<GitStatusBar label="Dark mode" checkout={checkout} />)
      expect(container.textContent).toBe('Dark mode')
      cleanup()
    }
  })

  test("never a branch, not even while the agent's name is not known yet", () => {
    const { container } = render(<GitStatusBar checkout={{ checkout: { path: '/w', dirty: false }, branch: 'agent-dark-mode', pr }} />)
    expect(container.textContent).toBe('')
    expect(container.querySelector('a')).toBeNull()
  })

  test('the size lands when the caller hands the checkout in', () => {
    const { rerender } = render(<GitStatusBar label="Dark mode" checkout={null} />)
    expect(screen.queryByText('5 MB')).toBeNull()
    rerender(<GitStatusBar label="Dark mode" checkout={SIZED} />)
    expect(screen.getByText('5 MB')).toBeTruthy()
  })

  test('beside a long session name the project stays, capped, and the session name is what gets cut', () => {
    const long = "Read packages/framework/package.json and tell me the package's name and how it builds"
    render(<GitStatusBar label={long} projectName="gemstack" checkout={null} />)
    // No layout in the test DOM, so the rule is read off the classes: the project keeps its width
    // up to a cap (it used to give up width first, and vanished beside a long name).
    const crumb = screen.getByTestId('project-crumb')
    expect(crumb.className).toContain('shrink-0')
    expect(crumb.className).toContain('max-w-32')
    expect(screen.getByText('gemstack').className).toContain('truncate')
    expect(screen.getByTitle(long).className).toContain('truncate')
  })

  test('the project and a command-named session are separated by ›, never a doubled slash', () => {
    render(<GitStatusBar label="/update-tickets" projectName="gemstack" checkout={null} />)
    expect(screen.getByText('/update-tickets')).toBeTruthy()
    expect(screen.getByTestId('project-crumb').textContent).toBe('gemstack›')
  })

  test('the session name shows from the first frame; its size waits for ready', () => {
    const { container, rerender } = render(<GitStatusBar label="Fix the header" projectName="gemstack" checkout={SIZED} ready={false} />)
    expect(container.textContent).toBe('gemstack›Fix the header') // read, but the caller's facts are not in yet
    rerender(<GitStatusBar label="Fix the header" projectName="gemstack" checkout={SIZED} ready />)
    expect(screen.getByText('5 MB')).toBeTruthy()
  })

  test('the disclosure chevron is there before the facts are, so the name never moves when they land', () => {
    const { rerender } = render(<GitStatusBar label="Fix the header" checkout={null} onToggle={() => {}} ready={false} />)
    const chevron = screen.getByTestId('disclosure-chevron')
    // Before the name, as in the disclosure the facts come in.
    expect(chevron.compareDocumentPosition(screen.getByText('Fix the header')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Nothing to open yet: the name is not a button until the facts are in.
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<GitStatusBar label="Fix the header" checkout={null} onToggle={() => {}} ready />)
    expect(screen.getByRole('button', { name: /Fix the header/ }).getAttribute('aria-expanded')).toBe('false')
    cleanup()
    // Without a disclosure there is nothing to open, so no chevron either way.
    render(<GitStatusBar label="Fix the header" checkout={null} ready={false} />)
    expect(screen.queryByTestId('disclosure-chevron')).toBeNull()
  })

  test('the size is omitted while it cannot be read', () => {
    // A live session is being written to, so the server does not price it; the row must not
    // show a stray placeholder where the number would go.
    const { container } = render(<GitStatusBar label="Dark mode" checkout={{ checkout: { path: '/repo/wt', dirty: false }, branch: 'b' }} />)
    expect(container.textContent).toBe('Dark mode')
  })
})
