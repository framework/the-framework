import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ModuleHostContext, type ModuleCommandResult, type ModuleHost, type ModuleProject } from '@openagt/dashboard/module'
import { AutomationsPage } from './AutomationsPage.js'
import { STATUS, hostAnswering } from './fixtures.js'

const GEMSTACK = { id: 'p1', name: 'gemstack', gitHost: true }
const OTHER = { id: 'p2', name: 'other', gitHost: false }

function show(host: ModuleHost, projects: ModuleProject[] = [GEMSTACK]) {
  return render(
    <ModuleHostContext.Provider value={host}>
      <AutomationsPage projects={projects} path={[]} />
    </ModuleHostContext.Provider>,
  )
}

/** A host whose `status` answers {@link STATUS} and whose saves are answered by `saved`. */
function scheduler(saved: (projectId: string, args: string[]) => ModuleCommandResult = () => ({ ok: true, output: { ok: true } })) {
  return hostAnswering((projectId, args) => (args[0] === 'status' ? { ok: true, output: STATUS } : saved(projectId, args)))
}

const options = (menu: HTMLSelectElement): string[] => [...menu.options].map(o => o.textContent ?? '')
const row = (name: string): HTMLElement => screen.getByRole('listitem', { name })

afterEach(cleanup)

describe('the Automations page', () => {
  test("one row per scheduled command: the command, what its skill says it does, when it runs in the skill's plain words, how far its runs publish, and what the scheduler last decided", async () => {
    const { host } = scheduler()
    show(host)
    const gemstack = await screen.findByRole('region', { name: 'gemstack' })
    expect(within(gemstack).getByText('Scheduler on').className).toMatch(/text-success/)
    expect(within(gemstack).getByText('opus')).toBeTruthy()

    const cleanupRow = row('/post-merge-cleanup')
    expect(within(cleanupRow).getByText('Write up merged pull requests.')).toBeTruthy()
    expect(within(cleanupRow).getByText('Every 1 day')).toBeTruthy()
    expect(within(cleanupRow).getByText('Commits its work')).toBeTruthy()
    expect(within(cleanupRow).getByRole('checkbox', { name: 'Run /post-merge-cleanup by itself' }).getAttribute('aria-checked')).toBe('true')

    // Nobody switched it on here: Off, whatever its skill says.
    const queueRow = row('/work-queue')
    expect(within(queueRow).getByText('Work one queued task.')).toBeTruthy()
    expect(within(queueRow).getByText('When the queue holds a task')).toBeTruthy()
    expect(within(queueRow).getByText('Publishes nothing')).toBeTruthy()
    expect(within(queueRow).getByText('Off')).toBeTruthy()
    expect(within(queueRow).getByRole('checkbox', { name: 'Run /work-queue by itself' }).getAttribute('aria-checked')).toBe('false')
  })

  test('a decision that started a run opens that agent; any other decision is plain words', async () => {
    const { host } = scheduler()
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(within(row('/post-merge-cleanup')).getByRole('button', { name: 'Started a run' }))
    expect(host.openAgent).toHaveBeenCalledWith('p1', '2026-10-03T10-00-00-000Z')
    expect(within(row('/work-queue')).getByText('Off').tagName).toBe('SPAN')
  })

  test('flipping a row\'s switch runs `switch` in its project', async () => {
    const { host, runCommand } = scheduler()
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    screen.getByRole('checkbox', { name: 'Run /work-queue by itself' }).click()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['switch', 'work-queue', 'on']))
    screen.getByRole('checkbox', { name: 'Run /post-merge-cleanup by itself' }).click()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['switch', 'post-merge-cleanup', 'off']))
  })

  test('Edit opens the row in place: the publish menu shows this machine\'s pick, the sentence follows the menu, Save runs `publish`, Cancel saves nothing', async () => {
    const { host, runCommand } = scheduler()
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    expect(screen.queryByLabelText('What its runs publish')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    const editor = screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })
    const menu = within(editor).getByLabelText('What its runs publish') as HTMLSelectElement
    expect(options(menu)).toEqual(['Nothing', 'Commit', 'Publish branch', 'Open PR', 'Merge on green'])
    expect(menu.value, 'nobody picked here').toBe('commit')
    expect(within(editor).getByText('Every 1 day. Commits its work.')).toBeTruthy()
    expect(within(editor).getByText('Saved for you, in this project, on this machine. No tracked file changes.')).toBeTruthy()
    fireEvent.change(menu, { target: { value: 'pr' } })
    expect(within(editor).getByText('Every 1 day. Opens a pull request.')).toBeTruthy()
    // Nothing is saved until Save.
    expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'publish')).toHaveLength(0)
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['publish', 'post-merge-cleanup', 'pr']))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Editing /post-merge-cleanup' })).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Edit /work-queue' }))
    const second = screen.getByRole('group', { name: 'Editing /work-queue' })
    expect((within(second).getByLabelText('What its runs publish') as HTMLSelectElement).value).toBe('nothing')
    fireEvent.change(within(second).getByLabelText('What its runs publish'), { target: { value: 'merge' } })
    fireEvent.click(within(second).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Editing /work-queue' })).toBeNull()
    // Save with nothing changed closes the row and runs nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Edit /work-queue' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Editing /work-queue' })).getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('group', { name: 'Editing /work-queue' })).toBeNull()
    expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'publish')).toEqual([['p1', ['publish', 'post-merge-cleanup', 'pr']]])
  })

  test('a project with no git host package is offered Nothing, Commit and Publish branch only', async () => {
    const { host } = scheduler()
    show(host, [OTHER])
    await screen.findByRole('region', { name: 'other' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    expect(options(screen.getByLabelText('What its runs publish') as HTMLSelectElement)).toEqual(['Nothing', 'Commit', 'Publish branch'])
  })

  test('a save the command refused says which and why, and a refused publish pick leaves the row open', async () => {
    const { host } = scheduler(() => ({ ok: false, error: 'the schedule of work-queue cannot be read: unknown key evry' }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    screen.getByRole('checkbox', { name: 'Run /work-queue by itself' }).click()
    expect((await screen.findByRole('alert')).textContent).toBe('The switch of /work-queue was not saved: the schedule of work-queue cannot be read: unknown key evry')
    fireEvent.click(screen.getByRole('button', { name: 'Edit /work-queue' }))
    fireEvent.change(screen.getByLabelText('What its runs publish'), { target: { value: 'commit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The publish pick of /work-queue was not saved: the schedule of work-queue cannot be read: unknown key evry'))
    expect(screen.getByRole('group', { name: 'Editing /work-queue' })).toBeTruthy()
  })

  test('two projects: each under its own name with its scheduler\'s status, and a row saves in its own project', async () => {
    const { host, runCommand } = hostAnswering((projectId, args) =>
      args[0] === 'status' ? { ok: true, output: projectId === 'p1' ? STATUS : { ...STATUS, on: false, running: false, switches: {}, publishes: {} } } : { ok: true, output: { ok: true } },
    )
    show(host, [GEMSTACK, OTHER])
    const gemstack = await screen.findByRole('region', { name: 'gemstack' })
    const other = screen.getByRole('region', { name: 'other' })
    expect(within(gemstack).getByText('Scheduler on')).toBeTruthy()
    expect(within(other).getByText('Scheduler off')).toBeTruthy()
    const cleanupThere = within(other).getByRole('checkbox', { name: 'Run /post-merge-cleanup by itself' })
    expect(cleanupThere.getAttribute('aria-checked')).toBe('false')
    cleanupThere.click()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p2', ['switch', 'post-merge-cleanup', 'on']))
    expect(runCommand).not.toHaveBeenCalledWith('p1', ['switch', 'post-merge-cleanup', 'on'])
  })

  test("a skill whose schedule cannot be read is named with the reason; a command the coding agent cannot run says so on its row", async () => {
    const elsewhere = 'not a command of the coding agent: its skill is only under .agents/skills, not .claude/skills'
    const { host } = hostAnswering(() => ({
      ok: true,
      output: {
        ...STATUS,
        lastTick: {
          ...STATUS.lastTick,
          decisions: [{ command: 'triage', outcome: 'unreadable schedule: row 2: unknown key evry' }, { command: 'post-merge-cleanup', outcome: 'not due' }, { command: 'work-queue', outcome: elsewhere }],
        },
      },
    }))
    show(host)
    expect((await screen.findByRole('alert')).textContent).toBe('The schedule of the triage skill cannot be read, so it is not listed: row 2: unknown key evry')
    expect(within(row('/post-merge-cleanup')).getByText('No work')).toBeTruthy()
    expect(within(row('/work-queue')).getByText('Not a command of the coding agent: its skill is only under .agents/skills, not .claude/skills')).toBeTruthy()
  })

  test('a project with nothing to list says so; one whose scheduler cannot be read says why', async () => {
    const { host } = hostAnswering(projectId => (projectId === 'p1' ? { ok: true, output: { ok: true, on: true, keepAlive: false, running: false, model: 'opus', spendOffset: 7 } } : { ok: false, error: 'not inside a git repository' }))
    show(host, [GEMSTACK, OTHER])
    const gemstack = await screen.findByRole('region', { name: 'gemstack' })
    expect(within(gemstack).getByText('Scheduler on, not running').className).toMatch(/text-warning/)
    expect(within(gemstack).getByText('Nothing here yet: no skill of this project says it can be scheduled, or its scheduler has not looked yet.')).toBeTruthy()
    const other = screen.getByRole('region', { name: 'other' })
    expect(within(other).getByRole('alert').textContent).toBe('The scheduler could not be read: not inside a git repository')
    expect(within(other).getByText('Scheduler not readable')).toBeTruthy()
  })
})
