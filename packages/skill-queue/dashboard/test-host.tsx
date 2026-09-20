import { vi } from 'vitest'
import { render as rtlRender, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { WidgetHostContext, type WidgetCommandResult, type WidgetHost } from 'framework/widget'
import { WidgetsContext, type MountedWidgets } from '../../framework/dashboard/lib/use-widgets.js'

// The dashboard as the widget's card sees it, faked: every service a spy, the widget's commands
// answered by a table of the queue command's outputs. `useWidgetHost` hands a host that carries
// its own `runCommand` back as it is, so the card under test never reaches a real dashboard.

/** The `queue` command's answers, keyed by project then by the command line joined with spaces. */
export type Answers = Record<string, Record<string, unknown>>

export interface FakeHost extends WidgetHost {
  runCommand: ReturnType<typeof vi.fn<WidgetHost['runCommand']>>
  startRun: ReturnType<typeof vi.fn<WidgetHost['startRun']>>
  configureRun: ReturnType<typeof vi.fn<WidgetHost['configureRun']>>
}

/** A host whose commands answer from `answers`; a command line with no answer fails, naming itself. */
export function fakeHost(answers: Answers = {}): FakeHost {
  const answer = async (projectId: string, args: string[]): Promise<WidgetCommandResult> => {
    const line = args.join(' ')
    const known = answers[projectId]?.[line]
    return known === undefined ? { ok: false, error: `no answer for ${projectId}: queue ${line}` } : { ok: true, output: known }
  }
  let runs = 0
  return {
    package: '@gemstack/skill-queue',
    runCommand: vi.fn(answer),
    act: vi.fn(answer),
    openAgent: vi.fn(),
    openPage: vi.fn(),
    startRun: vi.fn(async () => ({ ok: true as const, agentId: `run-${++runs}` })),
    configureRun: vi.fn(),
    agents: vi.fn(async () => []),
  }
}

/** No other widget is installed: the card is rendered with nothing but its own package. */
export const NO_WIDGETS: MountedWidgets = { pages: [], cards: [], linkActions: [], loaded: true }

/** Render the card inside the fake host, with no other widget mounted. */
export function renderWithHost(ui: ReactElement, host: WidgetHost): RenderResult {
  return rtlRender(
    <WidgetsContext.Provider value={NO_WIDGETS}>
      <WidgetHostContext.Provider value={host}>{ui}</WidgetHostContext.Provider>
    </WidgetsContext.Provider>,
  )
}
