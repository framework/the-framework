import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AgentView } from '../lib/live-state.js'

// The rail reads the three content panels itself now (#1146), so it can tell an empty one from a
// full one. Stub the reads: the default project has docs, tickets and a log, so every tab is
// earned and the tests below are about what the rail does with them.
const onDocs = vi.hoisted(() => vi.fn())
const onTickets = vi.hoisted(() => vi.fn())
const onProjectLog = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onDocs, onTickets, onProjectLog }))

// The panels themselves are rendered elsewhere; here they are stand-ins.
vi.mock('./DocsPanel.js', () => ({ DocsPanel: () => <div>docs</div> }))
vi.mock('./ProjectLogPanel.js', () => ({ ProjectLogPanel: () => <div>log</div> }))
vi.mock('./FileTree.js', () => ({ FileTree: () => <div>files</div> }))
vi.mock('./BrowserPanel.js', () => ({ BrowserPanel: () => <div>browser</div> }))
vi.mock('./ChoicesRail.js', () => ({ ChoicesRail: () => <div>choices</div> }))
vi.mock('./TicketsPanel.js', () => ({ TicketsPanel: () => <div>tickets</div> }))

const { RightRail } = await import('./RightRail.js')

beforeEach(() => {
  onDocs.mockReset().mockResolvedValue([{ name: 'PLAN.md', content: '# plan' }])
  onTickets.mockReset().mockResolvedValue([{ file: 't.md', title: 'A ticket', summary: '', spiked: false, planned: false }])
  onProjectLog.mockReset().mockResolvedValue([{ kind: 'prompt', status: 'done', at: '2026-07-25T00:00:00.000Z', intent: 'x' }])
})

afterEach(cleanup)

const view: AgentView = { id: 'v1', title: 'Plan', markdown: '# hello' } as AgentView

const baseProps = {
  projectId: 'p1',
  runId: 'r1',
  choices: [],
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
    expect(rail(container).className).toContain('w-[27rem]')
  })

  test('a pushed view keeps the same width — no expand', () => {
    const { container } = render(<RightRail {...baseProps} views={[view]} />)
    // The first view pulls the rail to the Views tab on its own, but the width does not change.
    expect(rail(container).className).toContain('w-[27rem]')
  })

  test('the width is unchanged after switching away from a view', () => {
    const { container } = render(<RightRail {...baseProps} views={[view]} />)
    fireEvent.click(screen.getByRole('tab', { name: /docs/i }))
    expect(rail(container).className).toContain('w-[27rem]')
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
describe('RightRail loop status', () => {
  const loop = { pass: 2, passing: false, blockers: ['no tests'], productionGrade: false, finished: false }

  test('a run that never looped pins nothing', () => {
    render(<RightRail {...baseProps} loop={null} />)
    expect(screen.queryByText(/loop status/i)).toBeNull()
  })

  test('the verdict shows, and is not a tab', () => {
    render(<RightRail {...baseProps} loop={loop} />)
    expect(screen.getByText(/loop status/i)).toBeTruthy()
    expect(screen.getByText('no tests')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: /loop/i })).toBeNull()
  })

  test('it survives a tab switch, since it belongs to the run and not to a panel', () => {
    render(<RightRail {...baseProps} loop={loop} />)
    fireEvent.click(screen.getByRole('tab', { name: /log/i }))
    expect(screen.getByText('log')).toBeTruthy()
    expect(screen.getByText(/loop status/i)).toBeTruthy()
  })
})

// Every tab is earned by its content (#1146): a panel that can only say "nothing yet" costs a tab
// nobody wants, and when none of them has anything the rail itself is noise.
describe('RightRail empty panels (#1146)', () => {
  const settle = () => act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

  test('no docs, no Docs tab', async () => {
    onDocs.mockResolvedValue([])
    render(<RightRail {...baseProps} />)
    await settle()
    expect(screen.queryByRole('tab', { name: /docs/i })).toBeNull()
    // The panels that do have something are untouched.
    expect(screen.getByRole('tab', { name: /tickets/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /log/i })).toBeTruthy()
  })

  test('nothing anywhere means no rail at all', async () => {
    onDocs.mockResolvedValue([])
    onTickets.mockResolvedValue([])
    onProjectLog.mockResolvedValue([])
    const { container } = render(<RightRail {...baseProps} />)
    await settle()
    expect(container.querySelector('aside')).toBeNull()
  })

  test('a live surface keeps the rail even when every read comes back empty', async () => {
    onDocs.mockResolvedValue([])
    onTickets.mockResolvedValue([])
    onProjectLog.mockResolvedValue([])
    const { container } = render(<RightRail {...baseProps} views={[view]} />)
    await settle()
    expect(container.querySelector('aside')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /views/i })).toBeTruthy()
  })

  test('the tabs hold while the first read is still out, so switching projects does not blink', () => {
    onDocs.mockReturnValue(new Promise(() => {}))
    onTickets.mockReturnValue(new Promise(() => {}))
    onProjectLog.mockReturnValue(new Promise(() => {}))
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
    expect(screen.getByRole('tab', { name: /tickets/i }).getAttribute('aria-selected')).toBe('true')
  })
})
