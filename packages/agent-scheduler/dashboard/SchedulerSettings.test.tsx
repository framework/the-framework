import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    expect(screen.getByText('every 1d · publishes nothing')).toBeTruthy()
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
    expect(screen.getByText('when its check finds work · publishes nothing')).toBeTruthy()

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

  test('the section says what a setting reaches: the offset under "All projects", each project\'s commands under its own name with its scheduler\'s status', async () => {
    const { host, runCommand } = hostAnswering((projectId, args) =>
      args[0] === 'status' ? { ok: true, output: projectId === 'p1' ? STATUS : { ...STATUS, on: false, running: false, switches: {}, publishes: {} } } : { ok: true, output: { ok: true } },
    )
    show(host, [GEMSTACK, OTHER])
    const all = await screen.findByRole('group', { name: 'All projects' })
    expect(within(all).getByLabelText('Spend offset')).toBeTruthy()
    expect(within(all).getByText(/One number, saved to every project/)).toBeTruthy()
    expect(within(all).queryByLabelText('Run /work-queue on a schedule')).toBeNull()
    const gemstack = screen.getByRole('group', { name: 'gemstack' })
    const other = screen.getByRole('group', { name: 'other' })
    expect(within(gemstack).getByText('on').className).toMatch(/text-success/)
    expect(within(other).getByText('off')).toBeTruthy()
    expect(within(gemstack).getByText('opus')).toBeTruthy()
    expect(within(other).getByText('On this machine only; agent-schedule.md sets the defaults.')).toBeTruthy()
    expect(within(other).queryByLabelText('Spend offset')).toBeNull()
    // The same command in two projects: each row saves in its own project.
    expect(within(gemstack).getByLabelText('Run /post-merge-cleanup on a schedule').getAttribute('aria-checked')).toBe('true')
    const cleanup = within(other).getByLabelText('Run /post-merge-cleanup on a schedule') as HTMLElement
    expect(cleanup.getAttribute('aria-checked')).toBe('false')
    cleanup.click()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p2', ['switch', 'post-merge-cleanup', 'on']))
    expect(runCommand).not.toHaveBeenCalledWith('p1', ['switch', 'post-merge-cleanup', 'on'])
  })

  test('projects holding different offsets: the loosest is shown and each other one is named with its own; projects that agree are not', async () => {
    const offsets: Record<string, number> = { p1: 7, p2: -10.04 }
    const { host } = hostAnswering((projectId, args) => (args[0] === 'status' ? { ok: true, output: { ...STATUS, spendOffset: offsets[projectId] } } : { ok: true, output: { ok: true } }))
    show(host, [GEMSTACK, OTHER])
    const all = await screen.findByRole('group', { name: 'All projects' })
    expect(within(all).getByText(/Shown: the loosest\. other is at -10; saving sets every project to the same number\./)).toBeTruthy()
    cleanup()
    const { host: agreeing } = scheduler()
    show(agreeing, [GEMSTACK, OTHER])
    await screen.findByRole('group', { name: 'All projects' })
    expect(screen.queryByText(/Shown: the loosest/)).toBeNull()
  })

  test('a project whose scheduler has read no schedule says so under its name', async () => {
    const { host } = hostAnswering(() => ({ ok: true, output: { ok: true, on: true, keepAlive: false, running: true, model: 'opus', spendOffset: 7 } }))
    show(host)
    const gemstack = await screen.findByRole('group', { name: 'gemstack' })
    expect(within(gemstack).getByText("No scheduled command yet: this project's scheduler has not read a schedule.")).toBeTruthy()
  })

  test('a project whose scheduler cannot be read says so', async () => {
    const { host } = hostAnswering(() => ({ ok: false, error: 'not inside a git repository' }))
    show(host)
    expect((await screen.findByRole('alert')).textContent).toBe('The scheduler could not be read: not inside a git repository')
    expect(screen.queryByLabelText('Spend offset')).toBeNull()
    expect(within(screen.getByRole('group', { name: 'gemstack' })).getByText('not readable')).toBeTruthy()
  })
})
