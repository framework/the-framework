import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// Everything the form reads goes through a lib module, so the mocks stop at the `rpc/` stubs: an
// unmocked one reaches for `/_rpc/<name>`, and there is no daemon behind jsdom to answer.
const onProjects = vi.hoisted(() => vi.fn())
const onClaudeTrust = vi.hoisted(() => vi.fn())
const onDriverReady = vi.hoisted(() => vi.fn())
const onRepoAutoMerge = vi.hoisted(() => vi.fn())
vi.mock('../rpc/projects.js', () => ({ onProjects, onClaudeTrust, onDriverReady, onRepoAutoMerge }))

const onSystemPromptUser = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onSystemPromptUser }))

// Mutable so a test can pick the agent target (#1318); reset to Global defaults after each.
const prefs = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => prefs.current,
  updatePreferences: vi.fn(),
}))
vi.mock('../lib/profiles.js', () => ({ useConnectionProfiles: () => [] }))
vi.mock('../lib/remote-target.js', () => ({ useSelectedRemoteDeviceId: () => null }))

const start = vi.hoisted(() => vi.fn())
vi.mock('../lib/use-start-agent.js', () => ({
  useStartAgent: () => ({ busy: false, error: null, reset: vi.fn(), start }),
}))

// The Composer is exercised by its own tests; here it only has to hand back the two submit
// kinds its contract defines: 'build' for a typed prompt, 'prompt' once a preset was loaded.
vi.mock('./Composer.js', async () => {
  const { forwardRef } = await import('react')
  const Composer = forwardRef((props: any, _ref: any) => (
    <div>
      <button type="button" onClick={() => props.onSubmit('do the thing', 'build', { newAgent: false })}>
        submit-typed
      </button>
      <button type="button" onClick={() => props.onSubmit('preset text', 'prompt', { newAgent: false })}>
        submit-preset
      </button>
    </div>
  ))
  return { Composer }
})
vi.mock('./ContextMenu.js', () => ({ ContextMenu: () => null }))
vi.mock('./SystemPromptDisclosure.js', () => ({ SystemPromptDisclosure: () => null }))

const { StartAgentForm } = await import('./StartAgentForm.js')

// A ready agent by default (#1326), so every other test renders the form it means to test
// rather than the "your CLI cannot start an agent" warning.
beforeEach(() => {
  onDriverReady.mockResolvedValue({ ok: true, problems: [], warnings: [] })
})

afterEach(() => {
  cleanup()
  start.mockReset()
  onClaudeTrust.mockReset()
  onDriverReady.mockReset()
  onRepoAutoMerge.mockReset()
  prefs.current = {}
})

const props = {
  projectId: 'p1',
  files: [],
  context: new Set<string>(),
  addContext: () => {},
  removeContext: () => {},
  toggleContext: () => {},
}

describe('StartAgentForm submit (#1279)', () => {
  test('a preset run starts unattended, so it ends at settle and its handoff fires', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    start.mockResolvedValue({ agentId: 'r1' })
    render(<StartAgentForm {...props} />)
    fireEvent.click(screen.getByText('submit-preset'))
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0]![2]).toBe('prompt')
    expect(start.mock.calls[0]![3]).toMatchObject({ unattended: true })
  })

  test('a typed prompt stays attended: the stay-open chat (#714) is for conversations', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    start.mockResolvedValue({ agentId: 'r1' })
    render(<StartAgentForm {...props} />)
    fireEvent.click(screen.getByText('submit-typed'))
    await waitFor(() => expect(start).toHaveBeenCalled())
    expect(start.mock.calls[0]![2]).toBe('build')
    expect(start.mock.calls[0]![3]).not.toHaveProperty('unattended')
  })
})

describe('StartAgentForm web-run trust warning (#1318)', () => {
  test('an untrusted project warns before a web run, naming the root (#1314)', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    prefs.current = { target: 'web' }
    onClaudeTrust.mockResolvedValue({ known: true, trusted: false, root: '/repo' })
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(screen.getByText(/has not been trusted/)).toBeTruthy())
    expect(screen.getByText('/repo')).toBeTruthy()
  })

  test('a trusted project, an unknown answer, or a local target shows no warning', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)

    prefs.current = { target: 'web' }
    onClaudeTrust.mockResolvedValue({ known: true, trusted: true, root: '/repo' })
    const trusted = render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onClaudeTrust).toHaveBeenCalled())
    expect(screen.queryByText(/has not been trusted/)).toBeNull()
    trusted.unmount()

    // Config unreadable: do not cry wolf — the agent's own failure advice is the fallback.
    onClaudeTrust.mockResolvedValue({ known: false, trusted: false, root: '/repo' })
    const unknown = render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onClaudeTrust).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(/has not been trusted/)).toBeNull()
    unknown.unmount()

    // A local agent never asks the question at all.
    prefs.current = {}
    onClaudeTrust.mockClear()
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onProjects).toHaveBeenCalled())
    expect(onClaudeTrust).not.toHaveBeenCalled()
    expect(screen.queryByText(/has not been trusted/)).toBeNull()
  })
})

