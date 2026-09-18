import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// Everything the form reads goes through a lib module, so the mocks stop at the `rpc/` stubs: an
// unmocked one reaches for `/_rpc/<name>`, and there is no daemon behind jsdom to answer.
const onCommands = vi.hoisted(() => vi.fn())
const onStartCheck = vi.hoisted(() => vi.fn())
const onProjects = vi.hoisted(() => vi.fn(async () => [] as unknown[]))
vi.mock('../rpc/projects.js', () => ({ onCommands, onStartCheck, onProjects }))

// Mutable so a test can pick the coding agent and the model; reset after each.
const prefs = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
const updatePreferences = vi.hoisted(() => vi.fn())
vi.mock('../lib/preferences.js', () => ({ usePreferences: () => prefs.current, updatePreferences }))
const device = vi.hoisted(() => ({ current: null as null | { id: string; url: string; token: string; label: string } }))
vi.mock('../lib/profiles.js', () => ({ useConnectionProfiles: () => (device.current ? [device.current] : []) }))
vi.mock('../lib/remote-target.js', () => ({ useSelectedRemoteDeviceId: () => device.current?.id ?? null }))

const start = vi.hoisted(() => vi.fn())
vi.mock('../lib/use-start-agent.js', async () => ({
  ...(await vi.importActual<typeof import('../lib/use-start-agent.js')>('../lib/use-start-agent.js')),
  useStartAgent: () => ({ busy: false, error: null, reset: vi.fn(), start }),
}))

// The Composer is exercised by its own tests; here it hands back a typed submit, shows whether
// the form lets it submit at all, and renders the launcher's controls.
vi.mock('./Composer.js', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  const Composer = forwardRef((props: any, ref: any) => {
    useImperativeHandle(ref, () => ({
      clear: () => {},
      focus: () => {},
    }))
    return (
      <>
        {props.launcherControls}
        <button type="button" disabled={!props.canSubmit} onClick={() => props.onSubmit('do the thing')}>
          submit-typed
        </button>
      </>
    )
  })
  return { Composer }
})

const { StartAgentForm } = await import('./StartAgentForm.js')

// No check hook unless a test gives one: nothing to say.
beforeEach(() => {
  onStartCheck.mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
  start.mockReset()
  onCommands.mockReset()
  onStartCheck.mockReset()
  updatePreferences.mockReset()
  prefs.current = {}
  device.current = null
})

const COMMANDS = [{ name: 'work-queue', description: 'Work the agent queue' }]
const noop = () => {}
const props = { projectId: 'p1', files: [], context: new Set<string>(), addContext: noop, removeContext: noop, toggleContext: noop }

