import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { onFileContent, onPlanAgent } = vi.hoisted(() => ({ onFileContent: vi.fn(), onPlanAgent: vi.fn() }))
vi.mock('../rpc/reads.js', () => ({ onFileContent, onPlanAgent }))

const { TicketPlanPage, planPath } = await import('./TicketPlanPage.js')

afterEach(() => {
  cleanup()
  onFileContent.mockReset()
  onPlanAgent.mockReset()
})

const PLAN = { path: 'tickets/2026-07-20_do-the-thing.plan.md', text: '# The plan\n\nDo it in two steps.', truncated: false, binary: false }

describe('TicketPlanPage (#685)', () => {
  test('planPath maps a ticket slug to its plan file beside it', () => {
    expect(planPath('2026-07-20_do-the-thing.md')).toBe('tickets/2026-07-20_do-the-thing.plan.md')
  })

  test('reads the ticket\'s plan by that path and renders its markdown', async () => {
    onFileContent.mockResolvedValue({ path: 'tickets/2026-07-20_do-the-thing.plan.md', text: '# The plan\n\nDo it in two steps.', truncated: false, binary: false })
    onPlanAgent.mockResolvedValue(null)
    render(<TicketPlanPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} onOpenAgent={() => {}} />)
    await waitFor(() => expect(onFileContent).toHaveBeenCalledWith('p1', 'tickets/2026-07-20_do-the-thing.plan.md'))
    expect(await screen.findByText('The plan')).toBeTruthy()
    expect(screen.getByText('Do it in two steps.')).toBeTruthy()
  })

  test('a ticket with no plan says so rather than showing a blank page', async () => {
    onFileContent.mockResolvedValue(null)
    onPlanAgent.mockResolvedValue(null)
    render(<TicketPlanPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} onOpenAgent={() => {}} />)
    expect(await screen.findByText(/no plan yet/i)).toBeTruthy()
  })

  test('a truncated plan admits its tail was cut', async () => {
    onFileContent.mockResolvedValue({ path: 'tickets/x.plan.md', text: '# Long plan', truncated: true, binary: false })
    onPlanAgent.mockResolvedValue(null)
    render(<TicketPlanPage projectId="p1" slug="x.md" onBack={() => {}} onOpenAgent={() => {}} />)
    expect(await screen.findByText(/plan truncated/i)).toBeTruthy()
  })

  test('a plan with a known author offers to resume that agent, and opens its session (#1511)', async () => {
    onFileContent.mockResolvedValue(PLAN)
    onPlanAgent.mockResolvedValue({ agentId: 'run-7', status: 'done' })
    const onOpenAgent = vi.fn()
    render(<TicketPlanPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} onOpenAgent={onOpenAgent} />)
    await waitFor(() => expect(onPlanAgent).toHaveBeenCalledWith('p1', '2026-07-20_do-the-thing.md'))
    fireEvent.click(await screen.findByRole('button', { name: 'Resume agent' }))
    expect(onOpenAgent).toHaveBeenCalledWith('run-7')
  })

  test('an author still running is opened, not resumed (#1511)', async () => {
    onFileContent.mockResolvedValue(PLAN)
    onPlanAgent.mockResolvedValue({ agentId: 'run-8', status: 'running' })
    render(<TicketPlanPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} onOpenAgent={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Open agent' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Resume agent' })).toBeNull()
  })

  test('a plan nobody on record wrote shows no resume control (#1511)', async () => {
    onFileContent.mockResolvedValue(PLAN)
    onPlanAgent.mockResolvedValue(null)
    render(<TicketPlanPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} onOpenAgent={() => {}} />)
    expect(await screen.findByText('The plan')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /agent/ })).toBeNull()
  })
})
