import type { ReactElement } from 'react'
import type { RunMeta, ProjectSummary } from '@gemstack/the-framework'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SidebarProvider } from './ui/sidebar.js'
import { hoverTooltip } from '../test-utils.js'

// RunHistory pulls in AddProjectPanel, which imports the projects telefunc shim; stub it so the
// import graph does not drag telefunc into jsdom. Import RunHistory after the mock is in place.
// Resolves to an empty list: AddProjectPanel (reachable from the rail) reads projects on demand.
const onProjects = vi.hoisted(() => vi.fn(() => Promise.resolve([])))
const sendAddProject = vi.hoisted(() => vi.fn())
vi.mock('../server/projects.telefunc.js', () => ({ onProjects, sendAddProject }))

// The rail now also carries the app chrome moved off the top navbar (#772 follow-up). Three of
// those pull the preferences/devices telefunc shims into jsdom, which this suite deliberately
// avoids. It is about the runs list, not the chrome (each has its own suite), so stub them out.
vi.mock('./ThemeToggle.js', () => ({ ThemeToggle: () => null }))
vi.mock('./NotificationsMenu.js', () => ({ NotificationsMenu: () => null }))
vi.mock('./ConnectionIndicator.js', () => ({ ConnectionIndicator: () => null }))

const { RunHistory } = await import('./RunHistory.js')

afterEach(cleanup)

function run(over: Partial<RunMeta> = {}): RunMeta {
  return {
    version: 1,
    status: 'running',
    id: 'run-1',
    startedAt: '2026-07-19T16:05:44.756Z',
    updatedAt: '2026-07-19T16:06:21.000Z',
    passes: 1,
    intent: "replace 'Hello, world!' with 'Welcome!'",
    ...over,
  }
}

// RunHistory renders the shadcn <Sidebar>, which reads SidebarProvider context; wrap every render.
const renderRail = (ui: ReactElement) => render(<SidebarProvider>{ui}</SidebarProvider>)

