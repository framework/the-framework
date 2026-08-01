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
})

// The Resume offer (#1391) moved into the composer's submit slot (#1455): its when-offered rules
// are RunComposer's now, tested there — RunView only hands `outcome` + `sessionId` down.