describe('StartAgentForm agent preflight warning (#1326)', () => {
  // #1323: every session died before writing agent.json and the only visible trace was run
  // branches piling up. The launcher says why before the Start, the way #1318 does for trust.
  test('a logged-out agent is named in the launcher, with the command that fixes it', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    onDriverReady.mockResolvedValue({
      ok: false,
      problems: ['claude auth: `claude` is not logged in. Run `claude auth login`, then start the session again.'],
      warnings: [],
    })
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(screen.getByText(/is not logged in/)).toBeTruthy())
    expect(screen.getByText(/claude auth login/)).toBeTruthy()
  })

  test('a root daemon warns without claiming the start will fail', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    onDriverReady.mockResolvedValue({
      ok: true,
      problems: [],
      warnings: ['running as root, so the agent looks for credentials under root’s home and will not find yours.'],
    })
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(screen.getByText(/running as root/)).toBeTruthy())
  })

  test('a ready agent shows nothing at all', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onDriverReady).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  test('the agent is re-probed when the picked agent changes, since the answer is per CLI', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    const first = render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onDriverReady).toHaveBeenCalledWith('claude', true))
    first.unmount()

    prefs.current = { driver: 'codex' }
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onDriverReady).toHaveBeenCalledWith('codex', true))
  })

  // #1419: the handoff opens and merges PRs through `gh`, so a launcher with those rungs armed
  // asks the preflight for the gh half too — and only then, so a push-only or publish-nothing
  // launcher cannot warn about a CLI its session will never call.
  test('the gh half is requested only while a PR or merge rung is armed (#1419)', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    prefs.current = { handoff: 'push' }
    const pushOnly = render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onDriverReady).toHaveBeenCalledWith('claude', false))
    pushOnly.unmount()

    prefs.current = { handoff: 'pr' }
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onDriverReady).toHaveBeenCalledWith('claude', true))
  })

  test('an actions run is not gated on a local CLI it never uses', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    prefs.current = { target: 'actions' }
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onProjects).toHaveBeenCalled())
    expect(onDriverReady).not.toHaveBeenCalled()
  })
})

describe('StartAgentForm Haiku warning (#1439)', () => {
  test('picking Haiku warns — never blocks — and teaches the stronger default', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    prefs.current = { model: 'haiku' }
    render(<StartAgentForm {...props} />)
    const alert = await screen.findByText(/Haiku consistently skips the session-finish protocol/)
    expect(alert.getAttribute('role')).toBe('alert')
    // The submit path is untouched: the warning teaches, it does not gate.
    expect(screen.getByText('submit-typed')).toBeTruthy()
  })

  test('any other model shows no Haiku warning', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    prefs.current = { model: 'fable' }
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onProjects).toHaveBeenCalled())
    expect(screen.queryByText(/session-finish protocol/)).toBeNull()
  })
})

describe('StartAgentForm auto-merge-disabled notice (#1417)', () => {
  test('an armed merge on a repo that refuses auto-merge notes the merge-on-green fallback, without blocking', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    prefs.current = { handoff: 'merge' }
    onRepoAutoMerge.mockResolvedValue({ known: true, allowed: false })
    render(<StartAgentForm {...props} />)
    expect(await screen.findByText(/auto-merge disabled/)).toBeTruthy()
    // The daemon's CI watch covers the merge (same "merge on green" wording as the terminal),
    // and the notice still names the server-side setup.
    expect(screen.getByText(/merge on green/)).toBeTruthy()
    expect(screen.getByText(/Allow auto-merge/)).toBeTruthy()
    // Never a block: the submit path stays untouched.
    expect(screen.getByText('submit-typed')).toBeTruthy()
  })

  test('a repo that allows auto-merge, or one gh cannot speak for, shows no notice', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)

    prefs.current = { handoff: 'merge' }
    onRepoAutoMerge.mockResolvedValue({ known: true, allowed: true })
    const allowed = render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onRepoAutoMerge).toHaveBeenCalled())
    expect(screen.queryByText(/auto-merge disabled/)).toBeNull()
    allowed.unmount()

    // "Could not say" is not "off" — no crying wolf (#1318 stance).
    onRepoAutoMerge.mockResolvedValue({ known: false, allowed: false })
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onRepoAutoMerge).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(/auto-merge disabled/)).toBeNull()
  })

  test('an unarmed merge never asks the question at all', async () => {
    onProjects.mockResolvedValue([])
    onSystemPromptUser.mockResolvedValue(null)
    render(<StartAgentForm {...props} />)
    await waitFor(() => expect(onProjects).toHaveBeenCalled())
    expect(onRepoAutoMerge).not.toHaveBeenCalled()
  })
})