describe('RunHistory (#785)', () => {
  test('a working run reads as running and animates', () => {
    const { container } = renderRail(<RunHistory projectId="p1" runs={[run()]} selectedRunId={null} onSelect={() => {}} />)
    expect(screen.getByText('running')).toBeTruthy()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  test('a run parked on the user reads as waiting and stops animating', () => {
    // The build settled and it is waiting for a message: same live process, different meaning.
    const { container } = renderRail(
      <RunHistory projectId="p1" runs={[run({ settledAt: '2026-07-19T16:06:21.000Z' })]} selectedRunId={null} onSelect={() => {}} />,
    )
    expect(screen.getByText('waiting')).toBeTruthy()
    expect(screen.queryByText('running')).toBeNull()
    expect(container.querySelector('.animate-pulse')).toBeNull()
  })

  test('an ended run armed to publish reads as publishing… until the handoff report folds in (#1455)', () => {
    const publishing = run({ version: 2, status: 'done', handoff: { push: true, pr: true } })
    const { container } = renderRail(
      <RunHistory projectId="p1" runs={[publishing]} selectedRunId={null} onSelect={() => {}} />,
    )
    expect(screen.getByText('publishing…')).toBeTruthy()
    expect(screen.queryByText('done')).toBeNull()
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  test('a run whose handoff reported — and a pre-fold record — read as plain done (#1455)', () => {
    // The reported run's window is closed; the version-1 record predates the fold, so its
    // missing report says nothing and must not read as forever-publishing.
    renderRail(
      <RunHistory
        projectId="p1"
        runs={[
          run({ id: 'run-1', version: 2, status: 'done', handoff: { push: true, pr: true }, handoffReport: 'done' }),
          run({ id: 'run-2', version: 1, status: 'done', handoff: { push: true, pr: true } }),
        ]}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.queryByText('publishing…')).toBeNull()
    expect(screen.getAllByText('done').length).toBe(2)
  })

  test('a session selected before its row lands highlights the starting row (#784)', () => {
    // Start navigates to the run's id right away; its run.json, and so its row, arrives a beat
    // later. The highlight belongs on the optimistic row standing in for it, not on the home row.
    const { container, rerender } = renderRail(
      <RunHistory projectId="p1" runs={[]} selectedRunId={null} onSelect={() => {}} startTick={0} startIntent="" />,
    )
    rerender(
      <SidebarProvider>
        <RunHistory projectId="p1" runs={[]} selectedRunId="run-2" onSelect={() => {}} startTick={1} startIntent="add dark mode" />
      </SidebarProvider>,
    )
    const rows = [...container.querySelectorAll('button')]
    const home = rows.find(row => row.textContent?.trim() === 'New session')
    const starting = rows.find(row => row.textContent?.includes('starting…'))
    expect(starting?.className).toContain('bg-accent')
    expect(home?.className).not.toContain('bg-accent')
  })

  test('the starting row retires when the run it stands in for lands, even if it never ran', () => {
    // The runs list polls every 2s, so a session that starts and fails inside one interval is never
    // once observed `running`. The stand-in used to wait for a running row to hand over to, so it
    // sat beside the finished session's own row claiming a second session was starting, until a
    // 20s deadline swept it. Landing is the handover, whatever status the run landed in.
    const { container, rerender } = renderRail(
      <RunHistory projectId="p1" runs={[]} selectedRunId={null} onSelect={() => {}} startTick={0} startIntent="" />,
    )
    rerender(
      <SidebarProvider>
        <RunHistory projectId="p1" runs={[]} selectedRunId={null} onSelect={() => {}} startTick={1} startIntent="hi" />
      </SidebarProvider>,
    )
    expect([...container.querySelectorAll('button')].some(row => row.textContent?.includes('starting…'))).toBe(true)

    // The poll catches up: the run is already over, and was never seen running.
    rerender(
      <SidebarProvider>
        <RunHistory
          projectId="p1"
          runs={[run({ id: 'run-9', status: 'failed', intent: 'hi' })]}
          selectedRunId={null}
          onSelect={() => {}}
          startTick={1}
          startIntent="hi"
        />
      </SidebarProvider>,
    )
    const rows = [...container.querySelectorAll('button')]
    expect(rows.some(row => row.textContent?.includes('starting…'))).toBe(false)
    expect(rows.some(row => row.textContent?.includes('failed'))).toBe(true)
  })

  test('the starting row survives a run that was already there when Start was clicked', () => {
    // The guard against retiring the stand-in on the wrong evidence: an older session in the list
    // is not the one being waited for, so its presence must not count as the handover.
    const older = run({ id: 'run-old', status: 'done', intent: 'earlier work' })
    const { container, rerender } = renderRail(
      <RunHistory projectId="p1" runs={[older]} selectedRunId={null} onSelect={() => {}} startTick={0} startIntent="" />,
    )
    rerender(
      <SidebarProvider>
        <RunHistory projectId="p1" runs={[older]} selectedRunId={null} onSelect={() => {}} startTick={1} startIntent="hi" />
      </SidebarProvider>,
    )
    expect([...container.querySelectorAll('button')].some(row => row.textContent?.includes('starting…'))).toBe(true)
  })

  test('a finished run is finished, never waiting', () => {
    // settledAt is cleared on `end`, but a stale one must not relabel a terminal status.
    renderRail(
      <RunHistory
        projectId="p1"
        runs={[run({ status: 'done', settledAt: '2026-07-19T16:06:21.000Z' })]}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('done')).toBeTruthy()
    expect(screen.queryByText('waiting')).toBeNull()
  })
})

// The rail is the shadcn Sidebar now (shared shell), a fixed-width in-flow column rather than the
// bespoke collapsing <aside> of #862 — the shadcn Sidebar owns collapse, and the shell never drove
// the old prop, so those strip/float tests are retired with it.
describe('RunHistory rows', () => {
  test('a run on a connected device shows a device glyph naming the device (#1067)', () => {
    renderRail(<RunHistory projectId="p1" runs={[run({ target: 'remote', remoteLabel: 'my-laptop' })]} selectedRunId={null} onSelect={() => {}} />)
    expect(screen.getByLabelText('Runs on my-laptop')).toBeTruthy()
  })

  test('a local run has no device glyph (#1067)', () => {
    renderRail(<RunHistory projectId="p1" runs={[run()]} selectedRunId={null} onSelect={() => {}} />)
    expect(screen.queryByLabelText(/Runs on/)).toBeNull()
  })

  // The shared shell: the rail is present on the home/Overview too (no project selected), showing
  // the New launcher rather than vanishing.
  test('with no project and no recents it still renders New and an empty hint', () => {
    renderRail(<RunHistory projectId={null} runs={[]} recentRuns={[]} selectedRunId={null} onSelect={() => {}} />)
    expect(screen.getByText('New session')).toBeTruthy()
    expect(screen.getByText('No sessions yet.')).toBeTruthy()
  })

  // On the Overview the rail pools every project's sessions; a row names its project and jumps in.
  test('on the Overview it lists cross-project recents and selecting one jumps into its project', () => {
    let picked: [string, string] | null = null
    const recentRuns = [
      { projectId: 'proj-a', projectName: 'alpha', run: run({ id: 'r-a', intent: 'fix login' }) },
      { projectId: 'proj-b', projectName: 'beta', run: run({ id: 'r-b', status: 'done', intent: 'add tests' }) },
    ]
    renderRail(
      <RunHistory
        projectId={null}
        runs={[]}
        recentRuns={recentRuns}
        onSelectRecent={(pid, rid) => (picked = [pid, rid])}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('fix login')).toBeTruthy()
    expect(screen.getByText(/alpha/)).toBeTruthy()
    fireEvent.click(screen.getByText('add tests'))
    expect(picked).toEqual(['proj-b', 'r-b'])
  })
})

const proj = (id: string, name: string): ProjectSummary => ({ id, path: `/${id}`, name, activated: true })

describe('RunHistory New button (#new-button)', () => {
  test('with one project, New starts a session in it', () => {
    let started: string | null = null
    renderRail(
      <RunHistory
        projectId={null}
        runs={[]}
        recentRuns={[]}
        projects={[proj('p1', 'alpha')]}
        onNewSessionInProject={id => (started = id)}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('New session'))
    expect(started).toBe('p1')
  })

  test('inside a project, New starts another session in that project', () => {
    let started: string | null = null
    renderRail(
      <RunHistory
        projectId="p9"
        runs={[]}
        projects={[proj('p1', 'alpha'), proj('p9', 'nine')]}
        onNewSessionInProject={id => (started = id)}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('New session'))
    expect(started).toBe('p9')
  })

  test('with several projects and none selected, New is a picker menu', () => {
    renderRail(
      <RunHistory
        projectId={null}
        runs={[]}
        recentRuns={[]}
        projects={[proj('p1', 'alpha'), proj('p2', 'beta')]}
        onNewSessionInProject={() => {}}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    // The trigger opens a menu rather than starting immediately (aria-haspopup marks it).
    expect(screen.getByLabelText('New session').getAttribute('aria-haspopup')).toBeTruthy()
  })
})

// Tickets: a project's backlog as its own page (#1144), reached from the rail rather than a tab
// in the right sidebar.
describe('RunHistory tickets nav (#1144)', () => {
  test('cross-project like Overview: offered with no project selected, and opens the Tickets view', () => {
    let opened = false
    renderRail(<RunHistory projectId={null} runs={[]} selectedRunId={null} onSelect={() => {}} onTickets={() => (opened = true)} />)
    fireEvent.click(screen.getByText('Tickets'))
    expect(opened).toBe(true)
  })

  test('still offered inside a project, since the view is cross-project either way', () => {
    renderRail(<RunHistory projectId="p1" runs={[]} selectedRunId={null} onSelect={() => {}} onTickets={() => {}} />)
    expect(screen.getByText('Tickets')).toBeTruthy()
  })

  test('carries the active fill while it is the current view, and Overview does not also claim it', () => {
    renderRail(<RunHistory projectId={null} runs={[]} selectedRunId={null} onSelect={() => {}} onTickets={() => {}} ticketsActive />)
    expect(screen.getByText('Tickets').closest('button')?.getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Overview').closest('button')?.getAttribute('aria-current')).not.toBe('page')
  })

  test('not offered when the caller has nowhere to route it', () => {
    renderRail(<RunHistory projectId={null} runs={[]} selectedRunId={null} onSelect={() => {}} />)
    expect(screen.queryByText('Tickets')).toBeNull()
  })
})

describe('cloud sessions on the rail (#1263/#1264)', () => {
  test('a finished web run reads as in cloud, not done: the session is still working over there', () => {
    renderRail(
      <RunHistory
        projectId="p1"
        runs={[run({ status: 'done', target: 'web', driver: 'claude-web' })]}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('in cloud')).toBeTruthy()
    expect(screen.queryByText('done')).toBeNull()
  })

  test('a web run stopped early is just stopped: nothing is working anywhere', () => {
    renderRail(
      <RunHistory
        projectId="p1"
        runs={[run({ status: 'stopped', target: 'web', driver: 'claude-web' })]}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('stopped')).toBeTruthy()
    expect(screen.queryByText('in cloud')).toBeNull()
  })

  test('a web run shows the cloud glyph and still names its agent (#1263)', () => {
    renderRail(
      <RunHistory
        projectId="p1"
        runs={[run({ status: 'done', target: 'web', driver: 'claude-web' })]}
        selectedRunId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByLabelText('Runs as a Claude Code cloud session')).toBeTruthy()
    // claude-web is still Claude: where it runs is the target, not the agent.
    expect(screen.getByLabelText('Claude Code')).toBeTruthy()
  })

  test('a local finished run keeps its plain done badge and gets no cloud glyph', () => {
    renderRail(
      <RunHistory projectId="p1" runs={[run({ status: 'done', driver: 'claude-code' })]} selectedRunId={null} onSelect={() => {}} />,
    )
    expect(screen.getByText('done')).toBeTruthy()
    expect(screen.queryByLabelText('Runs as a Claude Code cloud session')).toBeNull()
  })
})

describe('RunHistory title tooltip (#1494)', () => {
  // jsdom gives every element zero widths, so the overflow measure needs stubbed getters to see
  // a title wider than its rail slot.
  test('a title that overflows the rail shows its full prompt in a tooltip', async () => {
    const long = 'refactor the queue promotion sweep so drains claim tickets through lock files'
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(240)
    const clientSpy = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(120)
    try {
      renderRail(<RunHistory projectId="p1" runs={[run({ intent: long })]} selectedRunId={null} onSelect={() => {}} />)
      const title = await screen.findByText(long)
      const tip = await hoverTooltip(title)
      expect(tip.textContent).toContain(long)
    } finally {
      scrollSpy.mockRestore()
      clientSpy.mockRestore()
    }
  })

  test('a title that fits is a plain span — no tooltip wiring at all', () => {
    renderRail(<RunHistory projectId="p1" runs={[run()]} selectedRunId={null} onSelect={() => {}} />)
    const title = screen.getByText("replace 'Hello, world!' with 'Welcome!'")
    // Not overflowing (zero widths measure as fitting): hovering has no listeners to open anything.
    fireEvent.mouseEnter(title)
    fireEvent.mouseMove(title)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
