import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ActiveRun, RecentRun, RunMeta } from '@gemstack/the-framework'
import { Agents } from './Agents.js'

// The Overview's Agents card (#1139), which replaced Working now. Everything it renders arrives as
// props, so there is no telefunc in its import graph and no mock to set up.
//
// What these pin is the click: #1189 made an Overview row open the session it names instead of
// dropping the reader on the project launcher, and the tests that held that line went with
// WorkingNow.tsx when #1190 deleted it.

afterEach(cleanup)

const active = (runId: string, over: Partial<ActiveRun> = {}): ActiveRun => ({
  projectId: 'p1',
  projectName: 'gemstack',
  runId,
  cwd: `/repos/gemstack/.the-framework/worktrees/${runId}`,
  status: 'running',
  updatedAt: '2026-07-25T10:00:00.000Z',
  intent: `working on ${runId}`,
  ...over,
})

const meta = (id: string): RunMeta => ({
  version: 1,
  status: 'done',
  id,
  startedAt: '2026-07-25T09:00:00.000Z',
  updatedAt: '2026-07-25T09:30:00.000Z',
  passes: 0,
  intent: `did ${id}`,
})

const recent = (id: string): RecentRun => ({ projectId: 'p2', projectName: 'vike', run: meta(id) })

describe('Agents (#1139)', () => {
  test('splits sessions into Current and Recent', () => {
    render(<Agents working={[active('r1')]} finished={[recent('r2')]} loading={false} onSelectRun={vi.fn()} />)
    expect(screen.getByText('Current')).toBeTruthy()
    expect(screen.getByText('Recent')).toBeTruthy()
    expect(screen.getByText('working on r1')).toBeTruthy()
  })

  test('clicking a working agent opens that session', () => {
    const onSelectRun = vi.fn()
    render(<Agents working={[active('r1')]} finished={[]} loading={false} onSelectRun={onSelectRun} />)
    fireEvent.click(screen.getByText('working on r1'))
    // Project *and* run: a project alone would land on the launcher, which is the #1189 regression.
    expect(onSelectRun).toHaveBeenCalledWith('p1', 'r1')
  })

  test('clicking a finished session opens it too', () => {
    const onSelectRun = vi.fn()
    render(<Agents working={[]} finished={[recent('r2')]} loading={false} onSelectRun={onSelectRun} />)
    fireEvent.click(screen.getByText('did r2'))
    // A finished run's row is the only way back into its transcript from the Overview.
    expect(onSelectRun).toHaveBeenCalledWith('p2', 'r2')
  })

  test('each column says so when it is empty, rather than the card vanishing', () => {
    render(<Agents working={[]} finished={[]} loading={false} onSelectRun={vi.fn()} />)
    expect(screen.getByText('No agents working right now.')).toBeTruthy()
    expect(screen.getByText('No sessions yet.')).toBeTruthy()
  })

  test('loading is not the same as empty', () => {
    // The card polls, so "nothing yet" before the first read would read as "no agents ran".
    render(<Agents working={[]} finished={[]} loading onSelectRun={vi.fn()} />)
    expect(screen.queryByText('No agents working right now.')).toBeNull()
    expect(screen.getAllByText('Loading…').length).toBe(2)
  })

  test('a working session with no intent still gets a label', () => {
    // ActiveRun carries no branch or start time to fall back on, so an unlabelled row would be a
    // blank line you cannot tell apart from its neighbours.
    render(
      <Agents
        working={[active('r1', { intent: '   ', sessionName: 'oauth-work' })]}
        finished={[]}
        loading={false}
        onSelectRun={vi.fn()}
      />,
    )
    expect(screen.getByText('oauth-work')).toBeTruthy()
  })
})
