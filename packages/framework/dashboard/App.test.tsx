import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import type { ModuleCardProps, ModuleDefinition, ModulePageProps } from './module/index.js'

// The whole transport, stubbed at its one seam: every RPC stub is `rpc(name)`, so a map by name
// answers every read the shell makes, and the live feed never emits.
const answers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const calls = vi.hoisted(() => [] as { name: string; args: unknown[] }[])
vi.mock('./lib/rpc.js', () => ({
  rpc: (name: string) => async (...args: unknown[]) => {
    calls.push({ name, args })
    const answer = answers.get(name)
    return answer ? answer(...args) : null
  },
  openEvents: () => new Promise(() => {}),
}))

// Settings and a project's launcher read a dozen things of their own; these tests are about the
// shell around them, so each is a line naming itself.
vi.mock('./components/SettingsPage.js', () => ({ SettingsPage: () => createElement('p', null, 'the settings page') }))
vi.mock('./components/ProjectHome.js', () => ({ ProjectHome: ({ projectName }: { projectName?: string }) => createElement('p', null, `the launcher of ${projectName}`) }))

const { App } = await import('./App.js')

const PROJECT = { id: 'app-abc', path: '/work/app', name: 'app', activated: true }

/** A module's browser part the loader imports like a real one: a data URL whose default export is `definition`. */
function moduleModule(key: string, definition: ModuleDefinition): string {
  ;(globalThis as Record<string, unknown>)[key] = definition
  return `data:text/javascript,export default globalThis[${JSON.stringify(key)}]`
}

function answerShell(modules: unknown[]): void {
  answers.clear()
  answers.set('onProjects', () => [PROJECT])
  answers.set('onModules', () => modules)
  answers.set('onInterventions', () => ({ items: [], whole: [] }))
  answers.set('onRecentAgents', () => [])
  answers.set('onAgents', () => [])
  answers.set('onOverview', () => ({ active: [] }))
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  calls.length = 0
})

describe('module pages in the shell (#1774)', () => {
  test('a module\'s page gets a sidebar row and its own URL, where no project is selected', async () => {
    function LogsPage({ projects }: ModulePageProps) {
      return createElement('p', null, `runs of ${projects.map(p => p.name).join(', ')}`)
    }
    answerShell([{ package: '@acme/logs', url: moduleModule('__logsModule', { pages: [{ segment: 'logs', label: 'Logs', Page: LogsPage }] }), projects: [PROJECT.id] }])
    // A page no module claims: its main pane reads nothing, so the stub needs no answers for it.
    window.history.replaceState(null, '', '/elsewhere')
    render(<App />)

    const row = await screen.findByRole('button', { name: 'Logs' })
    fireEvent.click(row)
    expect(window.location.pathname).toBe('/logs')
    expect(await screen.findByText('runs of app')).toBeTruthy()
    expect(row.getAttribute('aria-current')).toBe('page')
    // The page's segment names no project: nothing reads a project called "logs".
    expect(calls.filter(call => call.args[0] === 'logs' || call.args[0] === 'elsewhere').map(call => call.name)).toEqual([])
  })

  test('a URL no installed module claims says so once the modules are loaded', async () => {
    answerShell([])
    window.history.replaceState(null, '', '/nothing')
    render(<App />)
    expect(await screen.findByText('No such page')).toBeTruthy()
  })

  test('the page talks to its own package\'s commands through the host', async () => {
    const { useModuleHost } = await import('./module/index.js')
    function Runs({ projects }: ModulePageProps) {
      const host = useModuleHost()
      return createElement('button', { onClick: () => void host.runCommand(projects[0]!.id, ['--limit', '5']) }, 'read')
    }
    answerShell([{ package: '@acme/logs', url: moduleModule('__runsModule', { pages: [{ segment: 'runs', label: 'Runs', Page: Runs }] }), projects: [PROJECT.id] }])
    window.history.replaceState(null, '', '/runs')
    render(<App />)
    fireEvent.click(await screen.findByText('read'))
    await waitFor(() => expect(calls).toContainEqual({ name: 'runModuleCommand', args: [PROJECT.id, '@acme/logs', ['--limit', '5'], undefined, false] }))
  })
})