describe('StartAgentForm (#1774)', () => {
  test('the project\'s commands are no buttons: they are in the box\'s `/` list, and nothing starts', async () => {
    onCommands.mockResolvedValue({ commands: COMMANDS, startHook: true })
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onCommands).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: '/work-queue' })).toBeNull()
    expect(start).not.toHaveBeenCalled()
  })

  test('Start hands the picked coding agent and model to the start hook, and selects the run it answers', async () => {
    onCommands.mockResolvedValue({ commands: [], startHook: true })
    prefs.current = { driver: 'codex', model: 'gpt-5' }
    start.mockResolvedValue({ agentId: 'r1' })
    const onAgentStarted = vi.fn()
    render(<StartAgentForm {...props} onAgentStarted={onAgentStarted} />)
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(onAgentStarted).toHaveBeenCalledWith('do the thing', 'r1', undefined))
    expect(start).toHaveBeenCalledWith('p1', 'do the thing', { driver: 'codex', model: 'gpt-5' })
  })

  test('a project with the post-merge-cleanup command shows the box; ticked, the start carries the command as the follow-up', async () => {
    onCommands.mockResolvedValue({ commands: [...COMMANDS, { name: 'post-merge-cleanup' }], startHook: true })
    prefs.current = { postMergeCleanup: true }
    start.mockResolvedValue({ agentId: 'r1' })
    render(<StartAgentForm {...props} />)
    const box = await screen.findByRole('checkbox', { name: 'Post-merge cleanup' })
    expect(box.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(start).toHaveBeenCalledWith('p1', 'do the thing', { then: '/post-merge-cleanup' }))

    // The box writes the saved setting, the one Settings shows: every next run's default.
    fireEvent.click(box)
    expect(updatePreferences).toHaveBeenCalledWith({ postMergeCleanup: false })
  })

  test('without the command there is no box, and a saved setting sends nothing; unticked, nothing either', async () => {
    onCommands.mockResolvedValue({ commands: COMMANDS, startHook: true })
    prefs.current = { postMergeCleanup: true }
    start.mockResolvedValue({ agentId: 'r1' })
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onCommands).toHaveBeenCalled())
    expect(screen.queryByRole('checkbox', { name: 'Post-merge cleanup' })).toBeNull()
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(start).toHaveBeenCalledWith('p1', 'do the thing', {}))
    cleanup()

    start.mockClear()
    onCommands.mockResolvedValue({ commands: [{ name: 'post-merge-cleanup' }], startHook: true })
    prefs.current = {}
    render(<StartAgentForm {...props} />)
    const box = await screen.findByRole('checkbox', { name: 'Post-merge cleanup' })
    expect(box.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(start).toHaveBeenCalledWith('p1', 'do the thing', {}))
  })

  test('no pick made: neither is sent, so the hook decides', async () => {
    onCommands.mockResolvedValue({ commands: [], startHook: true })
    start.mockResolvedValue({ agentId: 'r1' })
    render(<StartAgentForm {...props} />)
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(start).toHaveBeenCalledWith('p1', 'do the thing', {}))
  })

  test('a project with no start hook cannot start: the submit is off and the form says what to add', async () => {
    onCommands.mockResolvedValue({ commands: [], startHook: false })
    render(<StartAgentForm {...props} />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('This project has no start hook. Run npx agent-scheduler init in the project, or add a start: line to .the-framework/hooks.yml.')
    expect((screen.getByText('submit-typed') as HTMLButtonElement).disabled).toBe(true)
  })

  test('before the project is read, and with a start hook, nothing is said and the submit is on', async () => {
    onCommands.mockResolvedValue({ commands: [], startHook: true })
    render(<StartAgentForm {...props} />)
    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(onCommands).toHaveBeenCalledWith('p1'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect((screen.getByText('submit-typed') as HTMLButtonElement).disabled).toBe(false)
  })

  test('a picked device runs its own start hook: the start carries it, and this project\'s missing hook does not block', async () => {
    onCommands.mockResolvedValue({ commands: [], startHook: false })
    device.current = { id: 'd1', url: 'http://box:4200', token: 't', label: 'box' }
    start.mockResolvedValue({ agentId: 'r2' })
    const onAgentStarted = vi.fn()
    render(<StartAgentForm {...props} onAgentStarted={onAgentStarted} />)
    await waitFor(() => expect(onCommands).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(onAgentStarted).toHaveBeenCalledWith('do the thing', 'r2', 'box'))
    expect(start).toHaveBeenCalledWith('p1', 'do the thing', { remote: { url: 'http://box:4200', token: 't', label: 'box' } })
    expect(onStartCheck).not.toHaveBeenCalled()
  })

  test('what would stop the run is said before the Start, for the coding agent picked; a warning is said too, and neither turns Start off', async () => {
    onCommands.mockResolvedValue({ commands: [], startHook: true })
    prefs.current = { driver: 'codex' }
    onStartCheck.mockResolvedValue({ problems: ['`codex` is not logged in. Run `codex login`, then start again.'], warnings: ['`gh` is not logged in.'] })
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(onStartCheck).toHaveBeenCalledWith('p1', 'codex')
    const [problem, warning] = screen.getAllByRole('alert')
    expect(problem!.textContent).toBe('`codex` is not logged in. Run `codex login`, then start again.')
    expect(problem!.className).toContain('text-danger')
    expect(warning!.className).toContain('text-warning')
    expect((screen.getByText('submit-typed') as HTMLButtonElement).disabled).toBe(false)
  })

  test('the picked Context rides the prompt as one line at its end, after the command\'s own words', async () => {
    onCommands.mockResolvedValue({ commands: [], startHook: true })
    start.mockResolvedValue({ agentId: 'r1' })
    render(<StartAgentForm {...props} context={new Set(['/repos/other', 'src/app.ts'])} />)
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(start).toHaveBeenCalledWith('p1', 'do the thing\n\nContext: /repos/other, src/app.ts', {}))
  })
})
