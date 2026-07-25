import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ActiveRun } from '@gemstack/the-framework'
import { WorkingNow } from './WorkingNow.js'

afterEach(cleanup)

const run = (over: Partial<ActiveRun> = {}): ActiveRun =>
  ({
    projectId: 'p1',
    projectName: 'my-app',
    runId: 'run-9',
    cwd: '/tmp/p1',
    status: 'running',
    intent: 'add a login page',
    ...over,
  }) as ActiveRun

describe('Working now', () => {
  test('a row opens the session it describes, not its project home', () => {
    const onSelectRun = vi.fn()
    render(<WorkingNow active={[run()]} onSelectRun={onSelectRun} />)
    fireEvent.click(screen.getByText('add a login page'))
    // The row carries the run id and used to drop it, landing on the launcher: an empty composer
    // with no sign of the session the row had just named.
    expect(onSelectRun).toHaveBeenCalledWith('p1', 'run-9')
  })

  test('each row opens its own session when a project has several in flight', () => {
    const onSelectRun = vi.fn()
    render(
      <WorkingNow
        active={[run({ runId: 'run-1', intent: 'first' }), run({ runId: 'run-2', intent: 'second' })]}
        onSelectRun={onSelectRun}
      />,
    )
    fireEvent.click(screen.getByText('second'))
    expect(onSelectRun).toHaveBeenCalledWith('p1', 'run-2')
  })

  test('nothing running says so and offers no rows', () => {
    render(<WorkingNow active={[]} onSelectRun={vi.fn()} />)
    expect(screen.getByText('Nothing running.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
