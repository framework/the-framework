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

/** {@link STATUS} with two rows made with "New automation", both as the tool wrote them: one shared with the project, one kept on this machine. */
const MINE = {
  ...STATUS,
  lastTick: {
    ...STATUS.lastTick,
    schedule: [
      ...STATUS.lastTick.schedule,
      { command: 'answer-comments', every: '15m', when: 'gh api comments', waitsFor: 'when someone commented', description: 'Answer each new comment below.', editable: true },
      { command: 'tidy', every: '1d', description: 'Tidy up.', onThisMachine: true, editable: true },
    ],
  },
}

/** What `agent-scheduler show answer-comments` prints for the shared one. */
const SHOWN = { ok: true, name: 'answer-comments', prompt: 'Answer each new comment below.', every: '15m', when: 'gh api comments', waitsFor: 'when someone commented', file: '.claude/skills/answer-comments/SKILL.md' }

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

  test('"New automation" opens a form in its project: a name, what the agent is told, a pace, a shell line; the line under it says what is missing, then when the row would run; Cancel and Escape close it and save nothing', async () => {
    const { host, runCommand } = scheduler()
    show(host, [GEMSTACK, OTHER])
    const gemstack = await screen.findByRole('region', { name: 'gemstack' })
    expect(screen.queryByRole('group', { name: 'New automation' })).toBeNull()
    fireEvent.click(within(gemstack).getByRole('button', { name: 'New automation in gemstack' }))
    const form = within(gemstack).getByRole('group', { name: 'New automation' })
    // One form at a time, in the project whose button was pressed; no project offers another while it is open, since opening one would drop what was typed.
    expect(screen.getAllByRole('group', { name: 'New automation' }).length).toBe(1)
    expect(screen.queryByRole('button', { name: /^New automation in/ })).toBeNull()
    expect(within(form).getByText('by time alone')).toBeTruthy()
    expect(within(form).getByText('Give it a name. It becomes the command, like /answer-comments.')).toBeTruthy()
    expect((within(form).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(form).getByRole('button', { name: 'Try it' }) as HTMLButtonElement).disabled).toBe(true)
    // The plain words for a shell line show only once there is a line.
    expect(within(form).queryByLabelText(/What the line waits for/)).toBeNull()
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'answer-comments' } })
    expect(within(form).getByText('Write what the agent is told.')).toBeTruthy()
    fireEvent.change(within(form).getByLabelText('What the agent is told'), { target: { value: 'Answer each new comment below.' } })
    expect(within(form).getByText('Every 1 day.')).toBeTruthy()
    fireEvent.change(within(form).getByLabelText('How many'), { target: { value: '15' } })
    fireEvent.change(within(form).getByLabelText('Unit'), { target: { value: 'm' } })
    fireEvent.change(within(form).getByLabelText(/A shell line that prints what is new/), { target: { value: 'gh api comments' } })
    fireEvent.change(within(form).getByLabelText(/What the line waits for/), { target: { value: 'when someone commented' } })
    expect(within(form).getByText('Every 15 minutes at most, when someone commented.')).toBeTruthy()
    expect(within(form).getByText('at most, and only when the shell line below prints something')).toBeTruthy()
    // The pace unticked: its count and unit are set aside, and the shell line alone says when.
    fireEvent.click(within(form).getByRole('checkbox', { name: 'Every' }))
    expect((within(form).getByLabelText('How many') as HTMLInputElement).disabled).toBe(true)
    expect((within(form).getByLabelText('Unit') as HTMLSelectElement).disabled).toBe(true)
    expect(within(form).getByText('not on a pace: the shell line below alone says when')).toBeTruthy()
    expect(within(form).getByText('When someone commented.')).toBeTruthy()
    expect((within(form).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
    // Escape does not close a form that holds text: a slip of a key loses no prompt. Cancel does.
    fireEvent.keyDown(form, { key: 'Escape' })
    expect(screen.getByRole('group', { name: 'New automation' })).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'New automation' })).toBeNull()
    // Opened again it is empty, and Escape closes an empty one.
    fireEvent.click(within(gemstack).getByRole('button', { name: 'New automation in gemstack' }))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
    fireEvent.keyDown(screen.getByRole('group', { name: 'New automation' }), { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'New automation' })).toBeNull()
    expect(screen.getByRole('button', { name: 'New automation in other' })).toBeTruthy()
    expect(runCommand.mock.calls.every(([, args]) => args[0] === 'status')).toBe(true)
  })

  test('"Try it" runs the shell line once in the project and shows what it printed and whether an agent would start; the answer goes away when the line changes', async () => {
    const tries: ModuleCommandResult[] = [
      { ok: true, output: { ok: true, lastRun: '2026-10-08T10:00:00Z', ran: true, due: true, printed: '[{"url":"https://example.test/1"}]' } },
      { ok: true, output: { ok: true, lastRun: '2026-10-08T10:00:00Z', ran: false, due: false, printed: '', error: 'gh: command not found' } },
      { ok: false, error: 'the project is gone' },
    ]
    const { host, runCommand } = scheduler((_, args) => (args[0] === 'try' ? tries.shift()! : { ok: true, output: { ok: true } }))
    show(host)
    fireEvent.click(await screen.findByRole('button', { name: 'New automation in gemstack' }))
    const form = screen.getByRole('group', { name: 'New automation' })
    const line = within(form).getByLabelText(/A shell line that prints what is new/)
    fireEvent.change(line, { target: { value: '  gh api comments  ' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Try it' }))
    const answer = await within(form).findByRole('status', { name: 'What the line answered' })
    expect(runCommand).toHaveBeenCalledWith('p1', ['try', '--when=gh api comments'])
    expect(within(answer).getByText('It printed something: an agent would start now.').className).toMatch(/text-success/)
    expect(answer.querySelector('pre')?.textContent).toBe('[{"url":"https://example.test/1"}]')
    expect(within(answer).getByText('Tried as if the row had last started a day ago: $LAST_RUN was 2026-10-08T10:00:00Z.')).toBeTruthy()
    // The answer was for that line: another line has none until it is tried.
    fireEvent.change(line, { target: { value: 'gh api other' } })
    expect(within(form).queryByRole('status', { name: 'What the line answered' })).toBeNull()
    fireEvent.click(within(form).getByRole('button', { name: 'Try it' }))
    expect((await within(form).findByText('The line failed: gh: command not found')).className).toMatch(/text-danger/)
    fireEvent.change(line, { target: { value: 'gh api third' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Try it' }))
    expect(await within(form).findByText('The line could not be tried: the project is gone')).toBeTruthy()
    // Trying saves nothing.
    expect(runCommand.mock.calls.some(([, args]) => args[0] === 'add')).toBe(false)
  })

  test('an answer that comes back after the line was changed is not shown under the other line', async () => {
    const { host, runCommand } = scheduler()
    let answer!: (result: ModuleCommandResult) => void
    runCommand.mockImplementation(async (_projectId: string, args: string[]) => (args[0] === 'try' ? new Promise<ModuleCommandResult>(resolve => (answer = resolve)) : { ok: true, output: args[0] === 'status' ? STATUS : { ok: true } }))
    show(host)
    fireEvent.click(await screen.findByRole('button', { name: 'New automation in gemstack' }))
    const form = screen.getByRole('group', { name: 'New automation' })
    const line = within(form).getByLabelText(/A shell line that prints what is new/)
    fireEvent.change(line, { target: { value: 'a slow line' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Try it' }))
    expect((within(form).getByRole('button', { name: 'Trying…' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(line, { target: { value: 'another line' } })
    answer({ ok: true, output: { ok: true, lastRun: '2026-10-08T10:00:00Z', ran: true, due: true, printed: '[1]' } })
    await waitFor(() => expect(runCommand.mock.results.some(r => r.type === 'return')).toBe(true))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(within(form).queryByRole('status', { name: 'What the line answered' })).toBeNull()
    expect(within(form).queryByText('It printed something: an agent would start now.')).toBeNull()
  })

  test('Save runs `add` in the project and then says where the file is, that it is the person\'s to commit, and where it has to get to before its row can start; a save that is refused says why and keeps what was typed', async () => {
    const saves: ModuleCommandResult[] = [
      { ok: false, error: 'that name is taken: .claude/skills/answer-comments' },
      { ok: true, output: { ok: true, command: 'answer-replies', file: '.claude/skills/answer-replies/SKILL.md', startsFrom: 'origin/main' } },
    ]
    const { host, runCommand } = scheduler((_, args) => (args[0] === 'add' ? saves.shift()! : { ok: true, output: { ok: true } }))
    show(host)
    fireEvent.click(await screen.findByRole('button', { name: 'New automation in gemstack' }))
    const form = screen.getByRole('group', { name: 'New automation' })
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'answer-comments' } })
    fireEvent.change(within(form).getByLabelText('What the agent is told'), { target: { value: '- Answer each new comment below.' } })
    fireEvent.click(within(form).getByRole('checkbox', { name: 'Every' }))
    fireEvent.change(within(form).getByLabelText(/A shell line that prints what is new/), { target: { value: 'gh api comments' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect((await within(form).findByRole('alert')).textContent).toBe('Not saved: that name is taken: .claude/skills/answer-comments')
    expect(runCommand).toHaveBeenCalledWith('p1', ['add', 'answer-comments', '--prompt=- Answer each new comment below.', '--when=gh api comments'])
    expect((within(form).getByLabelText('What the agent is told') as HTMLTextAreaElement).value).toBe('- Answer each new comment below.')
    // Typing again takes the refusal away.
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'answer-replies' } })
    expect(within(form).queryByRole('alert')).toBeNull()
    const statusReads = runCommand.mock.calls.filter(([, args]) => args[0] === 'status').length
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    const saved = await screen.findByText(/It is a file of yours, in this project, and nothing was committed for you\./)
    const panel = screen.getByRole('group', { name: 'New automation' })
    expect(panel.textContent).toContain('Saved /answer-replies as .claude/skills/answer-replies/SKILL.md.')
    expect(saved.textContent).toContain('Its row cannot start before the file is on origin/main: commit it and bring it there.')
    expect(panel.textContent).toContain('Its row shows here once the scheduler has looked, within a minute. It starts switched off.')
    // The rows are read again at once.
    await waitFor(() => expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'status').length).toBeGreaterThan(statusReads))
    fireEvent.click(within(panel).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('group', { name: 'New automation' })).toBeNull()
    expect(screen.getByRole('button', { name: 'New automation in gemstack' })).toBeTruthy()
  })

  test('while a save runs the form takes no more typing and no second Save, and Escape does not close it; in a project whose scheduler is not running the saved panel says the row does not show yet', async () => {
    let answer!: (result: ModuleCommandResult) => void
    const { host, runCommand } = scheduler()
    runCommand.mockImplementation(async (_projectId: string, args: string[]) => (args[0] === 'add' ? new Promise<ModuleCommandResult>(resolve => (answer = resolve)) : { ok: true, output: args[0] === 'status' ? { ...STATUS, running: false } : { ok: true } }))
    show(host)
    fireEvent.click(await screen.findByRole('button', { name: 'New automation in gemstack' }))
    const form = screen.getByRole('group', { name: 'New automation' })
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'daily-notes' } })
    fireEvent.change(within(form).getByLabelText('What the agent is told'), { target: { value: 'Write the notes.' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect((within(form).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true))
    expect((within(form).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(form).getByLabelText('Name').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true)
    fireEvent.keyDown(form, { key: 'Escape' })
    expect(screen.getByRole('group', { name: 'New automation' })).toBeTruthy()
    expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'add').length).toBe(1)
    answer({ ok: true, output: { ok: true, command: 'daily-notes', file: '.claude/skills/daily-notes/SKILL.md', startsFrom: 'HEAD' } })
    const panel = await screen.findByText(/It is a file of yours/)
    expect(panel.textContent).toContain('Its row cannot start before you commit the file.')
    expect(screen.getByRole('group', { name: 'New automation' }).textContent).toContain('The scheduler is not running in this project, so its row does not show yet: it shows once the scheduler runs. It starts switched off.')
  })

  test('a second try asked while the first is still running: the first one\'s late answer changes nothing, and the button stays held until the second answers', async () => {
    const answers: ((result: ModuleCommandResult) => void)[] = []
    const { host, runCommand } = scheduler()
    runCommand.mockImplementation(async (_projectId: string, args: string[]) => (args[0] === 'try' ? new Promise<ModuleCommandResult>(resolve => answers.push(resolve)) : { ok: true, output: args[0] === 'status' ? STATUS : { ok: true } }))
    show(host)
    fireEvent.click(await screen.findByRole('button', { name: 'New automation in gemstack' }))
    const form = screen.getByRole('group', { name: 'New automation' })
    const line = within(form).getByLabelText(/A shell line that prints what is new/)
    fireEvent.change(line, { target: { value: 'first line' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Try it' }))
    fireEvent.change(line, { target: { value: 'second line' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Try it' }))
    await waitFor(() => expect(answers.length).toBe(2))
    answers[0]!({ ok: true, output: { ok: true, lastRun: '2026-10-08T10:00:00Z', ran: true, due: true, printed: '["first"]' } })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect((within(form).getByRole('button', { name: 'Trying…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(form).queryByRole('status', { name: 'What the line answered' })).toBeNull()
    answers[1]!({ ok: true, output: { ok: true, lastRun: '2026-10-08T10:00:00Z', ran: true, due: false, printed: '[]' } })
    expect(await within(form).findByText('It printed nothing to do: no agent would start.')).toBeTruthy()
  })

  test('"Who gets it": shared with the project by default; "Only on this machine" saves with --private, and the saved panel says nothing is to commit and the row can start at once', async () => {
    const { host, runCommand } = scheduler((_, args) => (args[0] === 'add' ? { ok: true, output: { ok: true, command: 'watch-competitor', file: '.agent-scheduler/automations/watch-competitor.md', startsFrom: 'origin/main', onThisMachine: true } } : { ok: true, output: { ok: true } }))
    show(host)
    fireEvent.click(await screen.findByRole('button', { name: 'New automation in gemstack' }))
    const form = screen.getByRole('group', { name: 'New automation' })
    const shared = within(form).getByRole('radio', { name: /Shared with the project/ }) as HTMLInputElement
    const here = within(form).getByRole('radio', { name: /Only on this machine/ }) as HTMLInputElement
    expect([shared.checked, here.checked]).toEqual([true, false])
    expect(within(form).getByText('Saved as a skill file in this project, which you commit. The row starts switched off.')).toBeTruthy()
    // A shared one is a command to type, shown with its slash before the name; one kept here has none.
    const slashBefore = (): boolean => within(form).getByLabelText('Name').parentElement!.textContent === '/'
    expect(slashBefore()).toBe(true)
    fireEvent.click(here)
    expect([shared.checked, here.checked]).toEqual([false, true])
    expect(slashBefore()).toBe(false)
    expect(within(form).getByText('Give it a name, like answer-comments.')).toBeTruthy()
    expect(within(form).getByText('Kept on this machine alone, outside git. The row starts switched off, and can start as soon as you switch it on.')).toBeTruthy()
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'watch-competitor' } })
    fireEvent.change(within(form).getByLabelText('What the agent is told'), { target: { value: 'Look for new threads.' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['add', 'watch-competitor', '--prompt=Look for new threads.', '--every=1d', '--private']))
    const panel = await screen.findByText('It is kept on this machine alone: nothing to commit, and nobody else gets the row. Its row can start as soon as you switch it on. Its prompt is in the record of each run, which is shared where this project shares its records.')
    expect(panel.closest('[role="group"]')!.textContent).toContain('Saved watch-competitor as .agent-scheduler/automations/watch-competitor.md.')
    expect(panel.closest('[role="group"]')!.textContent).not.toContain('commit it and bring it there')
  })

  test('a row of an automation kept on this machine says so, and is named without a slash in its title, its Edit button and its switch', async () => {
    const status = { ...STATUS, lastTick: { ...STATUS.lastTick, schedule: [...STATUS.lastTick.schedule, { command: 'watch-competitor', every: '1h', description: 'Look for new threads.', onThisMachine: true }] } }
    const { host, runCommand } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: status } : { ok: true, output: { ok: true } }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    const own = row('watch-competitor')
    expect(within(own).getByText('only on this machine')).toBeTruthy()
    expect(within(own).getByText('watch-competitor')).toBeTruthy()
    expect(within(own).queryByText('/watch-competitor')).toBeNull()
    expect(within(own).getByRole('button', { name: 'Edit watch-competitor' })).toBeTruthy()
    // Its Edit box speaks of how it was saved, not of a skill.
    fireEvent.click(within(own).getByRole('button', { name: 'Edit watch-competitor' }))
    const box = within(own).getByRole('group', { name: 'Editing watch-competitor' })
    expect(within(box).getAllByText('As it was saved').length).toBe(2)
    // And of this machine's runs alone, which are the ones it counts.
    expect(within(box).getByText('Counted from its last start, on this machine.')).toBeTruthy()
    expect(within(box).getByText(/only while fewer than this are working on this machine\./)).toBeTruthy()
    expect(within(box).queryByText(/any machine that shares this repository/)).toBeNull()
    expect(within(box).queryByText('As the skill says')).toBeNull()
    fireEvent.click(within(box).getByRole('button', { name: 'Cancel' }))
    within(own).getByRole('checkbox', { name: 'Run watch-competitor by itself' }).click()
    await waitFor(() => expect(runCommand).toHaveBeenCalledWith('p1', ['switch', 'watch-competitor', 'on']))
    // A skill's row keeps its slash and says no such thing.
    expect(within(row('/work-queue')).queryByText('only on this machine')).toBeNull()
  })

  test('an automation kept on this machine that the scheduler does not list is said so in its own words, beside a skill whose schedule cannot be read', async () => {
    const status = { ...STATUS, lastTick: { ...STATUS.lastTick, decisions: [{ command: 'triage', outcome: 'unreadable schedule: unknown key evry' }, { command: 'tidy', outcome: 'unlisted automation: it has no schedule' }, ...STATUS.lastTick.decisions] } }
    const { host } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: status } : { ok: true, output: { ok: true } }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    expect(screen.getAllByRole('alert').map(a => a.textContent)).toEqual(['The schedule of the triage skill cannot be read, so it is not listed: unknown key evry', 'The automation tidy, kept on this machine, is not listed: it has no schedule'])
  })

  test('a row made with "New automation" has "Edit prompt" and "Remove", named for its title; the rows that come from the project\'s skills have neither; and none is offered while a form is open', async () => {
    const { host } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: MINE } : { ok: true, output: { ok: true } }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    expect(within(row('/answer-comments')).getByRole('button', { name: 'Edit the prompt of /answer-comments' }).textContent).toBe('Edit prompt')
    expect(within(row('/answer-comments')).getByRole('button', { name: 'Remove /answer-comments' }).textContent).toBe('Remove')
    expect(within(row('tidy')).getByRole('button', { name: 'Edit the prompt of tidy' })).toBeTruthy()
    expect(within(row('tidy')).getByRole('button', { name: 'Remove tidy' })).toBeTruthy()
    // A skill of the project is not the person's to rewrite or delete from the page: it keeps its Edit and its switch alone.
    for (const name of ['/post-merge-cleanup', '/work-queue']) {
      expect(within(row(name)).queryByRole('button', { name: /^Edit the prompt of/ })).toBeNull()
      expect(within(row(name)).queryByRole('button', { name: /^Remove/ })).toBeNull()
      expect(within(row(name)).getByRole('button', { name: `Edit ${name}` })).toBeTruthy()
    }
    // Opening another form would drop what was typed into the open one.
    fireEvent.click(screen.getByRole('button', { name: 'New automation in gemstack' }))
    expect(screen.queryByRole('button', { name: /^Edit the prompt of/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull()
    fireEvent.click(within(screen.getByRole('group', { name: 'New automation' })).getByRole('button', { name: 'Cancel' }))
    expect(screen.getAllByRole('button', { name: /^Edit the prompt of/ }).length).toBe(2)
    // The row's own Edit box open: the two buttons wait for it to close.
    fireEvent.click(within(row('tidy')).getByRole('button', { name: 'Edit tidy' }))
    expect(within(row('tidy')).queryByRole('button', { name: 'Remove tidy' })).toBeNull()
    expect(within(row('/answer-comments')).getByRole('button', { name: 'Remove /answer-comments' })).toBeTruthy()
  })

  test('"Edit prompt" reads the automation with `show` and opens the form in its row, filled in: the name is fixed, who gets it is not asked, and Save waits for a change; Save runs `edit` and says what is left to do', async () => {
    const { host, runCommand } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: MINE } : args[0] === 'show' ? { ok: true, output: SHOWN } : { ok: true, output: { ok: true, command: 'answer-comments', file: SHOWN.file, startsFrom: 'origin/main' } }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    const mine = row('/answer-comments')
    fireEvent.click(within(mine).getByRole('button', { name: 'Edit the prompt of /answer-comments' }))
    const form = await within(mine).findByRole('group', { name: 'Prompt of /answer-comments' })
    expect(runCommand).toHaveBeenCalledWith('p1', ['show', 'answer-comments'])
    expect((within(form).getByLabelText('Name') as HTMLInputElement).value).toBe('answer-comments')
    expect((within(form).getByLabelText('Name') as HTMLInputElement).readOnly).toBe(true)
    expect(within(form).getByText(/the name stays: its past runs are counted by it\./)).toBeTruthy()
    expect((within(form).getByLabelText('What the agent is told') as HTMLTextAreaElement).value).toBe('Answer each new comment below.')
    expect((within(form).getByRole('checkbox', { name: 'Every' }) as HTMLInputElement).checked).toBe(true)
    expect((within(form).getByLabelText('How many') as HTMLInputElement).value).toBe('15')
    expect((within(form).getByLabelText('Unit') as HTMLSelectElement).value).toBe('m')
    expect((within(form).getByLabelText(/A shell line that prints what is new/) as HTMLTextAreaElement).value).toBe('gh api comments')
    expect((within(form).getByLabelText(/What the line waits for/) as HTMLInputElement).value).toBe('when someone commented')
    expect(within(form).queryByText('Who gets it')).toBeNull()
    expect(within(form).getByText(`A skill file in this project, ${SHOWN.file}: the change is yours to commit.`)).toBeTruthy()
    // The row's other buttons wait, and no project offers a new form over this one.
    expect(within(mine).queryByRole('button', { name: 'Edit /answer-comments' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'New automation in gemstack' })).toBeNull()
    // Nothing to save yet.
    expect(within(form).getByText('Every 15 minutes at most, when someone commented. Nothing is changed yet.')).toBeTruthy()
    expect((within(form).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(form).getByLabelText('What the agent is told'), { target: { value: '- Answer in one line.' } })
    fireEvent.change(within(form).getByLabelText('How many'), { target: { value: '30' } })
    expect(within(form).getByText('Every 30 minutes at most, when someone commented.')).toBeTruthy()
    const statusReads = runCommand.mock.calls.filter(([, args]) => args[0] === 'status').length
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    const saved = await within(mine).findByText(/It is a change to a file of yours, in this project, and nothing was committed for you\./)
    expect(runCommand).toHaveBeenCalledWith('p1', ['edit', 'answer-comments', '--prompt=- Answer in one line.', '--every=30m', '--when=gh api comments', '--waits-for=when someone commented'])
    const panel = within(mine).getByRole('group', { name: 'Prompt of /answer-comments' })
    expect(panel.textContent).toContain(`Saved /answer-comments again, in ${SHOWN.file}.`)
    expect(saved.textContent).toContain('An agent is told the new words only once the change is on origin/main: commit it and bring it there.')
    expect(panel.textContent).toContain('Its row shows the change once the scheduler has looked, within a minute.')
    await waitFor(() => expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'status').length).toBeGreaterThan(statusReads))
    fireEvent.click(within(panel).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('group', { name: 'Prompt of /answer-comments' })).toBeNull()
    expect(within(row('/answer-comments')).getByRole('button', { name: 'Edit the prompt of /answer-comments' })).toBeTruthy()
  })

  test('an automation kept on this machine opens the same way and says nothing is to commit; Cancel saves nothing, and Escape closes the form only while no text in it was changed; a refused save says why and keeps what was typed', async () => {
    const kept = { ok: true, name: 'tidy', prompt: 'Tidy up.', every: '1d', file: '.agent-scheduler/automations/tidy.md', onThisMachine: true }
    const saves: ModuleCommandResult[] = [{ ok: false, error: 'it cannot run as written: neither every nor when says when' }, { ok: true, output: { ok: true, command: 'tidy', file: kept.file, startsFrom: 'origin/main', onThisMachine: true } }]
    const { host, runCommand } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: MINE } : args[0] === 'show' ? { ok: true, output: kept } : saves.shift()!))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(within(row('tidy')).getByRole('button', { name: 'Edit the prompt of tidy' }))
    let form = await within(row('tidy')).findByRole('group', { name: 'Prompt of tidy' })
    expect(within(form).getByText('Kept on this machine alone, outside git: .agent-scheduler/automations/tidy.md.')).toBeTruthy()
    fireEvent.keyDown(within(form).getByLabelText('What the agent is told'), { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Prompt of tidy' })).toBeNull()
    fireEvent.click(within(row('tidy')).getByRole('button', { name: 'Edit the prompt of tidy' }))
    form = await within(row('tidy')).findByRole('group', { name: 'Prompt of tidy' })
    // A change of the pace alone is a change: a slip of a key does not lose it.
    fireEvent.change(within(form).getByLabelText('How many'), { target: { value: '2' } })
    fireEvent.keyDown(within(form).getByLabelText('What the agent is told'), { key: 'Escape' })
    expect(screen.getByRole('group', { name: 'Prompt of tidy' })).toBeTruthy()
    fireEvent.change(within(form).getByLabelText('How many'), { target: { value: '1' } })
    fireEvent.change(within(form).getByLabelText('What the agent is told'), { target: { value: 'Tidy up, gently.' } })
    fireEvent.keyDown(within(form).getByLabelText('What the agent is told'), { key: 'Escape' })
    expect(screen.getByRole('group', { name: 'Prompt of tidy' })).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect((await within(form).findByRole('alert')).textContent).toBe('Not saved: it cannot run as written: neither every nor when says when')
    expect((within(form).getByLabelText('What the agent is told') as HTMLTextAreaElement).value).toBe('Tidy up, gently.')
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    const saved = await within(row('tidy')).findByText(/It is kept on this machine alone: nothing to commit\./)
    expect(saved.textContent).toBe('It is kept on this machine alone: nothing to commit. The scheduler uses the new words from its next look. Its past runs, its switch and your picks for it stay.')
    expect(runCommand).toHaveBeenCalledWith('p1', ['edit', 'tidy', '--prompt=Tidy up, gently.', '--every=1d', '--when=', '--waits-for='])
    expect(within(row('tidy')).getByRole('group', { name: 'Prompt of tidy' }).textContent).toContain('Saved tidy again, in .agent-scheduler/automations/tidy.md.')
    fireEvent.click(within(row('tidy')).getByRole('button', { name: 'Done' }))
    // Cancel: no command but the reads.
    fireEvent.click(within(row('tidy')).getByRole('button', { name: 'Edit the prompt of tidy' }))
    form = await within(row('tidy')).findByRole('group', { name: 'Prompt of tidy' })
    fireEvent.change(within(form).getByLabelText('What the agent is told'), { target: { value: 'Never saved.' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Prompt of tidy' })).toBeNull()
    expect(runCommand.mock.calls.filter(([, args]) => args[0] === 'edit').length).toBe(2)
  })

  test('a row that runs at the person\'s own pace says in the form that the pace typed there is the one saved with the automation, and theirs stays in force', async () => {
    const paced = { ...MINE, paces: { tidy: { every: '6h', since: '2026-10-03T08:00:00.000Z' } } }
    const { host } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: paced } : { ok: true, output: { ok: true, name: args[1], prompt: 'p', every: '1d', file: 'f', ...(args[1] === 'tidy' ? { onThisMachine: true } : {}) } }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(within(row('tidy')).getByRole('button', { name: 'Edit the prompt of tidy' }))
    const form = await within(row('tidy')).findByRole('group', { name: 'Prompt of tidy' })
    expect(within(form).getByText('On this machine the row runs at your own pick, "Every 6 hours", and keeps doing so: this pace is the one saved with the automation. The row\'s Edit changes your pick.')).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    // A row at the pace it was saved with says no such thing.
    fireEvent.click(within(row('/answer-comments')).getByRole('button', { name: 'Edit the prompt of /answer-comments' }))
    const other = await within(row('/answer-comments')).findByRole('group', { name: 'Prompt of /answer-comments' })
    expect(within(other).queryByText(/your own pick/)).toBeNull()
  })

  test('an automation whose file was changed by hand since the scheduler last looked does not open: its row says why, in the command\'s words; neither does an answer the form cannot show', async () => {
    const answers: ModuleCommandResult[] = [{ ok: false, error: '.claude/skills/answer-comments is a skill of the project, or an automation changed by hand since it was saved: edit or remove its files yourself' }, { ok: true, output: { ok: true, name: 'answer-comments' } }]
    const { host } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: MINE } : answers.shift()!))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    const mine = row('/answer-comments')
    fireEvent.click(within(mine).getByRole('button', { name: 'Edit the prompt of /answer-comments' }))
    expect((await within(mine).findByRole('alert')).textContent).toBe('It could not be opened: .claude/skills/answer-comments is a skill of the project, or an automation changed by hand since it was saved: edit or remove its files yourself')
    expect(screen.queryByRole('group', { name: 'Prompt of /answer-comments' })).toBeNull()
    fireEvent.click(within(mine).getByRole('button', { name: 'Edit the prompt of /answer-comments' }))
    await waitFor(() => expect(within(mine).getByRole('alert').textContent).toBe('It could not be opened: its file holds something this form cannot show'))
    expect(screen.queryByRole('group', { name: 'Prompt of /answer-comments' })).toBeNull()
  })

  test('a row that goes while its form or its question is open, removed elsewhere, closes them: no form is left open where nobody sees it, and the buttons that open one come back', async () => {
    let status: unknown = MINE
    const without = (name: string): unknown => ({ ...MINE, lastTick: { ...MINE.lastTick, schedule: MINE.lastTick.schedule.filter(c => c.command !== name) } })
    const { host } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: status } : args[0] === 'show' ? { ok: true, output: SHOWN } : { ok: true, output: { ok: true } }))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(within(row('/answer-comments')).getByRole('button', { name: 'Edit the prompt of /answer-comments' }))
    await within(row('/answer-comments')).findByRole('group', { name: 'Prompt of /answer-comments' })
    expect(screen.queryByRole('button', { name: 'New automation in gemstack' })).toBeNull()
    // Its file is deleted in a terminal; any save on the page reads the rows again.
    status = without('answer-comments')
    within(row('tidy')).getByRole('checkbox', { name: 'Run tidy by itself' }).click()
    await waitFor(() => expect(screen.queryByRole('listitem', { name: '/answer-comments' })).toBeNull())
    await waitFor(() => expect(screen.getByRole('button', { name: 'New automation in gemstack' })).toBeTruthy())
    expect(within(row('tidy')).getByRole('button', { name: 'Edit the prompt of tidy' })).toBeTruthy()
    // The same for a row that was asking whether to be removed: back on the list, it asks nothing.
    fireEvent.click(within(row('tidy')).getByRole('button', { name: 'Remove tidy' }))
    expect(within(row('tidy')).getByRole('group', { name: 'Removing tidy' })).toBeTruthy()
    status = { ...MINE, lastTick: { ...MINE.lastTick, schedule: [] } }
    fireEvent.click(screen.getByRole('button', { name: 'New automation in gemstack' }))
    fireEvent.change(within(screen.getByRole('group', { name: 'New automation' })).getByLabelText('Name'), { target: { value: 'x' } })
    fireEvent.change(within(screen.getByRole('group', { name: 'New automation' })).getByLabelText('What the agent is told'), { target: { value: 'p' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'New automation' })).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'tidy' })).toBeNull())
    status = MINE
    fireEvent.click(within(screen.getByRole('group', { name: 'New automation' })).getByRole('button', { name: 'Done' }))
    fireEvent.click(await screen.findByRole('button', { name: 'New automation in gemstack' }))
    fireEvent.change(within(screen.getByRole('group', { name: 'New automation' })).getByLabelText('Name'), { target: { value: 'y' } })
    fireEvent.change(within(screen.getByRole('group', { name: 'New automation' })).getByLabelText('What the agent is told'), { target: { value: 'p' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'New automation' })).getByRole('button', { name: 'Save' }))
    await screen.findByRole('listitem', { name: 'tidy' })
    expect(screen.queryByRole('group', { name: 'Removing tidy' })).toBeNull()
  })

  test('an automation that answers `show` late, after another form was opened, does not take that form\'s place', async () => {
    let answer!: (shown: ModuleCommandResult) => void
    const late = new Promise<ModuleCommandResult>(resolve => {
      answer = resolve
    })
    const { host } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: MINE } : (late as unknown as ModuleCommandResult)))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    fireEvent.click(within(row('/answer-comments')).getByRole('button', { name: 'Edit the prompt of /answer-comments' }))
    fireEvent.click(screen.getByRole('button', { name: 'New automation in gemstack' }))
    fireEvent.change(within(screen.getByRole('group', { name: 'New automation' })).getByLabelText('Name'), { target: { value: 'typed-meanwhile' } })
    answer({ ok: true, output: SHOWN })
    // The row is let go once the answer is in, and the form that was opened meanwhile still holds what was typed.
    await waitFor(() => expect(row('/answer-comments').className).not.toMatch(/opacity-60/))
    expect(screen.queryByRole('group', { name: 'Prompt of /answer-comments' })).toBeNull()
    expect((within(screen.getByRole('group', { name: 'New automation' })).getByLabelText('Name') as HTMLInputElement).value).toBe('typed-meanwhile')
  })

  test('"Remove" asks first, in the row, and says what is deleted; Cancel and Escape remove nothing; Remove runs `remove`, the row goes, and the project says what is left for the person to do until they put it away', async () => {
    let status: unknown = MINE
    const { host, runCommand } = hostAnswering((projectId, args) => {
      if (args[0] === 'status') return { ok: true, output: projectId === 'p1' ? status : { ...STATUS, lastTick: { ...STATUS.lastTick, schedule: [] } } }
      status = { ...MINE, lastTick: { ...MINE.lastTick, schedule: MINE.lastTick.schedule.filter(c => c.command !== args[1]) } }
      return { ok: true, output: { ok: true, command: 'answer-comments', file: '.claude/skills/answer-comments/SKILL.md', git: 'committed', startsFrom: 'origin/main' } }
    })
    show(host, [GEMSTACK, OTHER])
    const gemstack = await screen.findByRole('region', { name: 'gemstack' })
    const mine = row('/answer-comments')
    fireEvent.click(within(mine).getByRole('button', { name: 'Remove /answer-comments' }))
    const asked = within(mine).getByRole('group', { name: 'Removing /answer-comments' })
    expect(asked.textContent).toContain('Remove /answer-comments?')
    expect(asked.textContent).toContain('Its skill file is deleted from your files in this project, and nothing is committed for you. Git can bring back only what you committed of it: a file never committed, or your last changes to it, cannot be brought back. Everyone else who has the project keeps the row until your deletion reaches them.')
    // The keyboard lands on the way out, and the row's other buttons wait.
    expect(document.activeElement).toBe(within(asked).getByRole('button', { name: 'Cancel' }))
    expect(within(mine).queryByRole('button', { name: 'Edit /answer-comments' })).toBeNull()
    expect(within(mine).queryByRole('button', { name: 'Edit the prompt of /answer-comments' })).toBeNull()
    fireEvent.click(within(asked).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Removing /answer-comments' })).toBeNull()
    fireEvent.click(within(mine).getByRole('button', { name: 'Remove /answer-comments' }))
    fireEvent.keyDown(within(mine).getByRole('group', { name: 'Removing /answer-comments' }), { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Removing /answer-comments' })).toBeNull()
    expect(runCommand.mock.calls.some(([, args]) => args[0] === 'remove')).toBe(false)

    fireEvent.click(within(mine).getByRole('button', { name: 'Remove /answer-comments' }))
    fireEvent.click(within(within(mine).getByRole('group', { name: 'Removing /answer-comments' })).getByRole('button', { name: 'Remove' }))
    const note = await within(gemstack).findByRole('status', { name: 'Removed' })
    expect(runCommand).toHaveBeenCalledWith('p1', ['remove', 'answer-comments'])
    expect(screen.getAllByRole('status', { name: 'Removed' }).length, 'said in the project it was removed from, and in no other').toBe(1)
    expect(note.textContent).toContain('Removed /answer-comments: .claude/skills/answer-comments/SKILL.md is deleted, and nothing was committed for you. Commit the deletion and bring it to origin/main: until then everyone else who has the project keeps the row.')
    expect(screen.queryByRole('listitem', { name: '/answer-comments' })).toBeNull()
    expect(row('tidy')).toBeTruthy()
    fireEvent.click(within(note).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('status', { name: 'Removed' })).toBeNull()
  })

  test('removing an automation kept on this machine says first that it cannot be brought back; a removal that is refused says why on the row, which stays', async () => {
    const answers: ModuleCommandResult[] = [
      { ok: false, error: '.agent-scheduler/automations/tidy.md was changed by hand since it was saved: edit or remove the file itself' },
      { ok: true, output: { ok: true, command: 'tidy', file: '.agent-scheduler/automations/tidy.md', onThisMachine: true } },
    ]
    const { host, runCommand } = hostAnswering((_, args) => (args[0] === 'status' ? { ok: true, output: MINE } : answers.shift()!))
    show(host)
    await screen.findByRole('region', { name: 'gemstack' })
    const kept = row('tidy')
    fireEvent.click(within(kept).getByRole('button', { name: 'Remove tidy' }))
    const asked = within(kept).getByRole('group', { name: 'Removing tidy' })
    expect(asked.textContent).toContain('Remove tidy?')
    expect(asked.textContent).toContain('Its file is deleted. It is kept on this machine alone, outside git, so it cannot be brought back.')
    fireEvent.click(within(asked).getByRole('button', { name: 'Remove' }))
    expect((await within(kept).findByRole('alert')).textContent).toBe('It was not removed: .agent-scheduler/automations/tidy.md was changed by hand since it was saved: edit or remove the file itself')
    expect(runCommand).toHaveBeenCalledWith('p1', ['remove', 'tidy'])
    expect(row('tidy')).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Removed' })).toBeNull()
    // Removed, while a tick that was under way still lists it for a moment: the question is closed, so the row does not come back asking.
    fireEvent.click(within(within(kept).getByRole('group', { name: 'Removing tidy' })).getByRole('button', { name: 'Remove' }))
    expect((await screen.findByRole('status', { name: 'Removed' })).textContent).toContain('Removed tidy: .agent-scheduler/automations/tidy.md is deleted. Nothing is to commit.')
    expect(screen.queryByRole('group', { name: 'Removing tidy' })).toBeNull()
    expect(within(row('tidy')).queryByRole('alert')).toBeNull()
  })

  test('a project whose scheduler could not be read offers no "New automation"', async () => {
    const { host } = hostAnswering(() => ({ ok: false, error: 'no such command' }))
    show(host)
    await screen.findByText('The scheduler could not be read: no such command')
    expect(screen.queryByRole('button', { name: /New automation/ })).toBeNull()
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
