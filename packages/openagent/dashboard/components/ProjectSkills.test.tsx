import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ProjectSkills } from '../rpc/skills.js'

const onProjectSkills = vi.hoisted(() => vi.fn())
const sendChangeSkills = vi.hoisted(() => vi.fn())
const sendCommitSkills = vi.hoisted(() => vi.fn())
vi.mock('../rpc/skills.js', () => ({ onProjectSkills, sendChangeSkills, sendCommitSkills }))

const { ProjectSkillsLine } = await import('./ProjectSkills.js')

afterEach(() => {
  cleanup()
  onProjectSkills.mockReset()
  sendChangeSkills.mockReset()
  sendCommitSkills.mockReset()
})

type Standing = ProjectSkills['groups'][number]['skills'][number]['standing']
const skill = (name: string, standing: Standing = 'absent', waiting = false) => ({ name, description: `What ${name} does.`, standing, waiting })

/** A project's skills as the daemon answers them; `over` changes the parts a test is about. */
function skills(over: Partial<ProjectSkills> = {}): ProjectSkills {
  return {
    has: 3,
    of: 25,
    groups: [
      { title: 'Tickets and queue', ticked: true, skills: [skill('tickets'), skill('queue')] },
      { title: 'Needs its own setup', ticked: false, skills: [skill('browser')] },
    ],
    scheduler: false,
    startBranch: 'main',
    uncommitted: 0,
    git: true,
    ...over,
  }
}

const box = (name: string): HTMLElement => screen.getByRole('checkbox', { name })
const isTicked = (name: string): boolean => box(name).getAttribute('aria-checked') === 'true'

