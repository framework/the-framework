import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AgentView } from '../lib/live-state.js'

// The rail reads its content panels itself now (#1146), so it can tell an empty one from a full
// one. Stub the reads: the default project has docs and a log, so every tab is earned and the
// tests below are about what the rail does with them. Tickets moved to its own page (#1144) and
// is no longer one of the rail's reads.
const onDocs = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onDocs }))

// The panels themselves are rendered elsewhere; here they are stand-ins.
vi.mock('./DocsPanel.js', () => ({ DocsPanel: () => <div>docs</div> }))
vi.mock('./FileTree.js', () => ({ FileTree: () => <div>files</div> }))
vi.mock('./BrowserPanel.js', () => ({ BrowserPanel: () => <div>browser</div> }))

const { RightRail } = await import('./RightRail.js')

beforeEach(() => {
  onDocs.mockReset().mockResolvedValue([{ name: 'PLAN.md', content: '# plan' }])
})

afterEach(cleanup)

const view: AgentView = { id: 'v1', title: 'Plan', markdown: '# hello' } as AgentView

const baseProps = {
  projectId: 'p1',
  agentId: 'r1',
  views: [],
  files: [],
  context: new Set<string>(),
  toggleContext: () => {},
}

// The rail holds one fixed width for every tab: switching to a pushed view no longer widens it
// (the per-tab wide mode from #862 was dropped so the tabs read as one stable column).
describe('RightRail width', () => {
  const rail = (container: HTMLElement) => container.querySelector('aside')!

  test('a list-shaped tab holds the fixed width', () => {
    const { container } = render(<RightRail {...baseProps} />)
    expect(rail(container).className).toContain('w-[22rem]')
  })

  test('a pushed view keeps the same width — no expand', () => {
    const { container } = render(<RightRail {...baseProps} views={[view]} />)
    // The first view pulls the rail to the Views tab on its own, but the width does not change.
    expect(rail(container).className).toContain('w-[22rem]')
  })

  test('the width is unchanged after switching away from a view', () => {
    const { container } = render(<RightRail {...baseProps} views={[view]} />)
    fireEvent.click(screen.getByRole('tab', { name: /docs/i }))
    expect(rail(container).className).toContain('w-[22rem]')
  })

  test('no project means no rail', () => {
    const { container } = render(<RightRail {...baseProps} projectId={null} />)
    expect(container.querySelector('aside')).toBeNull()
  })
})

// A GitHub Actions run has no browser on the runner (#1053), so the pane must not be offered even
// when the browser flag is on; a local run keeps it.
describe('RightRail browser tab (#1053)', () => {
  test('a local run with a browser offers the Browser tab', () => {
    render(<RightRail {...baseProps} hasBrowser />)
    expect(screen.getByRole('tab', { name: /browser/i })).toBeTruthy()
  })

  test('an Actions run never offers the Browser tab, even with the flag on', () => {
    render(<RightRail {...baseProps} hasBrowser target="actions" />)
    expect(screen.queryByRole('tab', { name: /browser/i })).toBeNull()
  })
})

// The loop's verdict is pinned under the tabs rather than being one of them: it is a standing fact
// about the run, so it stays put while you move between panels.
describe('RightRail tab labels (#1145)', () => {
  test('a tab says what it holds when hovered', async () => {
    render(<RightRail {...baseProps} />)
    const tab = screen.getByRole('tab', { name: /docs/i })
    fireEvent.mouseEnter(tab)
    fireEvent.pointerEnter(tab, { pointerType: 'mouse' })
    await waitFor(() => expect(screen.getByRole('tooltip').textContent).toContain('PLAN/TODO'))
  })
})

// Every tab is earned by its content (#1146): a panel that can only say "nothing yet" costs a tab
// nobody wants, and when none of them has anything the rail itself is noise.
describe('RightRail docsInMain (#1455 items 2/3)', () => {
  const settle = () => act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  test('the launcher owning Docs withholds its tab and skips its read', async () => {
    render(<RightRail {...baseProps} files={['a.ts']} docsInMain />)
    await settle()
    expect(screen.queryByRole('tab', { name: /docs/i })).toBeNull()
    // Withheld means not even asked for: the main column polls it itself.
    expect(onDocs).not.toHaveBeenCalled()
    // The rest of the rail is untouched.
    expect(screen.getByRole('tab', { name: /files/i })).toBeTruthy()
  })

  test('with only Docs to offer, the launcher shows no rail at all', async () => {
    const { container } = render(<RightRail {...baseProps} docsInMain />)
    await settle()
    expect(container.querySelector('aside')).toBeNull()
  })

  test('a session view (docsInMain off) keeps the tab, as before', async () => {
    render(<RightRail {...baseProps} />)
    await settle()
    expect(screen.getByRole('tab', { name: /docs/i })).toBeTruthy()
  })
})

describe('RightRail empty panels (#1146)', () => {
  const settle = () => act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  test('no docs, no Docs tab — and with nothing else, no rail at all', async () => {
    onDocs.mockResolvedValue([])
    const { container } = render(<RightRail {...baseProps} />)
    await settle()
    expect(screen.queryByRole('tab', { name: /docs/i })).toBeNull()
    expect(container.querySelector('aside')).toBeNull()
  })

  test('a live surface keeps the rail even when every read comes back empty', async () => {
    onDocs.mockResolvedValue([])
    const { container } = render(<RightRail {...baseProps} views={[view]} />)
    await settle()
    expect(container.querySelector('aside')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /views/i })).toBeTruthy()
  })

  test('the tabs hold while the first read is still out, so switching projects does not blink', () => {
    onDocs.mockReturnValue(new Promise(() => {}))
    render(<RightRail {...baseProps} />)
    // Not yet known to be empty is not the same as known to be empty.
    expect(screen.getByRole('tab', { name: /docs/i })).toBeTruthy()
  })

  test('the open tab losing its content falls back to one that still has some', async () => {
    const { rerender } = render(<RightRail {...baseProps} views={[view]} />)
    await settle()
    // Picked by hand, so nothing auto-defaults away from it; then the run ends and the views
    // go with it, leaving the remembered tab pointing at something that is no longer there.
    fireEvent.click(screen.getByRole('tab', { name: /views/i }))
    expect(screen.getByRole('tab', { name: /views/i }).getAttribute('aria-selected')).toBe('true')
    rerender(<RightRail {...baseProps} views={[]} />)
    await settle()
    expect(screen.queryByRole('tab', { name: /views/i })).toBeNull()
    // Not an empty panel: the rail falls back to the first tab that still has content.
    expect(screen.getByRole('tab', { name: /docs/i }).getAttribute('aria-selected')).toBe('true')
  })
})
