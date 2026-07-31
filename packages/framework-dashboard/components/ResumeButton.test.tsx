import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const sendStart = vi.hoisted(() => vi.fn())
vi.mock('../server/control.telefunc.js', () => ({ sendStart }))

const { ResumeButton, RESUME_MESSAGE } = await import('./ResumeButton.js')

afterEach(() => {
  cleanup()
  sendStart.mockReset()
})

// Resume-on-demand (#1391): the button is the composer's continuation (#720/#762) with a stock
// prompt — same run id, same branch, same agent session — so pressing it must send exactly that.
describe('ResumeButton (#1391)', () => {
  test('resumes the session as a continuation of the same run, with the stock prompt', async () => {
    sendStart.mockResolvedValue({ ok: true, runId: 'run-1' })
    const onRunStarted = vi.fn()
    render(<ResumeButton projectId="p1" runId="run-1" sessionId="sess-1" onRunStarted={onRunStarted} />)
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() =>
      expect(sendStart).toHaveBeenCalledWith('p1', RESUME_MESSAGE, 'prompt', {
        resumeSession: 'sess-1',
        continueRunId: 'run-1',
      }),
    )
    await waitFor(() => expect(onRunStarted).toHaveBeenCalledWith(RESUME_MESSAGE, 'run-1'))
  })

  test('a refused start surfaces its error instead of pretending to resume', async () => {
    sendStart.mockResolvedValue({ ok: false, busy: true })
    const onRunStarted = vi.fn()
    render(<ResumeButton projectId="p1" runId="run-1" sessionId="sess-1" onRunStarted={onRunStarted} />)
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    await waitFor(() => expect(screen.getByText('A session is already active for this project.')).toBeTruthy())
    expect(onRunStarted).not.toHaveBeenCalled()
  })
})