describe('ProjectSkillsLine', () => {
  test('says how many skills the project has, and nothing more when there is nothing to do', async () => {
    onProjectSkills.mockResolvedValue(skills())
    render(<ProjectSkillsLine projectId="p1" />)
    expect(await screen.findByText(/This project has 3 of 25 skills\./)).toBeTruthy()
    expect(onProjectSkills).toHaveBeenCalledWith('p1')
    expect(screen.getByRole('button', { name: 'Add skills' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Commit' })).toBeNull()
    expect(screen.queryByText(/waiting to reach/)).toBeNull()
  })

  test('a project that is unknown here shows no line', async () => {
    onProjectSkills.mockResolvedValue(null)
    const { container } = render(<ProjectSkillsLine projectId="gone" />)
    await waitFor(() => expect(onProjectSkills).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  test('a newer text is told, and Update writes those skills again and nothing else', async () => {
    onProjectSkills.mockResolvedValue(
      skills({ has: 6, groups: [{ title: 'Tickets and queue', ticked: true, skills: [skill('tickets', 'newer'), skill('queue', 'newer'), skill('plan', 'changed')] }] }),
    )
    sendChangeSkills.mockResolvedValue({ ok: true, written: ['tickets', 'queue'], removed: [], left: [] })
    const onChanged = vi.fn()
    render(<ProjectSkillsLine projectId="p1" onChanged={onChanged} />)
    expect(await screen.findByText(/2 skills have a newer text\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(sendChangeSkills).toHaveBeenCalledWith('p1', { write: ['tickets', 'queue'] }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })

  test('files not committed are told, Commit commits them, and the line then says nothing was pushed', async () => {
    onProjectSkills.mockResolvedValueOnce(skills({ has: 4, uncommitted: 2 })).mockResolvedValue(skills({ has: 4, uncommitted: 0 }))
    sendCommitSkills.mockResolvedValue({ ok: true, committed: true, commit: 'abc1234' })
    render(<ProjectSkillsLine projectId="p1" />)
    expect(await screen.findByText(/2 skill files are not committed\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    await waitFor(() => expect(sendCommitSkills).toHaveBeenCalledWith('p1'))
    expect(await screen.findByText('Committed as abc1234. Nothing was pushed.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Commit' })).toBeNull()
  })

  test('a commit that is refused says why and keeps the button', async () => {
    onProjectSkills.mockResolvedValue(skills({ uncommitted: 1 }))
    sendCommitSkills.mockResolvedValue({ ok: false, error: 'git ignores .claude/skills/tickets: an ignore rule of this project, or of yours, covers it' })
    render(<ProjectSkillsLine projectId="p1" />)
    expect(await screen.findByText(/1 skill file is not committed\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    expect(await screen.findByText(/git ignores \.claude\/skills\/tickets/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Commit' })).toBeTruthy()
  })

  test('skills in the folder that are not yet on the branch agents start from are named as waiting', async () => {
    onProjectSkills.mockResolvedValue(skills({ has: 5, groups: [{ title: 'Tickets and queue', ticked: true, skills: [skill('tickets', 'current', true), skill('queue', 'current', true), skill('plan', 'current')] }] }))
    const { container } = render(<ProjectSkillsLine projectId="p1" />)
    await screen.findByText(/This project has 5 of 25 skills\./)
    expect(container.textContent).toContain('tickets, queue: waiting to reach main. An agent started now does not have them.')
  })

  test('many waiting skills are counted, not named', async () => {
    onProjectSkills.mockResolvedValue(skills({ has: 8, groups: [{ title: 'Tickets and queue', ticked: true, skills: ['tickets', 'queue', 'plan', 'triage', 'ux'].map(name => skill(name, 'current', true)) }] }))
    const { container } = render(<ProjectSkillsLine projectId="p1" />)
    await screen.findByText(/This project has 8 of 25 skills\./)
    expect(container.textContent).toContain('5 skills: waiting to reach main. An agent started now does not have them.')
  })
})

describe('Add skills', () => {
  test('in a project with no skills yet the default picks are ticked: every group but the one that needs a setup of its own, and the scheduler', async () => {
    onProjectSkills.mockResolvedValue(skills())
    sendChangeSkills.mockResolvedValue({ ok: true, written: ['tickets', 'queue'], removed: [], left: [] })
    const onChanged = vi.fn()
    render(<ProjectSkillsLine projectId="p1" onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add skills' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tickets and queue')).toBeTruthy()
    expect(within(dialog).getByText('What tickets does.')).toBeTruthy()
    expect([isTicked('tickets'), isTicked('queue'), isTicked('browser'), isTicked('scheduler')]).toEqual([true, true, false, true])
    expect(within(dialog).getByText('2 skills to write, the scheduler on.')).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sendChangeSkills).toHaveBeenCalledWith('p1', { write: ['tickets', 'queue'], remove: [], scheduler: true }))
    expect(await within(dialog).findByText(/Wrote 2 skills in/)).toBeTruthy()
    expect(dialog.textContent).toContain('tickets, queue')
    expect(dialog.textContent).toContain('Your agents get these skills once they are on main.')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  test('opened again the ticks show what the project has; a tick removed deletes, a tick added writes, and the scheduler is left alone', async () => {
    onProjectSkills.mockResolvedValue(
      skills({ has: 5, groups: [{ title: 'Tickets and queue', ticked: true, skills: [skill('tickets', 'current'), skill('queue', 'changed'), skill('plan')] }, { title: 'Needs its own setup', ticked: false, skills: [skill('browser')] }] }),
    )
    sendChangeSkills.mockResolvedValue({ ok: true, written: ['browser'], removed: ['tickets'], left: [{ path: '.agents/skills/tickets', reason: 'it holds other files' }] })
    render(<ProjectSkillsLine projectId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add skills' }))
    const dialog = await screen.findByRole('dialog')
    expect([isTicked('tickets'), isTicked('queue'), isTicked('plan'), isTicked('browser'), isTicked('scheduler')]).toEqual([true, true, false, false, false])
    expect(dialog.textContent).toContain('queue (changed by hand)')
    expect(within(dialog).getByText('Nothing to change.')).toBeTruthy()
    expect((within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(box('tickets'))
    fireEvent.click(box('browser'))
    expect(within(dialog).getByText('1 skill to write, 1 skill to delete.')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sendChangeSkills).toHaveBeenCalledWith('p1', { write: ['browser'], remove: ['tickets'] }))
    expect(await within(dialog).findByText(/Deleted 1 skill/)).toBeTruthy()
    expect(dialog.textContent).toContain('Left as it is: .agents/skills/tickets (it holds other files).')
  })

  test('after a save the commit is offered: one press commits the files, and the screen says nothing was pushed', async () => {
    onProjectSkills.mockResolvedValue(skills())
    sendChangeSkills.mockResolvedValue({ ok: true, written: ['tickets', 'queue'], removed: [], left: [] })
    sendCommitSkills.mockResolvedValue({ ok: true, committed: true, commit: 'abc1234' })
    render(<ProjectSkillsLine projectId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add skills' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText(/not committed\. A commit holds these files alone/)).toBeTruthy()
    expect(sendCommitSkills).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Commit these files' }))
    await waitFor(() => expect(sendCommitSkills).toHaveBeenCalledWith('p1'))
    expect(await within(dialog).findByText(/Committed as abc1234, these files alone\. Nothing was pushed/)).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Commit these files' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  test('a save that is refused says why and keeps the list; Cancel writes nothing; a folder that is no repository is offered no commit', async () => {
    onProjectSkills.mockResolvedValue(skills({ git: false, startBranch: undefined }))
    sendChangeSkills.mockResolvedValueOnce({ ok: false, error: 'EACCES: permission denied' }).mockResolvedValue({ ok: true, written: ['tickets', 'queue'], removed: [], left: [], schedulerError: 'hooks.yml: unreadable' })
    render(<ProjectSkillsLine projectId="p1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add skills' }))
    let dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('EACCES: permission denied')).toBeTruthy()
    expect(box('tickets')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sendChangeSkills).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Add skills' }))
    dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('This folder is not a git repository, so there is nothing to commit.')).toBeTruthy()
    expect(dialog.textContent).toContain('The scheduler could not be switched: hooks.yml: unreadable')
    expect(within(dialog).queryByRole('button', { name: 'Commit these files' })).toBeNull()
    expect(dialog.textContent).not.toContain('Your agents get these skills')
  })
})
