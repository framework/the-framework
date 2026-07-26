import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { WorkspaceTicket } from '@gemstack/the-framework'
import { presets } from '@gemstack/the-framework/client'

const sendStart = vi.hoisted(() => vi.fn())
vi.mock('../server/control.telefunc.js', () => ({ sendStart }))

const { TicketsPanel } = await import('./TicketsPanel.js')

const ticket = (over: Partial<WorkspaceTicket> = {}): WorkspaceTicket => ({
  file: '2026-07-20_do-the-thing.md',
  title: 'Do the thing',
  summary: 'The thing is not done.',
  spiked: false,
  planned: false,
  ...over,
})

afterEach(() => {
  cleanup()
  sendStart.mockReset()
})

describe('TicketsPanel (#697/#1144)', () => {
  test('lists the tickets as one-liners, with what has already been done to them', async () => {
    render(<TicketsPanel projectId="p1" tickets={[ticket({ priority: 'high', planned: true })]} loaded onOpen={() => {}} />)
    expect(await screen.findByText('Do the thing')).toBeTruthy()
    expect(screen.getByText('planned')).toBeTruthy()
    // The summary moved to the detail page (#1144); the list row is a one-liner.
    expect(screen.queryByText('The thing is not done.')).toBeNull()
  })

  test('opening a row hands back its file, the slug the detail route uses (#1144)', async () => {
    const onOpen = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[ticket()]} loaded onOpen={onOpen} />)
    fireEvent.click(await screen.findByText('Do the thing'))
    expect(onOpen).toHaveBeenCalledWith('2026-07-20_do-the-thing.md')
  })

  test('an empty tickets/ offers the GitHub import instead of a dead end', async () => {
    sendStart.mockResolvedValue({ ok: true, runId: 'r1' })
    const onRunStarted = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[]} loaded onOpen={() => {}} onRunStarted={onRunStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /import tickets from github/i }))
    await waitFor(() => expect(sendStart).toHaveBeenCalled())
    // A fixed prompt, so it takes the verbatim-text path rather than a build.
    expect(sendStart.mock.calls[0]?.[2]).toBe('prompt')
    expect(sendStart.mock.calls[0]?.[1]).toMatch(/GitHub issues into tickets\//i)
    // And it is the preset's own text: the onboarding checklist offers this button under the same
    // label and sends `presets.importTickets`, so a second source here means one label, two asks.
    expect(sendStart.mock.calls[0]?.[1]).toBe(presets.importTickets.render())
    // The run id is what lands you on the import session rather than the project home (#1169).
    await waitFor(() => expect(onRunStarted).toHaveBeenCalledWith(expect.any(String), 'r1'))
  })

  test('a refused import says why and moves you nowhere (#1169)', async () => {
    sendStart.mockResolvedValue({ ok: false, error: 'a session is already active' })
    const onRunStarted = vi.fn()
    render(<TicketsPanel projectId="p1" tickets={[]} loaded onOpen={() => {}} onRunStarted={onRunStarted} />)
    fireEvent.click(await screen.findByRole('button', { name: /import tickets from github/i }))
    expect(await screen.findByText(/already active/i)).toBeTruthy()
    expect(onRunStarted).not.toHaveBeenCalled()
  })

  test('no project renders nothing at all', () => {
    const { container } = render(<TicketsPanel projectId={null} tickets={[]} loaded onOpen={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
