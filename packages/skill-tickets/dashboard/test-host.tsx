import { vi } from 'vitest'
import { render as rtlRender, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { WidgetHostContext, type WidgetAgent, type WidgetCommandResult, type WidgetHost } from 'framework/widget'
import { WidgetsContext, type MountedWidgets } from '../../framework/dashboard/lib/use-widgets.js'

// The dashboard as a widget page sees it, faked: every service a spy, the widget's commands
// answered by a table of the tickets command's outputs. `useWidgetHost` hands a host that carries
// its own `runCommand` back as it is, so the pages under test never reach a real dashboard.

/** The `tickets` command's answers, keyed by project then by the command line joined with spaces. */
export type Answers = Record<string, Record<string, unknown>>

export interface FakeHost extends WidgetHost {
  runCommand: ReturnType<typeof vi.fn<WidgetHost['runCommand']>>
  act: ReturnType<typeof vi.fn<WidgetHost['act']>>
  openAgent: ReturnType<typeof vi.fn<WidgetHost['openAgent']>>
  openPage: ReturnType<typeof vi.fn<WidgetHost['openPage']>>
  startRun: ReturnType<typeof vi.fn<WidgetHost['startRun']>>
  configureRun: ReturnType<typeof vi.fn<WidgetHost['configureRun']>>
  agents: ReturnType<typeof vi.fn<WidgetHost['agents']>>
}

/** A host whose commands answer from `answers`; a command line with no answer fails, naming itself. */
export function fakeHost(answers: Answers = {}, agents: Record<string, WidgetAgent[]> = {}): FakeHost {
  const answer = async (projectId: string, args: string[]): Promise<WidgetCommandResult> => {
    const line = args.join(' ')
    const known = answers[projectId]?.[line]
    return known === undefined ? { ok: false, error: `no answer for ${projectId}: tickets ${line}` } : { ok: true, output: known }
  }
  return {
    package: '@gemstack/skill-tickets',
    runCommand: vi.fn(answer),
    act: vi.fn(answer),
    openAgent: vi.fn(),
    openPage: vi.fn(),
    startRun: vi.fn(async (_projectId: string, _prompt: string) => ({ ok: true as const, agentId: 'started' })),
    configureRun: vi.fn(),
    agents: vi.fn(async (projectId: string) => agents[projectId] ?? []),
  }
}

/** No widget offers anything on links: the default for pages whose tests are not about the slot. */
export const NO_WIDGETS: MountedWidgets = { pages: [], cards: [], linkActions: [], loaded: true }

/** Render a page inside the fake host, and inside whatever link actions installed widgets offer. */
export function renderWithHost(ui: ReactElement, host: WidgetHost, widgets: MountedWidgets = NO_WIDGETS): RenderResult {
  return rtlRender(
    <WidgetsContext.Provider value={widgets}>
      <WidgetHostContext.Provider value={host}>{ui}</WidgetHostContext.Provider>
    </WidgetsContext.Provider>,
  )
}
