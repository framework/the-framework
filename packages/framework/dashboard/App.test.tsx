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
    answers.set('onSchedulers', () => [])
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
