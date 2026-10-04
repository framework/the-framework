import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { FrameworkEvent } from '../../src/index.js'
import { ModulesContext, type MountedModules } from '../lib/use-modules.js'
import type { ModuleRunProps } from '../module/index.js'

const onAgent = vi.fn(async () => [] as unknown)
const onRetainedWorktrees = vi.fn(async () => [] as unknown)
const onAgentHandoff = vi.fn(async () => null as unknown)
const onAgentsDoing = vi.fn(async () => ({}) as unknown)
const onBridgeQuestion = vi.fn(async () => null as unknown)
const onBridgeEvents = vi.fn(async () => [] as unknown)
const onBridgeAnswer = vi.fn(async () => null as unknown)
vi.mock('../rpc/reads.js', () => ({ onAgent, onRetainedWorktrees, onAgentHandoff, onAgentsDoing, onBridgeQuestion, onBridgeEvents, onBridgeAnswer }))
const sendMessage = vi.fn(async () => ({ ok: true }) as unknown)
vi.mock('../rpc/control.js', () => ({
  sendMessage,
  sendOpenPullRequest: vi.fn(async () => null),
  sendSetHandoff: vi.fn(async () => null),
  sendBridgeAnswer: vi.fn(async () => null),
  sendBridgeAnswerCancel: vi.fn(async () => null),
  sendStart: vi.fn(async () => null),
  sendChoice: vi.fn(async () => null),
}))
// The feed's inline choice rows (#1455 item 6) pull ChoicePanel — and with it the preferences
// module, whose RPC reads must not fetch a daemon that is not there.
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => ({}),
  updatePreferences: vi.fn(),
}))

// The frame around the feed is not under test: the bar and composer reach for git and session
// state of their own, and the swap decision this file cares about is visible in the feed alone.
// The bar's `actions` and `summary` slots ARE rendered, so the handoff cluster and the modules'
// summaries stay reachable.
vi.mock('./AgentActionBar.js', () => ({
  AgentActionBar: ({ actions, summary, ready }: { actions?: ReactNode; summary?: ReactNode; ready?: boolean }) => (
    <>
      <span data-testid="bar-ready">{String(ready)}</span>
      {summary}
      {actions}
    </>
  ),
}))
// The composer shows only what the view tells it about the run going: the one fact of it under test here.
vi.mock('./AgentComposer.js', () => ({ AgentComposer: ({ live }: { live: boolean }) => <span data-testid="composer-live">{String(live)}</span> }))

const { AgentView } = await import('./AgentView.js')

const LIVE_EVENTS = [{ kind: 'log', message: 'the channel delivered this line' }] as FrameworkEvent[]
const ARCHIVED = [{ kind: 'log', message: 'the archive delivered this line' }] as FrameworkEvent[]

const view = (over: Partial<Parameters<typeof AgentView>[0]> = {}) => (
  <AgentView projectId="p1" agentId="run-1" events={LIVE_EVENTS} live={false} files={[]} {...over} />
)

beforeEach(() => {
  vi.clearAllMocks()
  onRetainedWorktrees.mockResolvedValue([])
  onAgentHandoff.mockResolvedValue(null)
})
afterEach(cleanup)

