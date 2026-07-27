import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { hoverTooltip } from '../test-utils.js'

const onRunAnalysis = vi.fn(async () => null as unknown)
vi.mock('../server/reads.telefunc.js', () => ({ onRunAnalysis }))

const { RunAnalysisStrip } = await import('./RunAnalysis.js')

beforeEach(() => {
  onRunAnalysis.mockClear()
  onRunAnalysis.mockResolvedValue({ scope: 'small', variability: 'low', plan: 'no', newTickets: 'yes' })
})
afterEach(cleanup)

describe('RunAnalysisStrip (#1180)', () => {
  test("shows the run's prompt-analysis facts, read from its own worktree", async () => {
    render(<RunAnalysisStrip projectId="p1" runId="run-1" />)
    await waitFor(() => expect(onRunAnalysis).toHaveBeenCalledWith('p1', 'run-1'))
    await waitFor(() => expect(screen.getByText('Prompt analysis')).toBeTruthy())
    expect(screen.getByText('Scope')).toBeTruthy()
    expect(screen.getByText('small')).toBeTruthy()
    expect(screen.getByText('Variability')).toBeTruthy()
    expect(screen.getByText('low')).toBeTruthy()
    expect(screen.getByText('Plan')).toBeTruthy()
    expect(screen.getByText('New tickets')).toBeTruthy()
  })

  test('a run without an analysis renders nothing, rather than an empty strip', async () => {
    onRunAnalysis.mockResolvedValue(null)
    const { container } = render(<RunAnalysisStrip projectId="p1" runId="run-1" />)
    await waitFor(() => expect(onRunAnalysis).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  test('an absent fact is hidden, not shown blank', async () => {
    onRunAnalysis.mockResolvedValue({ scope: 'large' })
    render(<RunAnalysisStrip projectId="p1" runId="run-1" />)
    await waitFor(() => expect(screen.getByText('large')).toBeTruthy())
    expect(screen.queryByText('Variability')).toBeNull()
    expect(screen.queryByText('Plan')).toBeNull()
    expect(screen.queryByText('New tickets')).toBeNull()
  })

  test("the yes/no facts carry the ticket's long labels as hints", async () => {
    render(<RunAnalysisStrip projectId="p1" runId="run-1" />)
    await waitFor(() => expect(screen.getByText('Plan')).toBeTruthy())
    const tooltip = await hoverTooltip(screen.getByText('Plan').parentElement!)
    expect(tooltip.textContent).toBe('Whether the work includes a plan')
  })
})
