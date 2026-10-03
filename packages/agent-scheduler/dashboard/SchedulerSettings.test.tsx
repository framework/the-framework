import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ModuleHostContext, type ModuleCommandResult, type ModuleHost, type ModuleProject } from 'framework/module'
import { SchedulerSettings } from './SchedulerSettings.js'
import { STATUS, hostAnswering } from './fixtures.js'

const GEMSTACK = { id: 'p1', name: 'gemstack', gitHost: true }
const OTHER = { id: 'p2', name: 'other', gitHost: false }

function show(host: ModuleHost, projects: ModuleProject[] = [GEMSTACK]) {
  return render(
    <ModuleHostContext.Provider value={host}>
      <SchedulerSettings projects={projects} />
    </ModuleHostContext.Provider>,
  )
}

/** A host whose `status` answers {@link STATUS} and whose saves are answered by `saved`. */
function scheduler(saved: (projectId: string, args: string[]) => ModuleCommandResult = () => ({ ok: true, output: { ok: true } })) {
  return hostAnswering((projectId, args) => (args[0] === 'status' ? { ok: true, output: STATUS } : saved(projectId, args)))
}

const options = (menu: HTMLSelectElement): string[] => [...menu.options].map(o => o.textContent ?? '')

afterEach(cleanup)

describe('Settings → Scheduler', () => {
  test('no project with the package, no section', () => {
    const { host } = scheduler()
    const { container } = show(host, [])
    expect(container.textContent).toBe('')
  })

  test("one switch per scheduled command, showing this machine's switch; flipping one runs `switch` in its project", async () => {
    const { host, runCommand } = scheduler()
    show(host)
    const cleanup = (await screen.findByLabelText('Run /post-merge-cleanup on a schedule')) as HTMLElement
    const queue = screen.getByLabelText('Run /work-queue on a schedule') as HTMLElement
    // The line says off, this machine switched it on.
    expect(cleanup.getAttribute('aria-checked')).toBe('true')
    expect(queue.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/gemstack · every 1d · publishes nothing\./)).toBeTruthy()
    cleanup.click()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['switch', 'post-merge-cleanup', 'off']))
    queue.click()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['switch', 'work-queue', 'off']))
  })

  test("each command's publish menu shows this machine's pick, else what the file says; picking runs `publish`, and \"As the file says\" takes the pick back with `file`", async () => {
    const { host, runCommand } = scheduler()
    show(host)
    const queue = (await screen.findByLabelText('What /work-queue publishes')) as HTMLSelectElement
    const cleanup = screen.getByLabelText('What /post-merge-cleanup publishes') as HTMLSelectElement
    expect(options(queue)).toEqual(['As the file says (Merge on green)', 'Nothing', 'Publish branch', 'Open PR', 'Merge on green'])
    expect(queue.value).toBe('nothing')
    expect(options(cleanup)[0]).toBe('As the file says (Nothing)')
    expect(cleanup.value, 'nobody picked here: the file decides').toBe('')
    // The description says the level in force: this machine's pick over the line's.
    expect(screen.getByText(/gemstack · when its check finds work · publishes nothing\./)).toBeTruthy()

    fireEvent.change(cleanup, { target: { value: 'pr' } })
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['publish', 'post-merge-cleanup', 'pr']))
    fireEvent.change(queue, { target: { value: '' } })
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['publish', 'work-queue', 'file']))
  })

  test('a project with no git host package is offered Nothing and Publish branch only, beside what the file says', async () => {
    const { host } = scheduler()
    show(host, [OTHER])
    const cleanup = (await screen.findByLabelText('What /post-merge-cleanup publishes')) as HTMLSelectElement
    expect(options(cleanup)).toEqual(['As the file says (Nothing)', 'Nothing', 'Publish branch'])
  })

  test('a save the command refused says which and why', async () => {
    const { host } = scheduler(() => ({ ok: false, error: 'agent-schedule.md has no line for work-queue' }))
    show(host)
    ;((await screen.findByLabelText('Run /work-queue on a schedule')) as HTMLElement).click()
    expect((await screen.findByRole('alert')).textContent).toBe('The switch was not saved: /work-queue: agent-schedule.md has no line for work-queue')
  })

  test('the spend offset shows the loosest one, and a typed one is saved in every project once it rests, held to the reach of the bar', async () => {
    const { host, runCommand } = hostAnswering((projectId, args) => (args[0] === 'status' ? { ok: true, output: { ...STATUS, spendOffset: projectId === 'p1' ? 7.1428 : -3 } } : { ok: true, output: { ok: true } }))
    show(host, [GEMSTACK, OTHER])
    const offset = (await screen.findByLabelText('Spend offset')) as HTMLInputElement
    expect(offset.value).toBe('7.1')
    // A minus sign alone is no number yet: it stays in the field and saves nothing.
    fireEvent.change(offset, { target: { value: '-' } })
    fireEvent.change(offset, { target: { value: '-2' } })
    fireEvent.change(offset, { target: { value: '-200' } })
    fireEvent.blur(offset)
    expect(offset.value).toBe('-50')
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p2', ['offset', '--', '-50']))
    expect(runCommand).toHaveBeenCalledWith('p1', ['offset', '--', '-50'])
    // Typing is several changes: only the resting value is saved.
    expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'offset')).toHaveLength(2)
  })

  test('an offset the command refused says why, and the number shown is the saved one again', async () => {
    const { host } = scheduler(() => ({ ok: false, error: 'not inside a git repository' }))
    show(host)
    const offset = (await screen.findByLabelText('Spend offset')) as HTMLInputElement
    fireEvent.change(offset, { target: { value: '20' } })
    fireEvent.blur(offset)
    expect((await screen.findByRole('alert')).textContent).toBe('The spend offset was not saved: gemstack: not inside a git repository')
    expect(offset.value).toBe('7')
  })

  test('a project whose scheduler cannot be read says so', async () => {
    const { host } = hostAnswering(() => ({ ok: false, error: 'not inside a git repository' }))
    show(host)
    expect((await screen.findByRole('alert')).textContent).toBe('gemstack: the scheduler could not be read: not inside a git repository')
    expect(screen.queryByLabelText('Spend offset')).toBeNull()
  })
})
