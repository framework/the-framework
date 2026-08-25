import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Preferences, ProjectQueue } from '../../src/index.js'
import { configureFirst, hoverTooltip, openMenu } from '../test-utils.js'

// The card reads nothing of its own — the queue arrives as a prop — so the only mocks are the
// start path and the preferences it folds into a start's options.
let prefs: Preferences = {}
vi.mock('../lib/preferences.js', () => ({ usePreferences: () => prefs }))

const start = vi.hoisted(() => vi.fn())
let busy = false
let startError: string | null = null
vi.mock('../lib/use-start-agent.js', () => ({
  useStartAgent: () => ({ busy, error: startError, reset: () => {}, start }),
}))

const { AiQueue, workOnEntryPrompt, fanOutLabel, DEFAULT_FAN_OUT_COUNT } = await import('./AiQueue.js')
const { takePendingDraft } = await import('../lib/draft-handoff.js')

const RUN_LABEL = 'Spin up an agent working on this entry'
const COUNT_LABEL = 'How many agents to spin up'

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
  start.mockResolvedValue({ ok: true, agentId: 'run-1' })
  takePendingDraft() // a draft left by the previous test would look like this one's
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
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
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
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
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
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
      />,
    )
    const label = screen.getByText('Apply the maintainability preset')
    expect(label.tagName).toBe('SPAN')
    // The row's play button and the header's fan-out button, each with its own "Configure first"
    // chevron beside it (#1507) — the title itself is still not a button.
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  test('the play button starts an unattended run on that one entry and selects it (#1191)', async () => {
    const started: unknown[][] = []
    const entry = '[Improve tooltip](tickets/2026-07-25_improve-tooltip.md) — agent note'
    render(
      <AiQueue
        queue={[queue([{ text: 'first entry' }, { text: entry }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={(...args) => started.push(args)}
        onSelectProject={() => {}}
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
      <AiQueue queue={[queue([{ text: 'entry' }])]} loading={false} onOpenTicket={() => {}} onAgentStarted={() => {}} onSelectProject={() => {}} />,
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
        onAgentStarted={(...args) => started.push(args)}
        onSelectProject={() => {}}
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
        onAgentStarted={(...args) => started.push(args)}
        onSelectProject={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: RUN_LABEL }))
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(started).toHaveLength(0)
    expect(screen.getByRole('alert').textContent).toMatch(/already active/)
  })

  test('a start already in flight disables every play button, the fan-out included', () => {
    busy = true
    render(
      <AiQueue
        queue={[queue([{ text: 'one' }, { text: 'two' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
      />,
    )
    // Every button here that starts agents sits out an in-flight start.
    for (const name of [RUN_LABEL, fanOutLabel(2)]) {
      for (const button of screen.getAllByRole('button', { name })) {
        expect((button as HTMLButtonElement).disabled).toBe(true)
      }
    }
    // The chevrons are the exception, and deliberately (#1507): they start nothing, so being
    // unable to go and look at the settings because a start is in flight would be the point lost.
    for (const button of screen.getAllByRole('button', { name: /^Other ways/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(false)
    }
  })

  test('the fan-out button starts one unattended agent per top open entry, three by default', async () => {
    const started: unknown[][] = []
    // A done entry sits second, so "the top three" is provably the top three OPEN entries.
    render(
      <AiQueue
        queue={[queue([{ text: 'one' }, { text: 'skipped', done: true }, { text: 'two' }, { text: 'three' }, { text: 'four' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={(...args) => started.push(args)}
        onSelectProject={() => {}}
      />,
    )
    expect(DEFAULT_FAN_OUT_COUNT).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: fanOutLabel(3) }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(3))
    // Each agent is pinned to its own entry, in queue order — the raw lines, since each agent must
    // find exactly its entry to check it off.
    expect(start.mock.calls.map(call => call[1])).toEqual([
      workOnEntryPrompt('one'),
      workOnEntryPrompt('two'),
      workOnEntryPrompt('three'),
    ])
    for (const call of start.mock.calls) {
      expect(call[0]).toBe('p1')
      expect(call[2]).toBe('prompt')
      // Unattended (#1279), exactly like the single play button: the batch is drain work.
      expect(call[3]).toMatchObject({ unattended: true })
    }
    // No navigation: a batch is a fan-out, and fan-outs land in the Agents card.
    expect(started).toHaveLength(0)
  })

  test('the count beside the button sets how many agents the click starts', async () => {
    render(
      <AiQueue
        queue={[queue([{ text: 'one' }, { text: 'two' }, { text: 'three' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
      />,
    )
    fireEvent.change(screen.getByRole('spinbutton', { name: COUNT_LABEL }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: fanOutLabel(2) }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
    expect(start.mock.calls.map(call => call[1])).toEqual([workOnEntryPrompt('one'), workOnEntryPrompt('two')])
  })

  test('the button promises only what is open: a two-entry queue caps the default three', async () => {
    render(
      <AiQueue
        queue={[queue([{ text: 'one' }, { text: 'two' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
      />,
    )
    // The label says two, not the count box's three — and a single-entry queue reads singular.
    fireEvent.click(screen.getByRole('button', { name: fanOutLabel(2) }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
  })

  test('a single open entry makes the fan-out read singular', () => {
    render(
      <AiQueue queue={[queue([{ text: 'only' }])]} loading={false} onOpenTicket={() => {}} onAgentStarted={() => {}} onSelectProject={() => {}} />,
    )
    expect(fanOutLabel(1)).toBe('Spin up an agent working on the top entry')
    expect(screen.getByRole('button', { name: fanOutLabel(1) })).toBeTruthy()
  })

  test('the batch ends at the first refusal', async () => {
    start.mockReset()
    start.mockResolvedValueOnce({ ok: true, agentId: 'run-1' }).mockResolvedValueOnce(undefined)
    render(
      <AiQueue
        queue={[queue([{ text: 'one' }, { text: 'two' }, { text: 'three' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: fanOutLabel(3) }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
    // Whatever refused the second start is not going to take the third a moment later.
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(start).toHaveBeenCalledTimes(2)
  })

  test('a fan-out in flight disables every start button until the batch ends', async () => {
    const releases: Array<(value: unknown) => void> = []
    start.mockReset()
    start.mockImplementation(() => new Promise(resolve => releases.push(resolve)))
    render(
      <AiQueue
        queue={[queue([{ text: 'one' }, { text: 'two' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: fanOutLabel(2) }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    // Mid-batch — `busy` is false between two starts, so this pins the batch's own guard. The
    // chevrons are excluded on purpose (#1507): they start nothing, so a batch never shuts them.
    const starters = () =>
      screen.getAllByRole('button').filter(b => !(b.getAttribute('aria-label') ?? '').startsWith('Other ways'))
    for (const button of starters()) {
      expect((button as HTMLButtonElement).disabled).toBe(true)
    }
    releases[0]!({ ok: true, agentId: 'run-1' })
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
    releases[1]!({ ok: true, agentId: 'run-2' })
    await waitFor(() => {
      for (const button of starters()) {
        expect((button as HTMLButtonElement).disabled).toBe(false)
      }
    })
  })

  // #1507: both starts on this card spend an agent on a model and a run target that live in the
  // Global options, a page away — so each carries the chevron that opens the launcher instead.
  test("an entry's Configure first opens its own project's launcher with its prompt", async () => {
    const selected: string[] = []
    const entry = '[Improve tooltip](tickets/2026-07-25_improve-tooltip.md) — agent note'
    render(
      <AiQueue
        queue={[queue([{ text: 'first entry' }, { text: entry }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={() => {}}
        onSelectProject={id => selected.push(id)}
      />,
    )
    await configureFirst('Other ways to run Improve tooltip')
    await waitFor(() => expect(selected).toEqual(['p1']))
    // The launcher, not an agent — that is the whole reason this half exists.
    expect(start).not.toHaveBeenCalled()
    // The clicked entry's own prompt, raw line and all, not the first entry's.
    expect(takePendingDraft()).toBe(workOnEntryPrompt(entry))
  })

  test("the fan-out's Configure first sends the top entry alone, and says so", async () => {
    const selected: string[] = []
    render(
      <AiQueue
        queue={[queue([{ text: 'one' }, { text: 'two' }, { text: 'three' }])]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={() => {}}
        onSelectProject={id => selected.push(id)}
      />,
    )
    await openMenu(screen.getByRole('button', { name: "Other ways to spin up agents on gemstack's queue" }))
    // A launcher can only ever send one agent, so this half really is a different act from the
    // batch beside it — and it says so rather than looking like the same one.
    expect(await screen.findByText(/one agent, not the batch/)).toBeTruthy()
    fireEvent.click(screen.getByText('Configure first, then run'))
    await waitFor(() => expect(selected).toEqual(['p1']))
    expect(start).not.toHaveBeenCalled()
    expect(takePendingDraft()).toBe(workOnEntryPrompt('one'))
  })

  test('a Configure first lands in the project whose row it belongs to, not the first', async () => {
    const selected: string[] = []
    render(
      <AiQueue
        queue={[
          queue([{ text: 'alpha entry' }]),
          queue([{ text: 'beta entry' }], { projectId: 'p2', projectName: 'other' }),
        ]}
        loading={false}
        onOpenTicket={() => {}}
        onAgentStarted={() => {}}
        onSelectProject={id => selected.push(id)}
      />,
    )
    await configureFirst('Other ways to run beta entry')
    await waitFor(() => expect(selected).toEqual(['p2']))
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
        onAgentStarted={() => {}}
        onSelectProject={() => {}}
      />,
    )
    expect(screen.getByText('open entry')).toBeTruthy()
    expect(screen.queryByText('finished entry')).toBeNull()
    expect(screen.queryByText('rudder')).toBeNull()
  })

  test('loading and empty read as themselves', () => {
    const { rerender } = render(
      <AiQueue queue={[]} loading={true} onOpenTicket={() => {}} onAgentStarted={() => {}} onSelectProject={() => {}} />,
    )
    expect(screen.getByText('Loading…')).toBeTruthy()
    rerender(<AiQueue queue={[]} loading={false} onOpenTicket={() => {}} onAgentStarted={() => {}} onSelectProject={() => {}} />)
    expect(screen.getByText('Nothing queued.')).toBeTruthy()
  })
})
