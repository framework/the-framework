import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { AgentWorktree, FrameworkEvent } from '../../src/index.js'

// The menu reads the daemon and has tests of its own: here it only has to be in the bar. The
// name and the checkout's facts are drawn for real, so what the bar leaves out is checked on
// what is really on screen.
vi.mock('./AgentActionsMenu.js', () => ({ AgentActionsMenu: () => <button type="button">Agent actions</button> }))
const onGitStatus = vi.fn(async () => null as unknown)
const onAgentWorktree = vi.fn(async () => null as unknown)
vi.mock('../rpc/reads.js', () => ({ onGitStatus, onAgentWorktree }))

const { AgentActionBar } = await import('./AgentActionBar.js')
const { GitStatusBar } = await import('./GitStatusBar.js')

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

const session = { kind: 'session', driver: 'claude-code', workspace: '/w' }
const said = { kind: 'driver', event: { type: 'text', text: 'working' } }
const reason = "codex exited (1): You've hit your usage limit."
const AGENTS = {
  running: [session, said],
  finished: [session, said, { kind: 'end', ok: true }],
  failed: [session, said, { kind: 'end', ok: false, detail: reason }],
  stopped: [session, said, { kind: 'end', ok: false, stopped: true }],
  'waiting for an answer': [session, said, { kind: 'end', ok: false, waiting: true }],
} as unknown as Record<string, FrameworkEvent[]>
const DIRTY: AgentWorktree = { checkout: { path: '/w', dirty: true, sizeBytes: 5 * 1024 * 1024 }, branch: 'agent-dark-mode', pr: { number: 7, url: 'https://github.com/o/r/pull/7', state: 'OPEN', title: 'Dark mode' } }

describe('AgentActionBar', () => {
  test.each(Object.keys(AGENTS))('a %s agent with a dirty checkout: the project, the name, the size and the menu, no status word and no clean or dirty', kind => {
    const { container } = render(<AgentActionBar projectId="p1" agentId="run-1" events={AGENTS[kind]!} label="Dark mode" projectName="gemstack" checkout={DIRTY} />)
    // All the bar says, word for word: nothing of the agent's state, of its tree, of its branch.
    expect(container.textContent).toBe('gemstack›Dark mode5 MBAgent actions')
    expect(screen.getByRole('button', { name: 'Agent actions' })).toBeTruthy()
    expect(onAgentWorktree).not.toHaveBeenCalled()
  })

  test('the count of errors is still said, for a running agent and for one that ended', () => {
    const error = { kind: 'error', message: 'The push was rejected' }
    for (const kind of ['running', 'finished', 'stopped']) {
      const { container } = render(<AgentActionBar projectId="p1" agentId="run-1" events={[...AGENTS[kind]!.slice(0, 2), error, ...AGENTS[kind]!.slice(2)] as FrameworkEvent[]} label="Dark mode" checkout={DIRTY} />)
      expect(screen.getByRole('alert').textContent).toBe('1 error')
      expect(container.textContent).toBe('Dark mode5 MB1 errorAgent actions')
      cleanup()
    }
  })

  test('before the agent’s own reads have answered, the name and the menu alone', () => {
    const { container } = render(<AgentActionBar projectId="p1" agentId="run-1" events={AGENTS.failed!} label="Dark mode" checkout={DIRTY} ready={false} />)
    expect(container.textContent).toBe('Dark modeAgent actions')
  })

  test('the name opens the detail under the bar', () => {
    const onToggle = vi.fn()
    render(<AgentActionBar projectId="p1" agentId="run-1" events={AGENTS.finished!} label="Dark mode" checkout={DIRTY} onToggle={onToggle} />)
    const name = screen.getByRole('button', { name: /Dark mode/ })
    expect(name.getAttribute('aria-expanded')).toBe('false')
    name.click()
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test("the project's own bar still says its branch, clean or dirty, and its pull request", () => {
    const pr = { number: 7, url: 'https://github.com/o/r/pull/7', state: 'OPEN', title: 'Dark mode' }
    const { container } = render(<GitStatusBar projectId="p1" inline checkout={{ branch: 'main', dirty: true, pr }} />)
    expect(container.textContent).toBe('maindirtyPR #7open')
  })
})