describe('module cards on the Overview (#1818)', () => {
  /** The Overview's own reads, answered empty: the shell's stub answers null otherwise, and a null list is not an empty one. */
  function answerOverview(modules: unknown[]): void {
    answerShell(modules)
    answers.set('onQuota', () => null)
    answers.set('onDashboard', () => null)
    // Landing on a started run renders its page, whose changes card reads a list.
    answers.set('onAgentChanges', () => [])
    answers.set('onDocs', () => [])
    answers.set('onProjectFiles', () => [])
  }

  test("a package's card is drawn on the Overview, given the projects that have the package, inside its host", async () => {
    const { useModuleHost } = await import('./module/index.js')
    function QueueCard({ projects }: ModuleCardProps) {
      const host = useModuleHost()
      return createElement('p', null, `${host.package} card for ${projects.map(p => p.name).join(', ')}`)
    }
    answerOverview([{ package: '@acme/queue', url: moduleModule('__queueCard', { cards: [{ id: 'queue', Card: QueueCard }] }), projects: [PROJECT.id] }])
    window.history.replaceState(null, '', '/')
    render(<App />)
    expect(await screen.findByText('@acme/queue card for app')).toBeTruthy()
  })

  test('cards come out by order, then by package name; a card that throws shows only its own error', async () => {
    const card = (text: string) => ({ Card: () => createElement('p', null, text) })
    function Boom(): never {
      throw new Error('kaboom')
    }
    answerOverview([
      { package: '@acme/tickets', url: moduleModule('__ticketsCard', { cards: [{ id: 'hot', order: 20, ...card('tickets card') }] }), projects: [PROJECT.id] },
      { package: '@acme/queue', url: moduleModule('__queueCard2', { cards: [{ id: 'queue', order: 10, ...card('queue card') }, { id: 'boom', order: 10, Card: Boom }] }), projects: [PROJECT.id] },
      { package: '@acme/audit', url: moduleModule('__auditCard', { cards: [{ id: 'audit', ...card('audit card') }] }), projects: [PROJECT.id] },
    ])
    window.history.replaceState(null, '', '/')
    render(<App />)
    const queue = await screen.findByText('queue card')
    const tickets = await screen.findByText('tickets card')
    const audit = await screen.findByText('audit card')
    const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(before(queue, tickets)).toBe(true)
    expect(before(tickets, audit)).toBe(true)
    expect((await screen.findByRole('alert')).textContent).toBe('The boom card failed: kaboom')
  })

  test('a card may start a run without landing on it; by default the dashboard lands on the run', async () => {
    const { useModuleHost } = await import('./module/index.js')
    function Starter({ projects }: ModuleCardProps) {
      const host = useModuleHost()
      return createElement(
        'div',
        null,
        createElement('button', { onClick: () => void host.startRun(projects[0]!.id, 'work the queue', { land: false }) }, 'start and stay'),
        createElement('button', { onClick: () => void host.startRun(projects[0]!.id, 'work the queue') }, 'start and go'),
      )
    }
    answerOverview([{ package: '@acme/queue', url: moduleModule('__starterCard', { cards: [{ id: 'starter', Card: Starter }] }), projects: [PROJECT.id] }])
    answers.set('sendStart', () => ({ ok: true, agentId: 'r9' }))
    window.history.replaceState(null, '', '/')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'start and stay' }))
    await waitFor(() => expect(calls.filter(call => call.name === 'sendStart')).toHaveLength(1))
    expect(calls.find(call => call.name === 'sendStart')?.args.slice(0, 2)).toEqual([PROJECT.id, 'work the queue'])
    expect(window.location.pathname).toBe('/')
    fireEvent.click(await screen.findByRole('button', { name: 'start and go' }))
    await waitFor(() => expect(window.location.pathname).toBe(`/${PROJECT.id}/r9`))
  })
})

