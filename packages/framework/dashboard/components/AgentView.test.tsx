import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { FrameworkEvent } from '../../src/index.js'
import { ModulesContext, type MountedModules } from '../lib/use-modules.js'
import type { ModuleRunProps } from '../module/index.js'

const onAgent = vi.fn(async () => [] as unknown)
const onRetainedWorktrees = vi.fn(async () => [] as unknown)
const onAgentHandoff = vi.fn(async () => null as unknown)
const onBridgeQuestion = vi.fn(async () => null as unknown)
const onBridgeEvents = vi.fn(async () => [] as unknown)
const onBridgeAnswer = vi.fn(async () => null as unknown)
vi.mock('../rpc/reads.js', () => ({ onAgent, onRetainedWorktrees, onAgentHandoff, onBridgeQuestion, onBridgeEvents, onBridgeAnswer }))
vi.mock('../rpc/control.js', () => ({
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
vi.mock('./AgentComposer.js', () => ({ AgentComposer: () => null }))

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

/** A branch on the remote with a commit of its own and no pull request: what Open PR is offered for. */
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
    // The checkout is cleaned up while saving, and an empty branch is deleted with it: an Open PR
    // offered in that window turned into "Branch gone" moments later.
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValue({ ...PUSHED, empty: true, pushed: false })
    const { rerender } = render(view({ card: { status: 'done', saving: true } }))
    await waitFor(() => expect(onAgentHandoff).toHaveBeenCalledWith('p1', 'run-1'))
    expect(screen.queryByRole('button', { name: /Open PR/ })).toBeNull()
    const reads = onAgentHandoff.mock.calls.length
    onAgentHandoff.mockResolvedValue(PUSHED)
    rerender(view({ card: { status: 'done' } }))
    await waitFor(() => expect(onAgentHandoff.mock.calls.length).toBeGreaterThan(reads))
    await waitFor(() => expect(screen.getByRole('button', { name: /Open PR/ })).toBeTruthy())
  })

  test('a branch already pushed with commits is offered while the card still says saving: the clean-up keeps it', async () => {
    onAgent.mockResolvedValue(ARCHIVED)
    onAgentHandoff.mockResolvedValue(PUSHED)
    render(view({ card: { status: 'done', saving: true } }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Open PR/ })).toBeTruthy())
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
    const modules: MountedModules = { pages: [], cards: [], linkActions: [], panels: [], runSlots: [{ summary: Summary, details: Details, package: '@gemstack/files', projects }], loaded: true }
    return <ModulesContext.Provider value={modules}>{ui}</ModulesContext.Provider>
  }

  test('a working run shows the modules’ summary in its bar and their details under it', async () => {
    render(withSlots(view({ live: true })))
    expect(screen.getByText('summary run-1 true false')).toBeTruthy()
    expect(screen.getByText('details run-1 true')).toBeTruthy()
  })

  test('once an ended run’s branch is read, the handoff replaces the summary; the details stay, told the run is not working', async () => {
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

  test('no spinner while the answer is being written, and none once the run has ended', () => {
    const events = [{ kind: 'driver', event: { type: 'start', prompt: 'Say hi' } }] as FrameworkEvent[]
    const { rerender } = render(view({ live: true, events, writing: 'Hi th' }))
    expect(screen.queryByRole('status')).toBeNull()
    rerender(view({ live: false, events: [...events, { kind: 'end', ok: true }] as FrameworkEvent[] }))
    expect(screen.queryByText(/Starting…|Working…/)).toBeNull()
  })
})
