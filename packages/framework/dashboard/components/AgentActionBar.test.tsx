import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

// The bar's neighbours read the daemon; here only what the bar itself says is under test.
vi.mock('./GitStatusBar.js', () => ({ GitStatusBar: ({ agentState }: { agentState?: ReactNode }) => <div>{agentState}</div> }))
vi.mock('./AgentActionsMenu.js', () => ({ AgentActionsMenu: () => null }))

const { AgentActionBar } = await import('./AgentActionBar.js')

afterEach(cleanup)

describe('AgentActionBar', () => {
  test("a failed run's header says failed, and keeps the reason for the hover", () => {
    const reason = "codex exited (1): You've hit your usage limit."
    const { container } = render(<AgentActionBar projectId="p1" agentId="run-1" events={[{ kind: 'end', ok: false, detail: reason }]} />)
    expect(screen.getByText('failed')).toBeTruthy()
    // Cut to fit the row, the reason said nothing; the feed's end line says it whole.
    expect(container.textContent).not.toContain('usage limit')
  })
})