describe('the project select (#1513)', () => {
  const OTHER = { id: 'site-def', path: '/work/site', name: 'site', activated: true }
  const url = () => window.location.pathname + window.location.search

  function answerTwo(): void {
    function LogsPage({ projects }: ModulePageProps) {
      return createElement('p', null, `runs of ${projects.map(p => p.name).join(', ')}`)
    }
    function QueueCard({ projects }: ModuleCardProps) {
      return createElement('p', null, `card for ${projects.map(p => p.name).join(', ')}`)
    }
    answerShell([{ package: '@acme/logs', url: moduleModule('__scopeModule', { pages: [{ segment: 'logs', label: 'Logs', Page: LogsPage }], cards: [{ id: 'queue', Card: QueueCard }] }), projects: [PROJECT.id, OTHER.id] }])
    answers.set('onProjects', () => [PROJECT, OTHER])
    answers.set('onQuota', () => null)
    answers.set('onDocs', () => [])
    answers.set('onProjectFiles', () => [])
    answers.set('onAgentChanges', () => [])
    answers.set('onInterventions', () => ({
      items: [
        { kind: 'awaiting', projectId: PROJECT.id, projectName: 'app', agentId: 'a1', title: 'app asks' },
        { kind: 'awaiting', projectId: OTHER.id, projectName: 'site', agentId: 's1', title: 'site asks' },
      ],
      whole: [],
    }))
    answers.set('onRetainedWorktrees', () => [])
    answers.set('onDashboard', () => ({
      totals: { projects: 2, openTodos: 0 },
      projects: [],
      queue: [],
      active: [
        { projectId: PROJECT.id, projectName: 'app', agentId: 'a2', status: 'running', intent: 'app works' },
        { projectId: OTHER.id, projectName: 'site', agentId: 's2', status: 'running', intent: 'site works' },
      ],
    }))
    answers.set('onRecentAgents', () => [
      { projectId: PROJECT.id, projectName: 'app', agent: { id: 'a3', status: 'done', startedAt: '2026-07-19T16:05:44.756Z', updatedAt: '2026-07-19T16:06:21.000Z', intent: 'app ran' } },
      { projectId: OTHER.id, projectName: 'site', agent: { id: 's3', status: 'done', startedAt: '2026-07-19T15:05:44.756Z', updatedAt: '2026-07-19T15:06:21.000Z', intent: 'site ran' } },
    ])
    answers.set('onAgents', (id: unknown) =>
      id === OTHER.id ? [{ id: 's3', status: 'done', startedAt: '2026-07-19T15:05:44.756Z', updatedAt: '2026-07-19T15:06:21.000Z', intent: 'site ran' }] : [],
    )
  }

  async function pick(from: string, to: RegExp): Promise<void> {
    const { openMenu } = await import('./test-utils.js')
    await openMenu(await screen.findByRole('button', { name: `Project: ${from}` }))
    fireEvent.click(screen.getByRole('menuitem', { name: to }))
  }

  test('all projects show until one is picked; then the Overview, its badge and the agent list show only that project', async () => {
    answerTwo()
    render(<App />)
    expect(await screen.findByText('card for app, site')).toBeTruthy()
    expect(await screen.findByText('app asks')).toBeTruthy()
    expect(await screen.findByText('app works')).toBeTruthy()
    expect(await screen.findByText('app ran')).toBeTruthy()

    await pick('All projects', /site/)
    expect(url()).toBe(`/?project=${OTHER.id}`)
    expect(await screen.findByText('card for site')).toBeTruthy()
    expect(screen.getByText('site asks')).toBeTruthy()
    expect(screen.queryByText('app asks')).toBeNull()
    expect(screen.getByText('site works')).toBeTruthy()
    expect(screen.queryByText('app works')).toBeNull()
    expect(await screen.findByText('site ran')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('app ran')).toBeNull())
    expect(document.title).toBe('(1) site — OpenAgent')
  })

  test('the pick rides along to a module page and Settings, and its row opens that project\'s agent', async () => {
    answerTwo()
    window.history.replaceState(null, '', `/?project=${OTHER.id}`)
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Logs' }))
    expect(url()).toBe(`/logs?project=${OTHER.id}`)
    expect(await screen.findByText('runs of site')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(url()).toBe(`/settings?project=${OTHER.id}`)
    fireEvent.click(await screen.findByText('site ran'))
    expect(url()).toBe(`/${OTHER.id}/s3?project=${OTHER.id}`)
  })

  test("a jump to another project's agent names it at once, before that project's agents are read", async () => {
    answerTwo()
    // The other project's list never answers: the row clicked is all the page has.
    answers.set('onAgents', (id: unknown) => (id === OTHER.id ? new Promise(() => {}) : []))
    render(<App />)
    fireEvent.click(await screen.findByText('site ran'))
    expect(url()).toBe(`/${OTHER.id}/s3`)
    await waitFor(() => expect(document.querySelector('button[aria-label="Session actions"][title="site ran"]')).toBeTruthy())
  })

  test('New agent starts in the picked project; picking another on the launcher moves to its launcher, and all keeps the page', async () => {
    answerTwo()
    window.history.replaceState(null, '', `/?project=${OTHER.id}`)
    render(<App />)
    fireEvent.click(await screen.findByText('New agent'))
    expect(url()).toBe(`/${OTHER.id}?project=${OTHER.id}`)
    expect(await screen.findByText('the launcher of site')).toBeTruthy()
    await pick('site', /app/)
    expect(url()).toBe(`/${PROJECT.id}?project=${PROJECT.id}`)
    await pick('app', /All projects/)
    expect(url()).toBe(`/${PROJECT.id}`)
  })

  test('picking another project on an agent\'s page goes to the Overview; on a module page it drops the page\'s own path', async () => {
    answerTwo()
    window.history.replaceState(null, '', `/${OTHER.id}/s3`)
    render(<App />)
    // All projects show, on a project's own page too: the agent list is every project's.
    expect(await screen.findByText('app ran')).toBeTruthy()
    await pick('All projects', /app/)
    expect(url()).toBe(`/?project=${PROJECT.id}`)
    cleanup()
    window.history.replaceState(null, '', `/logs/${OTHER.id}/x`)
    render(<App />)
    await pick('All projects', /app/)
    expect(url()).toBe(`/logs?project=${PROJECT.id}`)
    // What the page mirrored into the query stays when only the pick changes.
    cleanup()
    window.history.replaceState(null, '', `/logs?q=races&project=${PROJECT.id}`)
    render(<App />)
    await pick('app', /site/)
    expect(url()).toBe(`/logs?q=races&project=${OTHER.id}`)
    await pick('site', /All projects/)
    expect(url()).toBe('/logs?q=races')
  })

  test('a project that is not registered picks nothing', async () => {
    answerTwo()
    window.history.replaceState(null, '', `/?project=gone-123`)
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Project: All projects' })).toBeTruthy()
    expect(await screen.findByText('card for app, site')).toBeTruthy()
  })
})
