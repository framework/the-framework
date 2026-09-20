import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import type { WidgetDefinition, WidgetPageProps } from './widget/index.js'

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

/** A widget module the loader imports like a real one: a data URL whose default export is `definition`. */
function widgetModule(key: string, definition: WidgetDefinition): string {
  ;(globalThis as Record<string, unknown>)[key] = definition
  return `data:text/javascript,export default globalThis[${JSON.stringify(key)}]`
}

function answerShell(widgets: unknown[]): void {
  answers.clear()
  answers.set('onProjects', () => [PROJECT])
  answers.set('onWidgets', () => widgets)
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

describe('widget pages in the shell (#1774)', () => {
  test('a widget\'s page gets a sidebar row and its own URL, where no project is selected', async () => {
    function LogsPage({ projects }: WidgetPageProps) {
      return createElement('p', null, `runs of ${projects.map(p => p.name).join(', ')}`)
    }
    answerShell([{ package: '@acme/logs', url: widgetModule('__logsWidget', { pages: [{ segment: 'logs', label: 'Logs', Page: LogsPage }] }), projects: [PROJECT.id] }])
    // A page no widget claims: its main pane reads nothing, so the stub needs no answers for it.
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

  test('a URL no installed widget claims says so once the widgets are loaded', async () => {
    answerShell([])
    window.history.replaceState(null, '', '/nothing')
    render(<App />)
    expect(await screen.findByText('No such page')).toBeTruthy()
  })

  test('the page talks to its own package\'s commands through the host', async () => {
    const { useWidgetHost } = await import('./widget/index.js')
    function Runs({ projects }: WidgetPageProps) {
      const host = useWidgetHost()
      return createElement('button', { onClick: () => void host.runCommand(projects[0]!.id, ['--limit', '5']) }, 'read')
    }
    answerShell([{ package: '@acme/logs', url: widgetModule('__runsWidget', { pages: [{ segment: 'runs', label: 'Runs', Page: Runs }] }), projects: [PROJECT.id] }])
    window.history.replaceState(null, '', '/runs')
    render(<App />)
    fireEvent.click(await screen.findByText('read'))
    await waitFor(() => expect(calls).toContainEqual({ name: 'runWidgetCommand', args: [PROJECT.id, '@acme/logs', ['--limit', '5'], undefined, false] }))
  })
})
