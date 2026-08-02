import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { FrameworkEvent } from '@gemstack/the-framework'

const onRun = vi.fn(async () => [] as unknown)
const onRetainedWorktrees = vi.fn(async () => [] as unknown)
const onRunHandoff = vi.fn(async () => null as unknown)
const onRunChanges = vi.fn(async () => [] as unknown)
const onBridgeQuestion = vi.fn(async () => null as unknown)
const onBridgeEvents = vi.fn(async () => [] as unknown)
const onBridgeAnswer = vi.fn(async () => null as unknown)
vi.mock('../server/reads.telefunc.js', () => ({ onRun, onRetainedWorktrees, onRunHandoff, onRunChanges, onBridgeQuestion, onBridgeEvents, onBridgeAnswer }))
vi.mock('../server/control.telefunc.js', () => ({
  sendOpenPullRequest: vi.fn(async () => null),
  sendSetHandoff: vi.fn(async () => null),
  sendBridgeAnswer: vi.fn(async () => null),
  sendBridgeAnswerCancel: vi.fn(async () => null),
  sendStart: vi.fn(async () => null),
  sendChoice: vi.fn(async () => null),
}))
// The feed's inline choice rows (#1455 item 6) pull ChoicePanel — and with it the preferences
// module, whose telefunc reads must not load into jsdom.
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => ({}),
  updatePreferences: vi.fn(),
  autopilotEnabled: () => false,
}))

// The frame around the feed is not under test: the bar and composer reach for git and session
// state of their own, and the swap decision this file cares about is visible in the feed alone.
// The bar's `actions` slot IS rendered, so the handoff cluster stays reachable.
vi.mock('./RunActionBar.js', () => ({ RunActionBar: ({ actions }: { actions?: unknown }) => <>{actions}</> }))
vi.mock('./RunComposer.js', () => ({ RunComposer: () => null }))

const { RunView } = await import('./RunView.js')

const LIVE_EVENTS = [{ kind: 'log', message: 'the channel delivered this line' }] as FrameworkEvent[]
const ARCHIVED = [{ kind: 'log', message: 'the archive delivered this line' }] as FrameworkEvent[]

const view = (over: Partial<Parameters<typeof RunView>[0]> = {}) => (
  <RunView projectId="p1" runId="run-1" events={LIVE_EVENTS} live={false} files={[]} addContext={() => {}} {...over} />
)

beforeEach(() => {
  vi.clearAllMocks()
  onRetainedWorktrees.mockResolvedValue([])
  onRunHandoff.mockResolvedValue(null)
})
afterEach(cleanup)

describe('RunView event source (#1026/#1383)', () => {
  test('a finished run swaps to its archived log once it has events', async () => {
    onRun.mockResolvedValue(ARCHIVED)
    render(view())
    await waitFor(() => expect(onRun).toHaveBeenCalledWith('p1', 'run-1'))
    await waitFor(() => expect(screen.getByText(/the archive delivered this line/)).toBeTruthy())
    expect(screen.queryByText(/the channel delivered this line/)).toBeNull()
  })

  test('an empty archive never replaces the events already on screen (#1383)', async () => {
    // `onRun` answers `[]` for "not archived yet" as well as "gone", and a Stop races the archive
    // write: swapping a populated live feed for that `[]` blanked the view to "This session has
    // no events." until a manual refresh.
    onRun.mockResolvedValue([])
    render(view())
    await waitFor(() => expect(onRun).toHaveBeenCalledWith('p1', 'run-1'))
    expect(screen.getByText(/the channel delivered this line/)).toBeTruthy()
    expect(screen.queryByText('This session has no events.')).toBeNull()
  })

  test('a finished run with nothing anywhere still says it has no events', async () => {
    onRun.mockResolvedValue([])
    render(view({ events: [] }))
    await waitFor(() => expect(onRun).toHaveBeenCalledWith('p1', 'run-1'))
    await waitFor(() => expect(screen.getByText('This session has no events.')).toBeTruthy())
  })

  test('a stale archive never hides a resumed leg: the channel wins the moment it knows more (#1460)', async () => {
    // On Resume the new leg streams over the channel while `live` waits on the 2s runs poll.
    // Serving the frozen archive for that window rendered nothing of the continuation — or, when
    // the poll lost the race outright, nothing until a manual refresh.
    onRun.mockResolvedValue(ARCHIVED)
    const resumed = [
      ...ARCHIVED,
      { kind: 'session', driver: 'claude-code', workspace: '/w' },
      { kind: 'log', message: 'the resumed leg streamed this line' },
    ] as FrameworkEvent[]
    render(view({ events: resumed }))
    await waitFor(() => expect(screen.getByText(/the resumed leg streamed this line/)).toBeTruthy())
  })

  test("a foreign journal's events never beat this run's archive, however long (#1460)", async () => {
    // The live channel is not guaranteed to be this run's journal: an ended run whose worktree is
    // gone resolves to the project ROOT journal server-side, which holds whatever root run wrote
    // it last. "The channel knows more" must not let that longer foreign feed replace the archive.
    onRun.mockResolvedValue(ARCHIVED)
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
    // A clean run's `handoff` only ever lands in the archive — the worktree journal dies with the
    // teardown — so once the feed outgrows the copy on screen the archive is re-read, and the
    // re-read is how the PR line reaches the screen without a manual refresh.
    const ahead = [...ARCHIVED, { kind: 'session', driver: 'claude-code', workspace: '/w' }, { kind: 'end', ok: true }] as FrameworkEvent[]
    const full = [...ahead, { kind: 'handoff', outcome: 'done', pushed: true }] as FrameworkEvent[]
    onRun.mockResolvedValueOnce(ARCHIVED).mockResolvedValue(full)
    render(view({ events: ahead }))
    await waitFor(() => expect(onRun.mock.calls.length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(screen.getByText(/branch pushed/)).toBeTruthy())
  })
})

// The Resume offer (#1391) moved into the composer's submit slot (#1455): its when-offered rules
// are RunComposer's now, tested there — RunView only hands `outcome` + `sessionId` down.
