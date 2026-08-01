import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { OpenQuestion } from '@gemstack/the-framework'

// The hub polls onOpenQuestions over the telefunc shim, and its ChoicePanels post over the
// control shim; stub both so the real telefunc client never loads into jsdom.
const onOpenQuestions = vi.hoisted(() => vi.fn())
vi.mock('../server/reads.telefunc.js', () => ({ onOpenQuestions }))
const sendChoice = vi.hoisted(() => vi.fn())
vi.mock('../server/control.telefunc.js', () => ({ sendChoice }))
// Preferences plumbing is not under test; autopilot reads ON so the countdown-off contract below
// is observable (a hub must never tick down, however the preference is set).
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => ({ autopilot: true }),
  updatePreferences: vi.fn(),
  autopilotEnabled: () => true,
}))

const { OpenQuestions } = await import('./OpenQuestions.js')

beforeEach(() => {
  onOpenQuestions.mockReset().mockResolvedValue([])
  sendChoice.mockReset().mockResolvedValue(undefined)
})

afterEach(cleanup)

const question = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  projectId: 'p1',
  projectName: 'alpha',
  runId: 'run-1',
  sessionName: 'triage-queue',
  updatedAt: '2026-08-01T10:00:00.000Z',
  choice: {
    id: 'gate-1',
    title: 'Start the next backlog item?',
    options: [
      { id: 'work', label: 'Work on it' },
      { id: 'stop', label: 'Stop the loop' },
    ],
    recommended: 'work',
  },
  ...overrides,
})

describe('OpenQuestions (#1455 item 4)', () => {
  test('renders nothing while empty: no section, no headline', async () => {
    const { container } = render(<OpenQuestions onOpenSession={vi.fn()} />)
    await waitFor(() => expect(onOpenQuestions).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  test('a parked session renders its question, and answering posts against its run', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenSession={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Start the next backlog item?')).toBeTruthy())
    expect(screen.getByText('Waiting on you · 1')).toBeTruthy()
    expect(screen.getByText('triage-queue')).toBeTruthy()
    expect(screen.getByText('alpha')).toBeTruthy()
    fireEvent.click(screen.getByText('Work on it'))
    await waitFor(() => expect(sendChoice).toHaveBeenCalledWith('p1', 'gate-1', 'work', 'user', 'run-1'))
  })

  test('questions from several projects sit side by side, each answerable', async () => {
    onOpenQuestions.mockResolvedValue([
      question(),
      question({ projectId: 'p2', projectName: 'beta', runId: 'run-9', sessionName: 'fix-ci', choice: { id: 'gate-2', title: 'Approve the fix?', options: [{ id: 'ok', label: 'Approve it' }], recommended: 'ok' } }),
    ])
    render(<OpenQuestions onOpenSession={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Waiting on you · 2')).toBeTruthy())
    fireEvent.click(screen.getByText('Approve it'))
    await waitFor(() => expect(sendChoice).toHaveBeenCalledWith('p2', 'gate-2', 'ok', 'user', 'run-9'))
  })

  test('the card header jumps into the question session, project and all', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    const onOpenSession = vi.fn()
    render(<OpenQuestions onOpenSession={onOpenSession} />)
    await waitFor(() => expect(screen.getByTitle('Open this session')).toBeTruthy())
    fireEvent.click(screen.getByTitle('Open this session'))
    expect(onOpenSession).toHaveBeenCalledWith('p1', 'run-1')
  })

  test('a session that never named itself falls back to its intent line', async () => {
    onOpenQuestions.mockResolvedValue([question({ sessionName: undefined as unknown as string, intent: 'fix the flaky test\nmore detail' })])
    render(<OpenQuestions onOpenSession={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('fix the flaky test')).toBeTruthy())
  })

  test('the autopilot countdown never runs in the hub, even with autopilot on', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenSession={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Start the next backlog item?')).toBeTruthy())
    // ChoicePanel with a countdown shows "● Auto accept in Ns…"; the hub must not (#1455): it
    // renders every parked gate at once, and a page that answers them all is a mass auto-accept.
    expect(screen.queryByText(/Auto accept in/)).toBeNull()
  })
})
