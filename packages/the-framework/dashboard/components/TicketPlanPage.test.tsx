import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const onFileContent = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onFileContent }))

const { TicketPlanPage, planPath } = await import('./TicketPlanPage.js')

afterEach(() => {
  cleanup()
  onFileContent.mockReset()
})

describe('TicketPlanPage (#685)', () => {
  test('planPath maps a ticket slug to its plan file beside it', () => {
    expect(planPath('2026-07-20_do-the-thing.md')).toBe('tickets/2026-07-20_do-the-thing.plan.md')
  })

  test('reads the ticket\'s plan by that path and renders its markdown', async () => {
    onFileContent.mockResolvedValue({ path: 'tickets/2026-07-20_do-the-thing.plan.md', text: '# The plan\n\nDo it in two steps.', truncated: false, binary: false })
    render(<TicketPlanPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} />)
    await waitFor(() => expect(onFileContent).toHaveBeenCalledWith('p1', 'tickets/2026-07-20_do-the-thing.plan.md'))
    expect(await screen.findByText('The plan')).toBeTruthy()
    expect(screen.getByText('Do it in two steps.')).toBeTruthy()
  })

  test('a ticket with no plan says so rather than showing a blank page', async () => {
    onFileContent.mockResolvedValue(null)
    render(<TicketPlanPage projectId="p1" slug="2026-07-20_do-the-thing.md" onBack={() => {}} />)
    expect(await screen.findByText(/no plan yet/i)).toBeTruthy()
  })

  test('a truncated plan admits its tail was cut', async () => {
    onFileContent.mockResolvedValue({ path: 'tickets/x.plan.md', text: '# Long plan', truncated: true, binary: false })
    render(<TicketPlanPage projectId="p1" slug="x.md" onBack={() => {}} />)
    expect(await screen.findByText(/plan truncated/i)).toBeTruthy()
  })
})
