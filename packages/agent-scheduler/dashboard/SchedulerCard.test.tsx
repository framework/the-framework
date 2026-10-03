import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ModuleHostContext, type ModuleHost, type ModuleProject } from 'framework/module'
import { SchedulerCard } from './SchedulerCard.js'
import { STATUS, hostAnswering } from './fixtures.js'

const GEMSTACK = { id: 'p1', name: 'gemstack', gitHost: true }
const OTHER = { id: 'p2', name: 'other', gitHost: false }

function show(host: ModuleHost, projects: ModuleProject[] = [GEMSTACK, OTHER]) {
  return render(
    <ModuleHostContext.Provider value={host}>
      <SchedulerCard projects={projects} />
    </ModuleHostContext.Provider>,
  )
}

afterEach(cleanup)

describe('the Scheduler card', () => {
  test('no project with the package, no card', () => {
    const { host } = hostAnswering(() => ({ ok: true, output: STATUS }))
    expect(show(host, []).container.textContent).toBe('')
  })

  test("one row per project: its status, its model, the last tick's decisions; a decision that started a run opens that agent", async () => {
    const { host } = hostAnswering(projectId => ({ ok: true, output: projectId === 'p1' ? STATUS : { ok: true, on: false, keepAlive: true, running: false, model: 'opus', spendOffset: 7 } }))
    show(host)
    const started = await screen.findByRole('button', { name: 'work-queue: started' })
    expect(screen.getByText('post-merge-cleanup: not due').tagName).toBe('SPAN')
    expect(screen.getByText('on').className).toMatch(/text-success/)
    expect(screen.getByText('off')).toBeTruthy()
    expect(screen.getByText('keep-alive')).toBeTruthy()
    expect(screen.getAllByText('opus')).toHaveLength(2)
    started.click()
    expect(host.openAgent).toHaveBeenCalledWith('p1', '2026-10-03T10-00-00-000Z')
  })

  test('a tick that decided nothing says why; a scheduler whose process is gone is on, not running', async () => {
    const { host } = hostAnswering(() => ({ ok: true, output: { ...STATUS, running: false, lastTick: { at: STATUS.lastTick.at, decisions: [], note: 'no agent-schedule.md' } } }))
    show(host, [GEMSTACK])
    expect((await screen.findByText('on, not running')).className).toMatch(/text-warning/)
    expect(screen.getByText(/: no agent-schedule\.md/)).toBeTruthy()
  })

  test('a project whose status cannot be read says why', async () => {
    const { host } = hostAnswering(() => ({ ok: false, error: 'not inside a git repository' }))
    show(host, [GEMSTACK])
    expect(await screen.findByText('not readable')).toBeTruthy()
    expect(screen.getByText('not inside a git repository')).toBeTruthy()
  })
})
