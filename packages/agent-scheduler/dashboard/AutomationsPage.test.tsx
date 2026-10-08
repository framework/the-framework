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
    expect(screen.getByText('What starts by itself while nobody is at the keyboard. Your choices, on this machine. Every row starts switched off.')).toBeTruthy()
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

  test('Edit offers when the row runs: as the skill says, or every so many of a unit with a time of day for days or more; Save runs `pace`, and the sentence follows the pick', async () => {
    const { host, runCommand } = scheduler()
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    const editor = screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })
    const skills = within(within(editor).getByRole('group', { name: 'When it runs' })).getByRole('radio', { name: /As the skill says/ }) as HTMLInputElement
    expect(skills.checked).toBe(true)
    expect(within(editor).getByText('every 1 day')).toBeTruthy()
    // Its skill gives no check: nothing could say when there is work.
    expect(within(editor).queryByRole('radio', { name: 'Whenever there is work' })).toBeNull()
    expect(within(editor).getByText('Every 1 day. Commits its work.')).toBeTruthy()

    // Picking "Every" starts from the skill's own interval.
    fireEvent.click(within(editor).getByRole('radio', { name: 'Every' }))
    const count = within(editor).getByLabelText('How many') as HTMLInputElement
    const unit = within(editor).getByLabelText('Unit') as HTMLSelectElement
    expect([count.value, unit.value]).toEqual(['1', 'd'])
    expect(options(unit)).toEqual(['minute', 'hour', 'day', 'week', 'month'])
    fireEvent.change(count, { target: { value: '2' } })
    expect(options(unit)).toEqual(['minutes', 'hours', 'days', 'weeks', 'months'])
    expect(within(editor).getByText('Counted from its last start, on any machine that shares this repository.')).toBeTruthy()
    fireEvent.change(within(editor).getByLabelText('Time of day'), { target: { value: '10:00' } })
    expect(within(editor).getByText("optional, this machine's time")).toBeTruthy()
    expect(within(editor).getByText('Every 2 days at 10:00. Commits its work.')).toBeTruthy()
    expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'pace')).toHaveLength(0)
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['pace', 'post-merge-cleanup', '2d', '10:00']))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Editing /post-merge-cleanup' })).toBeNull())
    // The publish pick did not change: one command ran.
    expect(runCommand.mock.calls.filter(([, args]) => args[0] !== 'status')).toEqual([['p1', ['pace', 'post-merge-cleanup', '2d', '10:00']]])
  })

  test('minutes and hours take no time of day; a count that is no whole number above 0 is no pace yet, and Save waits', async () => {
    const { host, runCommand } = scheduler()
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    const editor = screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })
    fireEvent.click(within(editor).getByRole('radio', { name: 'Every' }))
    fireEvent.change(within(editor).getByLabelText('Time of day'), { target: { value: '10:00' } })
    fireEvent.change(within(editor).getByLabelText('Unit'), { target: { value: 'h' } })
    expect(within(editor).queryByLabelText('Time of day')).toBeNull()
    expect(within(editor).getByText('Every 1 hour. Commits its work.')).toBeTruthy()
    const save = within(editor).getByRole('button', { name: 'Save' }) as HTMLButtonElement
    for (const typed of ['', '0', '1.5']) {
      fireEvent.change(within(editor).getByLabelText('How many'), { target: { value: typed } })
      expect(save.disabled, typed).toBe(true)
      expect(within(editor).getByText('Type a whole number, from 1 to 9999.')).toBeTruthy()
    }
    // A time left half typed: the field has no text, the browser says the entry is bad, and Save waits.
    fireEvent.change(within(editor).getByLabelText('How many'), { target: { value: '2' } })
    fireEvent.change(within(editor).getByLabelText('Unit'), { target: { value: 'd' } })
    const time = within(editor).getByLabelText('Time of day') as HTMLInputElement
    Object.defineProperty(time, 'validity', { configurable: true, value: { badInput: true } })
    fireEvent.change(time, { target: { value: '' } })
    expect(save.disabled).toBe(true)
    expect(within(editor).getByText('Finish the time, like 10:00, or clear it.')).toBeTruthy()
    Object.defineProperty(time, 'validity', { configurable: true, value: { badInput: false } })
    fireEvent.change(time, { target: { value: '09:30' } })
    expect(save.disabled).toBe(false)
    expect(within(editor).getByText('Every 2 days at 09:30. Commits its work.')).toBeTruthy()
    fireEvent.change(time, { target: { value: '' } })
    expect(within(editor).getByText("optional, this machine's time")).toBeTruthy()
    fireEvent.change(within(editor).getByLabelText('Unit'), { target: { value: 'mo' } })
    expect(within(editor).getByText("optional, this machine's time; a month counts as 30 days")).toBeTruthy()
    fireEvent.change(within(editor).getByLabelText('How many'), { target: { value: '30' } })
    fireEvent.change(within(editor).getByLabelText('Unit'), { target: { value: 'm' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    // The time typed beside days is not sent beside minutes.
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['pace', 'post-merge-cleanup', '30m']))
  })

  test("a row with a pace of its own says so and opens on it; \"As the skill says\" takes it back; a row whose skill has an interval and a check is offered \"Whenever there is work\"; a pace and a publish pick changed together are two saves, the pace first", async () => {
    const since = '2026-10-08T07:00:00.000Z'
    const { host, runCommand } = hostAnswering((projectId, args) =>
      args[0] !== 'status'
        ? { ok: true, output: { ok: true } }
        : {
            ok: true,
            output: {
              ...STATUS,
              switches: { 'post-merge-cleanup': '2026-10-03T08:00:00.000Z', 'update-tickets': '2026-10-03T08:00:00.000Z' },
              paces: { 'post-merge-cleanup': { every: '2d', at: '10:00', since } },
              lastTick: {
                ...STATUS.lastTick,
                decisions: [{ command: 'post-merge-cleanup', outcome: 'not due (next start from 2099-01-03 10:00, every 2d at 10:00)' }],
                schedule: [...STATUS.lastTick.schedule, { command: 'update-tickets', every: '15m', when: 'gh issue list', waitsFor: 'when an issue changed' }],
              },
            },
          },
    )
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    const mine = row('/post-merge-cleanup')
    expect(within(mine).getByText('Every 2 days at 10:00')).toBeTruthy()
    expect(within(mine).getByText('your pick')).toBeTruthy()
    expect(within(mine).getByText('Next: 3 Jan 10:00')).toBeTruthy()
    expect(within(row('/update-tickets')).queryByText('your pick')).toBeNull()
    expect(within(row('/update-tickets')).getByText('Every 15 minutes at most, when an issue changed')).toBeTruthy()

    fireEvent.click(within(mine).getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    const editor = screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })
    expect((within(editor).getByRole('radio', { name: 'Every' }) as HTMLInputElement).checked).toBe(true)
    expect([(within(editor).getByLabelText('How many') as HTMLInputElement).value, (within(editor).getByLabelText('Unit') as HTMLSelectElement).value, (within(editor).getByLabelText('Time of day') as HTMLInputElement).value]).toEqual(['2', 'd', '10:00'])
    fireEvent.click(within(within(editor).getByRole('group', { name: 'When it runs' })).getByRole('radio', { name: /As the skill says/ }))
    expect(within(editor).getByText('Every 1 day. Commits its work.')).toBeTruthy()
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['pace', 'post-merge-cleanup', 'skill']))

    fireEvent.click(screen.getByRole('button', { name: 'Edit /update-tickets' }))
    const second = screen.getByRole('group', { name: 'Editing /update-tickets' })
    expect(within(second).getByText('every 15 minutes at most, when an issue changed')).toBeTruthy()
    fireEvent.click(within(second).getByRole('radio', { name: 'Whenever there is work' }))
    expect(within(second).getByText('When an issue changed. Commits its work.')).toBeTruthy()
    fireEvent.change(within(second).getByLabelText('What its runs publish'), { target: { value: 'pr' } })
    fireEvent.click(within(second).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['publish', 'update-tickets', 'pr']))
    expect(runCommand.mock.calls.filter(([, args]) => args[0] !== 'status').map(([, args]) => args)).toEqual([
      ['pace', 'post-merge-cleanup', 'skill'],
      ['pace', 'update-tickets', 'work'],
      ['publish', 'update-tickets', 'pr'],
    ])
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Editing /update-tickets' })).toBeNull())
  })

  test('a pace that is not taken stops there: the publish pick is not sent, the row stays open with both picks, and its line says why', async () => {
    const { host, runCommand } = scheduler((projectId, args) => (args[0] === 'pace' ? { ok: false, error: 'post-merge-cleanup has no check, so nothing would say when there is work' } : { ok: true, output: { ok: true } }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    const editor = screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })
    fireEvent.click(within(editor).getByRole('radio', { name: 'Every' }))
    fireEvent.change(within(editor).getByLabelText('How many'), { target: { value: '3' } })
    fireEvent.change(within(editor).getByLabelText('What its runs publish'), { target: { value: 'pr' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))
    expect((await within(row('/post-merge-cleanup')).findByRole('alert')).textContent).toBe('The pace was not saved: post-merge-cleanup has no check, so nothing would say when there is work')
    const still = screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })
    expect((within(still).getByLabelText('How many') as HTMLInputElement).value).toBe('3')
    expect((within(still).getByLabelText('What its runs publish') as HTMLSelectElement).value).toBe('pr')
    expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'publish')).toHaveLength(0)
  })

  test('Edit offers how many agents may work on the row at once: as the skill says, or up to a number; Save runs `agents`, between the pace and the publish pick; a row with its own number says so', async () => {
    const { host, runCommand } = hostAnswering((projectId, args) =>
      args[0] !== 'status'
        ? { ok: true, output: { ok: true } }
        : { ok: true, output: { ...STATUS, agents: { 'work-queue': 3 }, lastTick: { ...STATUS.lastTick, schedule: [{ command: 'post-merge-cleanup', every: '1d', agents: 2 }, STATUS.lastTick.schedule[1]] } } },
    )
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    // The skill lets two run at once; a person's own number shows on the row too.
    expect(within(row('/post-merge-cleanup')).getByText('Up to 2 at once')).toBeTruthy()
    expect(within(row('/post-merge-cleanup')).queryByText('your pick')).toBeNull()
    expect(within(row('/work-queue')).getByText('Up to 3 at once')).toBeTruthy()
    expect(within(row('/work-queue')).getByText('your pick')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    const editor = screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })
    const many = within(editor).getByRole('group', { name: 'How many at once' })
    expect((within(many).getByRole('radio', { name: /As the skill says/ }) as HTMLInputElement).checked).toBe(true)
    expect(within(many).getByText('up to 2 at once')).toBeTruthy()
    expect(within(many).getByText('A new one starts only when the row is due, and only while fewer than this are working on any machine that shares this repository.')).toBeTruthy()
    expect(within(editor).getByText('Every 1 day. Up to 2 at once. Commits its work.')).toBeTruthy()
    // Picking a number starts from the skill's.
    fireEvent.click(within(many).getByRole('radio', { name: 'Up to' }))
    const count = within(many).getByLabelText('How many agents') as HTMLInputElement
    expect(count.value).toBe('2')
    const save = within(editor).getByRole('button', { name: 'Save' }) as HTMLButtonElement
    for (const typed of ['', '0', '1.5', '100']) {
      fireEvent.change(count, { target: { value: typed } })
      expect(save.disabled, typed).toBe(true)
      expect(within(editor).getByText('Type a whole number of agents, from 1 to 99.')).toBeTruthy()
    }
    // Lowered to one where the skill lets two: the sentence says so, it does not go quiet.
    fireEvent.change(count, { target: { value: '1' } })
    expect(within(many).getByText('agent at once')).toBeTruthy()
    expect(within(editor).getByText('Every 1 day. One at a time. Commits its work.')).toBeTruthy()
    fireEvent.change(count, { target: { value: '4' } })
    expect(within(editor).getByText('Every 1 day. Up to 4 at once. Commits its work.')).toBeTruthy()
    fireEvent.click(within(within(editor).getByRole('group', { name: 'When it runs' })).getByRole('radio', { name: 'Every' }))
    fireEvent.change(within(editor).getByLabelText('How many'), { target: { value: '3' } })
    fireEvent.change(within(editor).getByLabelText('What its runs publish'), { target: { value: 'pr' } })
    fireEvent.click(save)
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['publish', 'post-merge-cleanup', 'pr']))
    expect(runCommand.mock.calls.filter(([, args]) => args[0] !== 'status').map(([, args]) => args)).toEqual([
      ['pace', 'post-merge-cleanup', '3d'],
      ['agents', 'post-merge-cleanup', '4'],
      ['publish', 'post-merge-cleanup', 'pr'],
    ])

    // A row with its own number opens on it, and "As the skill says" takes it back.
    fireEvent.click(screen.getByRole('button', { name: 'Edit /work-queue' }))
    const second = within(screen.getByRole('group', { name: 'Editing /work-queue' })).getByRole('group', { name: 'How many at once' })
    expect((within(second).getByRole('radio', { name: 'Up to' }) as HTMLInputElement).checked).toBe(true)
    expect((within(second).getByLabelText('How many agents') as HTMLInputElement).value).toBe('3')
    expect(within(second).getByText('one at a time')).toBeTruthy()
    fireEvent.click(within(second).getByRole('radio', { name: /As the skill says/ }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Editing /work-queue' })).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['agents', 'work-queue', 'skill']))
  })

  test("a person's own number of one is said on the row; a number of agents that is not taken stops there: the publish pick is not sent and the row stays open; a pace that is no pace yet is the hint that shows first", async () => {
    const { host, runCommand } = hostAnswering((projectId, args) => {
      if (args[0] === 'status') return { ok: true, output: { ...STATUS, agents: { 'work-queue': 1 } } }
      return args[0] === 'agents' ? { ok: false, error: 'no skill of this project schedules post-merge-cleanup' } : { ok: true, output: { ok: true } }
    })
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    // The skill says nothing, so one at a time, and so does this person: said because it is their pick.
    expect(within(row('/work-queue')).getByText('One at a time')).toBeTruthy()
    expect(within(row('/work-queue')).getByText('your pick')).toBeTruthy()
    expect(within(row('/post-merge-cleanup')).queryByText('One at a time')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    const editor = screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })
    const many = within(editor).getByRole('group', { name: 'How many at once' })
    fireEvent.click(within(many).getByRole('radio', { name: 'Up to' }))
    // Both half typed: the pace's hint shows first, then the number's.
    fireEvent.change(within(many).getByLabelText('How many agents'), { target: { value: '' } })
    fireEvent.click(within(within(editor).getByRole('group', { name: 'When it runs' })).getByRole('radio', { name: 'Every' }))
    fireEvent.change(within(editor).getByLabelText('How many'), { target: { value: '' } })
    expect(within(editor).getByText('Type a whole number, from 1 to 9999.')).toBeTruthy()
    fireEvent.change(within(editor).getByLabelText('How many'), { target: { value: '2' } })
    expect(within(editor).getByText('Type a whole number of agents, from 1 to 99.')).toBeTruthy()
    fireEvent.change(within(many).getByLabelText('How many agents'), { target: { value: '99' } })
    fireEvent.change(within(editor).getByLabelText('What its runs publish'), { target: { value: 'pr' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))
    expect((await within(row('/post-merge-cleanup')).findByRole('alert')).textContent).toBe('The number of agents was not saved: no skill of this project schedules post-merge-cleanup')
    expect(screen.getByRole('group', { name: 'Editing /post-merge-cleanup' })).toBeTruthy()
    expect(runCommand.mock.calls.filter(([, args]) => args[0] !== 'status').map(([, args]) => args)).toEqual([
      ['pace', 'post-merge-cleanup', '2d'],
      ['agents', 'post-merge-cleanup', '99'],
    ])
  })

  test('a project with no git host package is offered Nothing, Commit and Publish branch only', async () => {
    const { host } = scheduler()
    show(host, [OTHER])
    await screen.findByRole('region', { name: 'other' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    expect(options(screen.getByLabelText('What its runs publish') as HTMLSelectElement)).toEqual(['Nothing', 'Commit', 'Publish branch'])
  })

  test('a save the command refused says why on its own row, and a refused publish pick leaves the row open; the next save of that row takes the line away', async () => {
    let refuse = true
    const { host } = scheduler(() => (refuse ? { ok: false, error: 'the schedule of work-queue cannot be read: unknown key evry' } : { ok: true, output: { ok: true } }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    screen.getByRole('checkbox', { name: 'Run /work-queue by itself' }).click()
    const alert = await within(row('/work-queue')).findByRole('alert')
    expect(alert.textContent).toBe('The switch was not saved: the schedule of work-queue cannot be read: unknown key evry')
    expect(within(row('/post-merge-cleanup')).queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit /work-queue' }))
    fireEvent.change(screen.getByLabelText('What its runs publish'), { target: { value: 'commit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(row('/work-queue')).getByRole('alert').textContent).toBe('The publish pick was not saved: the schedule of work-queue cannot be read: unknown key evry'))
    expect(screen.getByRole('group', { name: 'Editing /work-queue' })).toBeTruthy()
    refuse = false
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Editing /work-queue' })).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('a command that could not even be asked is a save not taken: the row says why, comes back, and the next save still runs', async () => {
    let down = true
    const { host, runCommand } = hostAnswering((projectId, args) => {
      if (args[0] === 'status') return { ok: true, output: STATUS }
      if (down) throw new Error('Failed to fetch')
      return { ok: true, output: { ok: true } }
    })
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    const box = screen.getByRole('checkbox', { name: 'Run /work-queue by itself' })
    box.click()
    expect((await within(row('/work-queue')).findByRole('alert')).textContent).toBe('The switch was not saved: Failed to fetch')
    await waitFor(() => expect(row('/work-queue').className).not.toMatch(/opacity-60/))
    expect(box.hasAttribute('disabled') || box.getAttribute('aria-disabled') === 'true').toBe(false)
    down = false
    screen.getByRole('checkbox', { name: 'Run /post-merge-cleanup by itself' }).click()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['switch', 'post-merge-cleanup', 'off']))
    await waitFor(() => expect(row('/post-merge-cleanup').className).not.toMatch(/opacity-60/))
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

  test('a row is held, its controls with it, until its save has answered; opening another row closes the open one, and a save that answers later closes only its own row', async () => {
    let answerPublish: (result: ModuleCommandResult) => void = () => {}
    const { host, runCommand } = hostAnswering((projectId, args) => {
      if (args[0] === 'status') return { ok: true, output: STATUS }
      return new Promise<ModuleCommandResult>(resolve => (answerPublish = resolve)) as never
    })
    show(host, [GEMSTACK, OTHER])
    const gemstack = await screen.findByRole('region', { name: 'gemstack' })
    const held = within(gemstack).getByRole('listitem', { name: '/post-merge-cleanup' })
    fireEvent.click(within(gemstack).getByRole('button', { name: 'Edit /post-merge-cleanup' }))
    fireEvent.change(within(gemstack).getByLabelText('What its runs publish'), { target: { value: 'pr' } })
    fireEvent.click(within(gemstack).getByRole('button', { name: 'Save' }))
    // While that save is in flight the person opens another row: the first one closes, one row open at a time.
    fireEvent.click(within(gemstack).getByRole('button', { name: 'Edit /work-queue' }))
    expect(within(gemstack).queryByRole('group', { name: 'Editing /post-merge-cleanup' })).toBeNull()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['publish', 'post-merge-cleanup', 'pr']))
    expect(held.className).toMatch(/opacity-60/)
    expect((within(held).getByRole('button', { name: 'Edit /post-merge-cleanup' }) as HTMLButtonElement).disabled).toBe(true)
    // The same command in the other project is not held.
    expect(within(screen.getByRole('region', { name: 'other' })).getByRole('listitem', { name: '/post-merge-cleanup' }).className).not.toMatch(/opacity-60/)
    answerPublish({ ok: true, output: { ok: true } })
    await waitFor(() => expect(held.className).not.toMatch(/opacity-60/))
    // The row opened meanwhile stays open, and keeps the keyboard.
    const second = within(gemstack).getByRole('group', { name: 'Editing /work-queue' })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(document.activeElement).toBe(within(within(second).getByRole('group', { name: 'When it runs' })).getByRole('radio', { name: /As the skill says/ }))
  })

  test('the keyboard follows the row: opening it lands on the pace in force, Escape closes it and hands the keyboard back to its Edit button', async () => {
    const { host, runCommand } = scheduler()
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit /work-queue' }))
    const menu = screen.getByLabelText('What its runs publish')
    expect(document.activeElement).toBe(within(screen.getByRole('group', { name: 'When it runs' })).getByRole('radio', { name: /As the skill says/ }))
    fireEvent.change(menu, { target: { value: 'merge' } })
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Editing /work-queue' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit /work-queue' })))
    expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'publish')).toHaveLength(0)
  })

  test('a tick that decided nothing says why in the heading; a scheduler that is off, or on with no process, says what that means and how it starts', async () => {
    const { host } = hostAnswering(projectId => ({ ok: true, output: { ...STATUS, ...(projectId === 'p1' ? { lastTick: { ...STATUS.lastTick, decisions: [], note: 'agent-data could not be pulled: origin is unreachable' } } : { on: false, lastTick: { ...STATUS.lastTick, decisions: [], note: 'off' } }) } }))
    show(host, [GEMSTACK, OTHER])
    const gemstack = await screen.findByRole('region', { name: 'gemstack' })
    expect(within(gemstack).getByText(/: agent-data could not be pulled: origin is unreachable/)).toBeTruthy()
    const other = screen.getByRole('region', { name: 'other' })
    expect(within(other).getByText('Scheduler off')).toBeTruthy()
    expect(within(other).queryByText(/: off/)).toBeNull()
    expect(within(other).getByText('The scheduler is off in this project, so nothing here starts. It starts with the dashboard once the project has run `npx agent-scheduler init`, or by hand with `npx agent-scheduler start`.')).toBeTruthy()
    expect(within(gemstack).queryByText(/so nothing here starts/)).toBeNull()
    cleanup()
    const { host: stopped } = hostAnswering(() => ({ ok: true, output: { ...STATUS, running: false } }))
    show(stopped)
    expect(await screen.findByText('The scheduler is on but its process is not running, so nothing here starts. `npx agent-scheduler start`, run in the project, starts it.')).toBeTruthy()
  })

  test("a skill whose schedule cannot be read is named with the reason; a command the coding agent cannot run says so on its row", async () => {
    const elsewhere = 'not a command of the coding agent: its skill is only under .agents/skills, not .claude/skills'
    const { host } = hostAnswering(() => ({
      ok: true,
      output: {
        ...STATUS,
        lastTick: {
          ...STATUS.lastTick,
          decisions: [{ command: 'triage', outcome: 'unreadable schedule: row 2: unknown key evry' }, { command: 'post-merge-cleanup', outcome: 'not due (last start 2h ago, every 1d)' }, { command: 'work-queue', outcome: elsewhere }],
        },
      },
    }))
    show(host)
    expect((await screen.findByRole('alert')).textContent).toBe('The schedule of the triage skill cannot be read, so it is not listed: row 2: unknown key evry')
    expect(within(row('/post-merge-cleanup')).getByText('Started 2h ago, not due yet')).toBeTruthy()
    expect(within(row('/work-queue')).getByText('Cannot start: its skill is only in .agents/skills, which Claude Code does not read')).toBeTruthy()
  })

  test('a project with nothing to list says so, in two ways: its scheduler never looked, or no skill of it can be scheduled; one whose scheduler cannot be read says why', async () => {
    const answers: Record<string, ModuleCommandResult> = {
      p1: { ok: true, output: { ok: true, on: true, keepAlive: false, running: true, model: 'opus', spendOffset: 7 } },
      p2: { ok: false, error: 'not inside a git repository' },
      p3: { ok: true, output: { ok: true, on: true, keepAlive: false, running: true, model: 'opus', spendOffset: 7, lastTick: { at: '2026-10-03T10:00:00.000Z', decisions: [], schedule: [], note: 'no skill of this project schedules a command' } } },
    }
    const { host } = hostAnswering(projectId => answers[projectId]!)
    show(host, [GEMSTACK, OTHER, { id: 'p3', name: 'third', gitHost: true }])
    const gemstack = await screen.findByRole('region', { name: 'gemstack' })
    expect(within(gemstack).getByText('Nothing here yet: the scheduler of this project has not looked at its skills.')).toBeTruthy()
    expect(within(gemstack).queryByRole('list')).toBeNull()
    const other = screen.getByRole('region', { name: 'other' })
    expect(within(other).getByRole('alert').textContent).toBe('The scheduler could not be read: not inside a git repository')
    expect(within(other).getByText('Scheduler not readable')).toBeTruthy()
    const third = screen.getByRole('region', { name: 'third' })
    expect(within(third).getByText('Nothing here: no skill of this project says it can be scheduled.')).toBeTruthy()
    // Said once, in the page's words: the tick's own note for it is not repeated in the heading.
    expect(within(third).queryByText(/no skill of this project schedules a command/)).toBeNull()
  })
})