describe('AgentView event source (#1026/#1383)', () => {
  test('a finished run swaps to its archived log once it has events', async () => {
    onAgent.mockResolvedValue(ARCHIVED)
    render(view())
    await waitFor(() => expect(onAgent).toHaveBeenCalledWith('p1', 'run-1'))
    await waitFor(() => expect(screen.getByText(/the archive delivered this line/)).toBeTruthy())
    expect(screen.queryByText(/the channel delivered this line/)).toBeNull()
  })

  test('an empty archive never replaces the events already on screen (#1383)', async () => {
    // `onAgent` answers `[]` for "not archived yet" as well as "gone", and a Stop races the archive
    // write: swapping a populated live feed for that `[]` blanked the view to "This session has
    // no events." until a manual refresh.
    onAgent.mockResolvedValue([])
    render(view())
    await waitFor(() => expect(screen.getByText(/the channel delivered this line/)).toBeTruthy())
    expect(screen.queryByText('This agent has no events.')).toBeNull()
  })

  test('a finished run with nothing anywhere still says it has no events', async () => {
    onAgent.mockResolvedValue([])
    render(view({ events: [] }))
    await waitFor(() => expect(onAgent).toHaveBeenCalledWith('p1', 'run-1'))
    await waitFor(() => expect(screen.getByText('This agent has no events.')).toBeTruthy())
  })

  test('a stale archive never hides a resumed leg: the channel wins the moment it knows more (#1460)', async () => {
    // On Resume the new leg streams over the channel while `live` waits on the 2s runs poll.
    // Serving the frozen archive for that window rendered nothing of the continuation — or, when
    // the poll lost the race outright, nothing until a manual refresh.
    onAgent.mockResolvedValue(ARCHIVED)
    const resumed = [
      ...ARCHIVED,
      { kind: 'session', driver: 'claude-code', workspace: '/w' },
      { kind: 'log', message: 'the resumed leg streamed this line' },
    ] as FrameworkEvent[]
    render(view({ events: resumed }))
    await waitFor(() => expect(screen.getByText(/the resumed leg streamed this line/)).toBeTruthy())
  })

  test("a foreign journal's events never beat this run's archive, however long (#1460)", async () => {
    // The live channel is not guaranteed to be this agent's journal: an ended agent whose worktree is
    // gone resolves to the project ROOT journal server-side, which holds whatever root run wrote
    // it last. "The channel knows more" must not let that longer foreign feed replace the archive.
    onAgent.mockResolvedValue(ARCHIVED)
    const foreign = [
      { kind: 'log', message: 'a different run wrote this line' },
      { kind: 'session', driver: 'claude-code', workspace: '/w' },
      { kind: 'log', message: 'and its newest segment never ended' },
    ] as FrameworkEvent[]
    render(view({ events: foreign }))
    await waitFor(() => expect(screen.getByText(/the archive delivered this line/)).toBeTruthy())
    expect(screen.queryByText(/a different run wrote this line/)).toBeNull()
  })

  test('an archive that catches up takes back over, bringing the epilogue events with it (#1460)', async () => {
    // A line written as the run is recorded only ever lands in the archive — the worktree journal
    // dies with the teardown — so once the feed outgrows the copy on screen the archive is re-read,
    // and the re-read is how the PR line reaches the screen without a manual refresh.
    const ahead = [...ARCHIVED, { kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'end', ok: true }] as FrameworkEvent[]
    const full = [...ahead, { kind: 'pull-request', number: 7, url: 'https://x/pr/7' }] as FrameworkEvent[]
    onAgent.mockResolvedValueOnce(ARCHIVED).mockResolvedValue(full)
    render(view({ events: ahead }))
    await waitFor(() => expect(onAgent.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.getByText(/pull request: #7/)).toBeTruthy())
  })
})

describe('AgentView: a continued run reads as going', () => {
  test('once the feed showed the new turn, the run stays going while the archive catches up and the poll has not said so yet, and ends with the turn', async () => {
    const ended = [{ kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'log', message: 'first turn' }, { kind: 'end', ok: true }] as FrameworkEvent[]
    const going = [...ended, { kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'log', message: 'second turn' }] as FrameworkEvent[]
    // The archive as it was, then caught up with the channel: the same lines, no more.
    onAgent.mockResolvedValueOnce(ended).mockResolvedValue(going)
    const { rerender } = render(view({ events: ended }))
    await waitFor(() => expect(screen.getByText(/first turn/)).toBeTruthy())
    expect(screen.getByTestId('composer-live').textContent).toBe('false')

    rerender(view({ events: going }))
    await waitFor(() => expect(screen.getByTestId('composer-live').textContent).toBe('true'))
    // The archive is read again and now holds as much as the channel: still going, with the poll still saying ended.
    await waitFor(() => expect(onAgent.mock.calls.length).toBeGreaterThanOrEqual(2))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.getByTestId('composer-live').textContent).toBe('true')

    // The turn ends in the log: the run is over, whatever the poll says.
    const over = [...going, { kind: 'end', ok: true }] as FrameworkEvent[]
    onAgent.mockResolvedValue(over)
    rerender(view({ events: over }))
    await waitFor(() => expect(screen.getByTestId('composer-live').textContent).toBe('false'))
  })

  test('an ended run whose archive holds an open turn the feed never showed starting is not read as going', async () => {
    const open = [{ kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'log', message: 'cut short' }] as FrameworkEvent[]
    onAgent.mockResolvedValue(open)
    render(view({ events: open }))
    await waitFor(() => expect(screen.getByText(/cut short/)).toBeTruthy())
    expect(screen.getByTestId('composer-live').textContent).toBe('false')
  })
})

/** A branch with a commit of its own and no pull request: what Open PR is offered for. */
const PUSHED = {
  branch: 'agent-add-hello2',
  exists: true,
  empty: false,
  hasRemote: true,
  pushed: true,
  gitHost: true,
  commits: [{ sha: 'abc1234', subject: 'Add hello2.txt' }],
  files: [],
} as Record<string, unknown>

describe('AgentView branch read', () => {
  test('while the card says saving, an empty branch is not offered, and the branch is read again once it stops', async () => {
    // The checkout is cleaned up while saving, and an empty branch is deleted with it: a publish
    // offered in that window turned into "Branch gone" moments later.
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValue({ ...PUSHED, empty: true, pushed: false })
    const { rerender } = render(view({ card: { status: 'done', saving: true } }))
    await waitFor(() => expect(onAgentHandoff).toHaveBeenCalledWith('p1', 'run-1'))
    expect(screen.queryByRole('button', { name: 'Open PR' })).toBeNull()
    const reads = onAgentHandoff.mock.calls.length
    onAgentHandoff.mockResolvedValue(PUSHED)
    rerender(view({ card: { status: 'done' } }))
    await waitFor(() => expect(onAgentHandoff.mock.calls.length).toBeGreaterThan(reads))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open PR' })).toBeTruthy())
  })

  test('a branch with commits, pushed or not, is offered while the card still says saving: the clean-up keeps it', async () => {
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValue({ ...PUSHED, pushed: false })
    render(view({ card: { status: 'done', saving: true } }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open PR' })).toBeTruthy())
  })
})

describe('the next step of a run whose subagents still work', () => {
  const sub = (over: Record<string, unknown>) => ({ id: 'c1', parent: 'run-1', startedAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', status: 'done', ...over }) as never

  test('Open PR is not offered while a subagent works, and is once none does', async () => {
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValue(PUSHED)
    const { rerender } = render(view({ card: { status: 'done' }, subagents: [sub({ status: 'running' })] }))
    await waitFor(() => expect(onAgentHandoff).toHaveBeenCalledWith('p1', 'run-1'))
    await waitFor(() => expect(screen.getByTestId('bar-ready').textContent).toBe('true'))
    expect(screen.queryByRole('button', { name: 'Open PR' })).toBeNull()
    rerender(view({ card: { status: 'done' }, subagents: [sub({ status: 'done', endedAt: '2026-10-01T10:02:00.000Z' })] }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open PR' })).toBeTruthy())
  })

  test('nor right after a subagent ended: its main agent is about to go on', async () => {
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValue(PUSHED)
    render(view({ card: { status: 'done' }, subagents: [sub({ status: 'done', endedAt: new Date().toISOString() })] }))
    await waitFor(() => expect(screen.getByTestId('bar-ready').textContent).toBe('true'))
    expect(screen.queryByRole('button', { name: 'Open PR' })).toBeNull()
  })
})

describe('a subagent’s own page', () => {
  test('a run started for another run is offered no pull request: it says whether it is landed, and nothing of pushed', async () => {
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValue(PUSHED)
    const { rerender } = render(view({ card: { status: 'done', parent: 'run-0' } }))
    await waitFor(() => expect(screen.getByText('not landed')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Open PR' })).toBeNull()
    expect(screen.queryByText('· pushed')).toBeNull()
    // The same branch on a run nobody started for another is offered its pull request.
    rerender(view({ card: { status: 'done' } }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open PR' })).toBeTruthy())
    expect(screen.queryByText('not landed')).toBeNull()
  })
})

// The Resume offer (#1391) moved into the composer's submit slot (#1455): its when-offered rules
// are AgentComposer's now, tested there — AgentView only hands `outcome` down.

describe('the bar shows its facts together (run switch)', () => {
  test("an ended run's bar is ready once its log and its branch are read, not before", async () => {
    let log: (v: unknown) => void = () => {}
    let branch: (v: unknown) => void = () => {}
    onAgent.mockReturnValue(new Promise(resolve => (log = resolve)))
    onAgentHandoff.mockReturnValue(new Promise(resolve => (branch = resolve)))
    render(view())
    expect(screen.getByTestId('bar-ready').textContent).toBe('false')
    log(ARCHIVED)
    await waitFor(() => expect(screen.getByText(/the archive delivered this line/)).toBeTruthy())
    expect(screen.getByTestId('bar-ready').textContent).toBe('false')
    branch(null)
    await waitFor(() => expect(screen.getByTestId('bar-ready').textContent).toBe('true'))
  })

  test("the bar waits for the branch's pull request lookup too, so its facts land in one step", async () => {
    // The lookup's second answer is held until the bar has been seen waiting, so the quick re-ask
    // (0.3s) cannot land first.
    let lookup: (v: unknown) => void = () => {}
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValueOnce({ branch: 'b', exists: false, commits: [], files: [], prPending: true })
    onAgentHandoff.mockReturnValueOnce(new Promise(resolve => (lookup = resolve)))
    onAgentHandoff.mockResolvedValue({ branch: 'b', exists: false, commits: [], files: [] })
    render(view())
    await waitFor(() => expect(screen.getByText(/the archive delivered this line/)).toBeTruthy())
    await waitFor(() => expect(onAgentHandoff).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('bar-ready').textContent).toBe('false')
    lookup({ branch: 'b', exists: false, commits: [], files: [] })
    await waitFor(() => expect(screen.getByTestId('bar-ready').textContent).toBe('true'))
  })

  test('a read that never answers holds the bar back one second, no longer', async () => {
    onAgent.mockReturnValue(new Promise(() => {}))
    render(view())
    expect(screen.getByTestId('bar-ready').textContent).toBe('false')
    await waitFor(() => expect(screen.getByTestId('bar-ready').textContent).toBe('true'), { timeout: 3000 })
  })

  test('a running run is ready at once: its channel is its log', () => {
    render(view({ live: true }))
    expect(screen.getByTestId('bar-ready').textContent).toBe('true')
  })
})

describe('the feed fills in one step (first visit)', () => {
  test("an ended run's feed shows nothing until its archive answers, then the archive", async () => {
    // The channel of an ended run whose checkout is gone is the project root's: shown first, it
    // was a step of someone else's events before this run's own.
    let log: (v: unknown) => void = () => {}
    onAgent.mockReturnValue(new Promise(resolve => (log = resolve)))
    render(view({ events: [{ kind: 'log', message: 'a different run wrote this line' }] as FrameworkEvent[] }))
    expect(screen.queryByText(/a different run wrote this line/)).toBeNull()
    expect(screen.queryByText('Loading agent…')).toBeNull()
    log(ARCHIVED)
    await waitFor(() => expect(screen.getByText(/the archive delivered this line/)).toBeTruthy())
  })

  test('an agent not known to run yet says nothing and reads nothing', () => {
    render(view({ live: null, events: [] }))
    expect(screen.queryByText('Waiting for the session to start…')).toBeNull()
    expect(screen.queryByText('Loading agent…')).toBeNull()
    expect(screen.getByTestId('bar-ready').textContent).toBe('false')
    expect(onAgent).not.toHaveBeenCalled()
    expect(onAgentHandoff).not.toHaveBeenCalled()
  })

  test('an archive that never answers holds the feed back one second, no longer', async () => {
    onAgent.mockReturnValue(new Promise(() => {}))
    render(view({ events: [] }))
    expect(screen.queryByText('Loading agent…')).toBeNull()
    await waitFor(() => expect(screen.getByText('Loading agent…')).toBeTruthy(), { timeout: 3000 })
  })

  test('an agent that stops while watched keeps its events on screen while the archive is read', () => {
    onAgent.mockReturnValue(new Promise(() => {}))
    const { rerender } = render(view({ live: true }))
    expect(screen.getByText(/the channel delivered this line/)).toBeTruthy()
    rerender(view({ live: false }))
    expect(screen.getByText(/the channel delivered this line/)).toBeTruthy()
  })
})

describe('what the modules add to a run’s page (#817)', () => {
  const Summary = ({ agentId, working, expanded }: ModuleRunProps) => <span>summary {agentId} {String(working)} {String(expanded)}</span>
  const Details = ({ agentId, working }: ModuleRunProps) => <span>details {agentId} {String(working)}</span>
  const withSlots = (ui: ReactNode, projects = ['p1']) => {
    const modules: MountedModules = { pages: [], cards: [], linkActions: [], panels: [], runSlots: [{ summary: Summary, details: Details, package: '@gemstack/files', projects }], settings: [], loaded: true }
    return <ModulesContext.Provider value={modules}>{ui}</ModulesContext.Provider>
  }

  test('a working run shows the modules’ summary in its bar and their details under it', async () => {
    render(withSlots(view({ live: true })))
    expect(screen.getByText('summary run-1 true false')).toBeTruthy()
    expect(screen.getByText('details run-1 true')).toBeTruthy()
  })

  test('once an ended run’s branch is read, the handoff replaces the summary; the details stay, told the run is not working', async () => {
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValue({ branch: 'agent-x', exists: true, commits: [], files: [], insertions: 0, deletions: 0, pushed: false })
    render(withSlots(view({ live: false })))
    await waitFor(() => expect(screen.queryByText(/^summary/)).toBeNull())
    expect(screen.getByText('details run-1 false')).toBeTruthy()
  })

  test('a project without the module gets none of it', () => {
    render(withSlots(view({ live: true }), ['p2']))
    expect(screen.queryByText(/summary|details/)).toBeNull()
  })
})

// The question an agent stopped on is asked above the message box, not in the chat.
describe('a question the agent stopped on', () => {
  const asked = [
    { kind: 'driver', event: { type: 'start', prompt: 'Pick a database' } },
    { kind: 'driver', event: { type: 'text', text: 'Two would do.' } },
    { kind: 'choice', id: 'await-choices', title: 'Which database?', options: [{ id: 'pg', label: 'Postgres' }, { id: 'lite', label: 'SQLite' }], recommended: 'pg' },
    { kind: 'end', ok: false, waiting: true },
  ] as FrameworkEvent[]

  test('it is a panel above the message box, and the chat holds no question row', async () => {
    onAgent.mockResolvedValue(asked)
    render(view({ events: asked }))
    const panel = await screen.findByRole('region', { name: 'Which database?' })
    expect(panel.compareDocumentPosition(screen.getByTestId('composer-live')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByLabelText('Agent output').contains(panel)).toBe(false)
    expect(screen.getByLabelText('Agent output').textContent).not.toContain('Which database?')
  })

  test('an answer in one\'s own words shows in the chat at once, as the message it is', async () => {
    onAgent.mockResolvedValue(asked)
    render(view({ events: asked }))
    fireEvent.change(await screen.findByLabelText('Other'), { target: { value: 'MySQL' } })
    fireEvent.focus(screen.getByLabelText('Other'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('p1', 'MySQL', 'run-1'))
    await waitFor(() => expect(screen.getAllByLabelText('Your message').at(-1)!.textContent).toBe('MySQL'))
  })

  test('once the agent has gone on, the panel is gone', async () => {
    const on = [...asked, { kind: 'driver', event: { type: 'start', prompt: 'MySQL' } }] as FrameworkEvent[]
    onAgent.mockResolvedValue(on)
    render(view({ events: on, live: true }))
    await waitFor(() => expect(screen.getAllByLabelText('Your message')).toHaveLength(2))
    expect(screen.queryByRole('region', { name: 'Which database?' })).toBeNull()
  })
})

// A run just started writes its prompt line seconds later: the page shows it at once, and says it is starting.
describe('a run just started', () => {
  test('its prompt shows before any event, with "Starting…" under it, until its own prompt line arrives', () => {
    const { rerender } = render(view({ live: true, events: [], startedWith: 'Say hi' }))
    expect(screen.getByText('Say hi')).toBeTruthy()
    expect(screen.getByText('Starting…')).toBeTruthy()
    const started = [{ kind: 'driver', event: { type: 'start', prompt: 'Say hi' } }, { kind: 'driver', event: { type: 'thought', text: 'hm' } }] as FrameworkEvent[]
    rerender(view({ live: true, events: started, startedWith: 'Say hi' }))
    expect(screen.getAllByText('Say hi')).toHaveLength(1)
    expect(screen.getByText('Working…')).toBeTruthy()
  })

  test('the chat says what was set up for the agent, off its card, and says nothing of it before the card is listed', () => {
    const events = [{ kind: 'driver', event: { type: 'start', prompt: 'Say hi' } }] as FrameworkEvent[]
    const { rerender } = render(view({ live: true, events }))
    expect(screen.queryByText('Session set up')).toBeNull()
    rerender(view({ live: true, events, card: { status: 'running', workspace: '/repo/.branches/agent-1', branch: 'agent-1', driver: 'codex' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Session set up' }))
    expect(screen.getByText('/repo/.branches/agent-1')).toBeTruthy()
    expect(screen.getByText('agent-1')).toBeTruthy()
  })

  test('no spinner while the answer is being written, and none once the run has ended', () => {
    const events = [{ kind: 'driver', event: { type: 'start', prompt: 'Say hi' } }] as FrameworkEvent[]
    const { rerender } = render(view({ live: true, events, writing: 'Hi th' }))
    expect(screen.queryByRole('status')).toBeNull()
    rerender(view({ live: false, events: [...events, { kind: 'end', ok: true }] as FrameworkEvent[] }))
    expect(screen.queryByText(/Starting…|Working…/)).toBeNull()
  })
})

describe('AgentView: while the agent commits', () => {
  /** An ended run that left a file uncommitted: what the Commit button is offered for. */
  const LEFT = { ...PUSHED, empty: true, pushed: false, hasRemote: false, gitHost: false, commits: [], pendingFiles: ['index.html'] }
  const ended = [{ kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'driver', event: { type: 'start', prompt: 'Add a page' } }, { kind: 'end', ok: true }] as FrameworkEvent[]

  test('Commit pressed: the ask shows in the feed at once and "Committing…" takes the button\'s place; an ask that did not go through gives the button back', async () => {
    onAgent.mockResolvedValue(ended)
    onAgentHandoff.mockResolvedValue(LEFT)
    let answer: (sent: { ok: boolean; error?: string }) => void = () => {}
    sendMessage.mockReturnValue(new Promise(resolve => (answer = resolve)))
    render(view({ events: ended }))
    fireEvent.click(await screen.findByRole('button', { name: 'Commit' }))
    await waitFor(() => expect(screen.getByText('Committing…')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Commit|Asking/ })).toBeNull()
    expect(screen.getByText('Commit your work.')).toBeTruthy()
    expect(sendMessage).toHaveBeenCalledWith('p1', 'Commit your work.', 'run-1')

    answer({ ok: false, error: 'this project has no resume hook' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Commit' })).toBeTruthy())
    expect(screen.queryByText('Committing…')).toBeNull()
  })

  test('a working agent whose last prompt is the Commit ask says "Committing…", also with a publish sentence after it; any other prompt says nothing, and so does an agent that ended', async () => {
    onAgent.mockResolvedValue(ended)
    onAgentHandoff.mockResolvedValue(LEFT)
    const asked = (prompt: string) => [...ended, { kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'driver', event: { type: 'start', prompt } }] as FrameworkEvent[]
    const { rerender } = render(view({ events: asked('Commit your work.'), live: true }))
    await waitFor(() => expect(screen.getByText('Committing…')).toBeTruthy())
    rerender(view({ events: asked('Commit your work.\n\nWhen you finish, if you committed anything, push your branch and open no pull request.'), live: true }))
    expect(screen.getByText('Committing…')).toBeTruthy()
    rerender(view({ events: asked('Commit your work. Then add a footer.'), live: true }))
    expect(screen.queryByText('Committing…')).toBeNull()
    // Ended: the next step is back, whatever the last prompt was.
    const over = [...asked('Commit your work.'), { kind: 'end', ok: true }] as FrameworkEvent[]
    onAgent.mockResolvedValue(over)
    rerender(view({ events: over, live: false }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Commit' })).toBeTruthy())
    expect(screen.queryByText('Committing…')).toBeNull()
  })
  test('the agent ended and its checkout is being cleaned up: "Committing…" stays until the branch is read, then the next step takes its place', async () => {
    const asked = [...ended, { kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'driver', event: { type: 'start', prompt: 'Commit your work.' } }] as FrameworkEvent[]
    const over = [...asked, { kind: 'end', ok: true }] as FrameworkEvent[]
    onAgent.mockResolvedValue(ended)
    onAgentHandoff.mockResolvedValue(LEFT)
    // The answer read before the ask is remembered: it is not what the branch holds after it.
    const { rerender } = render(view({ events: ended }))
    await screen.findByRole('button', { name: 'Commit' })
    rerender(view({ events: asked, live: true }))
    expect(screen.getByText('Committing…')).toBeTruthy()
    let answer: (handoff: unknown) => void = () => {}
    onAgentHandoff.mockReturnValue(new Promise(resolve => (answer = resolve)) as never)
    onAgent.mockResolvedValue(over)
    rerender(view({ events: over, live: false, card: { status: 'done', saving: true } }))
    expect(screen.getByText('Committing…')).toBeTruthy()
    rerender(view({ events: over, live: false, card: { status: 'done' } }))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.getByText('Committing…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Commit' })).toBeNull()
    answer({ ...LEFT, empty: false, commits: [{ sha: 'abc1234', subject: 'Add a page' }], pendingFiles: [] })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Merge' })).toBeTruthy())
    expect(screen.queryByText('Committing…')).toBeNull()
  })
})

describe('AgentView: the next step while the agent works again', () => {
  const MERGED = { ...PUSHED, hasRemote: false, gitHost: false, pushed: false, landed: true }
  const ended = [{ kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'driver', event: { type: 'start', prompt: 'Add a page' } }, { kind: 'end', ok: true }] as FrameworkEvent[]

  test('a message sent to an ended agent takes the last step out of the bar at once, before the agents poll says it works', async () => {
    onAgent.mockResolvedValue(ended)
    onAgentHandoff.mockResolvedValue(MERGED)
    const { rerender } = render(view({ events: ended }))
    await waitFor(() => expect(screen.getByText('Merged into the main branch.')).toBeTruthy())
    // The feed shows the new turn; the poll still says ended.
    const again = [...ended, { kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'driver', event: { type: 'start', prompt: 'Add a footer' } }] as FrameworkEvent[]
    rerender(view({ events: again, live: false }))
    await waitFor(() => expect(screen.queryByText('Merged into the main branch.')).toBeNull())
    // It ends with a file left: the bar goes from empty to the new step, the old one never back.
    const over = [...again, { kind: 'end', ok: true }] as FrameworkEvent[]
    let answer: (handoff: unknown) => void = () => {}
    onAgentHandoff.mockReturnValue(new Promise(resolve => (answer = resolve)) as never)
    onAgent.mockResolvedValue(over)
    rerender(view({ events: over, live: false }))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.queryByText('Merged into the main branch.')).toBeNull()
    answer({ ...MERGED, landed: false, empty: true, commits: [], pendingFiles: ['index.html'] })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Commit' })).toBeTruthy())
  })
})
