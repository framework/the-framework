import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Preferences, ProjectQueue } from '@gemstack/the-framework'
import { hoverTooltip } from '../test-utils.js'

// The card reads nothing of its own — the queue arrives as a prop — so the only mocks are the
// start path and the preferences it folds into a start's options.
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({ usePreferences: () => prefs }))

const start = vi.hoisted(() => vi.fn())
let busy = false
let startError: string | null = null
vi.mock('../lib/use-start-run.js', () => ({
  useStartRun: () => ({ busy, error: startError, reset: () => {}, start }),
}))

const { AiQueue, workOnEntryPrompt } = await import('./AiQueue.js')

const RUN_LABEL = 'Spin up an agent working on this entry'

const queue = (items: { text: string; done?: boolean }[], over: Partial<ProjectQueue> = {}): ProjectQueue => {
  const full = items.map(i => ({ text: i.text, done: i.done ?? false }))
  return {
    projectId: 'p1',
    projectName: 'gemstack',
    open: full.filter(i => !i.done).length,
    total: full.length,
    items: full,
    ...over,
  }
}

beforeEach(() => {
  prefs = {}
  busy = false
  startError = null
  start.mockReset()
  start.mockResolvedValue({ ok: true, runId: 'run-1' })
})
afterEach(cleanup)

describe('AiQueue', () => {
  test('a queued ticket reads as its title and opens its ticket page (#1144)', async () => {
    const opened: unknown[][] = []
    const entry = '[Improve tooltip](tickets/2026-07-25_improve-tooltip.md) — agent note'
    render(
      <AiQueue
        queue={[queue([{ text: entry }])]}
        loading={false}
        onOpenTicket={(...args) => opened.push(args)}
        onRunStarted={() => {}}
      />,
    )
    const row = screen.getByRole('button', { name: 'Improve tooltip' })
    // The whole line stays on the row as its hint, agent note and all.
    expect(row.getAttribute('title')).toBe(entry)
    fireEvent.click(row)
    // The bare filename — the same slug the tickets route carries.
    expect(opened).toEqual([['p1', '2026-07-25_improve-tooltip.md']])
  })

  test('an entry linking out of the workspace is a real link in a new tab', () => {
    const url = 'https://github.com/gemstack-land/the-framework/issues/42'
    render(
      <AiQueue
        queue={[queue([{ text: `[Fix the publish job](${url})` }])]}
        loading={false}
        onOpenTicket={() => {}}
        onRunStarted={() => {}}
      />,
    )
    const link = screen.getByText('Fix the publish job') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.href).toBe(url)
    expect(link.target).toBe('_blank')
  })

  test('a plain entry stays plain text: nothing to open, so nothing pretends to', () => {
    render(
      <AiQueue
        queue={[queue([{ text: 'Apply the maintainability preset' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onRunStarted={() => {}}
      />,
    )
    const label = screen.getByText('Apply the maintainability preset')
    expect(label.tagName).toBe('SPAN')
    // The one button on the row is the play button, not the title.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  test('the play button starts an unattended run on that one entry and selects it (#1191)', async () => {
    const started: unknown[][] = []
    const entry = '[Improve tooltip](tickets/2026-07-25_improve-tooltip.md) — agent note'
    render(
      <AiQueue
        queue={[queue([{ text: 'first entry' }, { text: entry }])]}
        loading={false}
        onOpenTicket={() => {}}
        onRunStarted={(...args) => started.push(args)}
      />,
    )
    // The second row's button, so the prompt provably carries the clicked entry, not the first.
    fireEvent.click(screen.getAllByRole('button', { name: RUN_LABEL })[1]!)
    await waitFor(() => expect(start).toHaveBeenCalled())
    const [projectId, prompt, kind, options] = start.mock.calls[0]!
    expect(projectId).toBe('p1')
    // The raw line, not the pretty label: the agent must find exactly this entry to check it off.
    expect(prompt).toBe(workOnEntryPrompt(entry))
    expect(prompt).toContain(entry)
    expect(kind).toBe('prompt')
    // Unattended (#1279): card-started queue work runs the way the drain sweep runs it.
    expect(options).toMatchObject({ unattended: true })
    await waitFor(() => expect(started).toHaveLength(1))
    expect(started[0]).toEqual(['p1', workOnEntryPrompt(entry), 'run-1'])
  })

  test('the play button says what it does on hover', async () => {
    render(
      <AiQueue queue={[queue([{ text: 'entry' }])]} loading={false} onOpenTicket={() => {}} onRunStarted={() => {}} />,
    )
    const button = screen.getByRole('button', { name: RUN_LABEL })
    expect((await hoverTooltip(button)).textContent).toBe(RUN_LABEL)
  })

  test('a start that reports no run id still hands the project over, for the adopt fallback (#1191)', async () => {
    start.mockResolvedValue({ ok: true })
    const started: unknown[][] = []
    render(
      <AiQueue
        queue={[queue([{ text: 'entry' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onRunStarted={(...args) => started.push(args)}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: RUN_LABEL }))
    await waitFor(() => expect(started).toHaveLength(1))
    expect(started[0]).toEqual(['p1', workOnEntryPrompt('entry'), undefined])
  })

  test('a failed start neither navigates nor hides the refusal', async () => {
    start.mockResolvedValue(undefined)
    startError = 'A session is already active for this project.'
    const started: unknown[][] = []
    render(
      <AiQueue
        queue={[queue([{ text: 'entry' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onRunStarted={(...args) => started.push(args)}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: RUN_LABEL }))
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(started).toHaveLength(0)
    expect(screen.getByRole('alert').textContent).toMatch(/already active/)
  })

  test('a start already in flight disables every play button', () => {
    busy = true
    render(
      <AiQueue
        queue={[queue([{ text: 'one' }, { text: 'two' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onRunStarted={() => {}}
      />,
    )
    for (const button of screen.getAllByRole('button', { name: RUN_LABEL })) {
      expect((button as HTMLButtonElement).disabled).toBe(true)
    }
  })

  test('done entries and projects with nothing open are not shown', () => {
    render(
      <AiQueue
        queue={[
          queue([{ text: 'open entry' }, { text: 'finished entry', done: true }]),
          queue([{ text: 'all done', done: true }], { projectId: 'p2', projectName: 'rudder' }),
        ]}
        loading={false}
        onOpenTicket={() => {}}
        onRunStarted={() => {}}
      />,
    )
    expect(screen.getByText('open entry')).toBeTruthy()
    expect(screen.queryByText('finished entry')).toBeNull()
    expect(screen.queryByText('rudder')).toBeNull()
  })

  test('loading and empty read as themselves', () => {
    const { rerender } = render(
      <AiQueue queue={[]} loading={true} onOpenTicket={() => {}} onRunStarted={() => {}} />,
    )
    expect(screen.getByText('Loading…')).toBeTruthy()
    rerender(<AiQueue queue={[]} loading={false} onOpenTicket={() => {}} onRunStarted={() => {}} />)
    expect(screen.getByText('Nothing queued.')).toBeTruthy()
  })
})
