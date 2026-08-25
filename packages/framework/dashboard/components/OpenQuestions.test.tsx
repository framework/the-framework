import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { OpenQuestion } from '../../src/index.js'

// The hub polls onOpenQuestions over the reads stub, and its ChoicePanels post over the control
// stub; stub both so nothing fetches a daemon that is not there.
const onOpenQuestions = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onOpenQuestions }))
const sendChoice = vi.hoisted(() => vi.fn())
vi.mock('../rpc/control.js', () => ({ sendChoice }))
// Preferences plumbing is not under test; autopilot reads ON so the countdown-off contract below
// is observable (a hub must never tick down, however the preference is set).
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => ({ autopilot: true }),
  updatePreferences: vi.fn(),
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
  agentId: 'run-1',
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
    const { container } = render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(onOpenQuestions).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  test('a parked session renders its question, and answering posts against its run', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
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
      question({ projectId: 'p2', projectName: 'beta', agentId: 'run-9', sessionName: 'fix-ci', choice: { id: 'gate-2', title: 'Approve the fix?', options: [{ id: 'ok', label: 'Approve it' }], recommended: 'ok' } }),
    ])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Waiting on you · 2')).toBeTruthy())
    fireEvent.click(screen.getByText('Approve it'))
    await waitFor(() => expect(sendChoice).toHaveBeenCalledWith('p2', 'gate-2', 'ok', 'user', 'run-9'))
  })

  test('the card header jumps into the question session, project and all', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    const onOpenAgent = vi.fn()
    render(<OpenQuestions onOpenAgent={onOpenAgent} />)
    await waitFor(() => expect(screen.getByTitle('Open this session')).toBeTruthy())
    fireEvent.click(screen.getByTitle('Open this session'))
    expect(onOpenAgent).toHaveBeenCalledWith('p1', 'run-1')
  })

  test('a session that never named itself falls back to its intent line', async () => {
    onOpenQuestions.mockResolvedValue([question({ sessionName: undefined as unknown as string, intent: 'fix the flaky test\nmore detail' })])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('fix the flaky test')).toBeTruthy())
  })

  test('the autopilot countdown never runs in the hub, even with autopilot on', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Start the next backlog item?')).toBeTruthy())
    // ChoicePanel with a countdown shows "● Auto accept in Ns…"; the hub must not (#1455): it
    // renders every parked gate at once, and a page that answers them all is a mass auto-accept.
    expect(screen.queryByText(/Auto accept in/)).toBeNull()
  })
})

describe('OpenQuestions jump-nav (#1455 bonus 1)', () => {
  const second = () =>
    question({ projectId: 'p2', projectName: 'beta', agentId: 'run-9', sessionName: 'fix-ci', choice: { id: 'gate-2', title: 'Approve the fix?', options: [{ id: 'ok', label: 'Approve it' }], recommended: 'ok' } })

  test('one question needs no map to it: no nav', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Start the next backlog item?')).toBeTruthy())
    expect(screen.queryByRole('navigation', { name: 'Jump to a question' })).toBeNull()
  })

  test('several questions get the right-hand nav, and a row scrolls its card into view', async () => {
    onOpenQuestions.mockResolvedValue([question(), second()])
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Jump to a question' })).toBeTruthy())
    const nav = screen.getByRole('navigation', { name: 'Jump to a question' })
    // One row per card, labelled by session.
    expect(nav.textContent).toContain('triage-queue')
    expect(nav.textContent).toContain('fix-ci')
    fireEvent.click(screen.getAllByText('fix-ci').find(el => nav.contains(el))!)
    expect(scrolled).toHaveBeenCalled()
  })
})

describe('OpenQuestions answered collapse (#1455 bonus 2)', () => {
  test('answering collapses the card to a ✓ line in place, and the header counts only open ones', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Work on it')).toBeTruthy())
    fireEvent.click(screen.getByText('Work on it'))
    // The live panel is gone, the single-line card is there, the count dropped to zero.
    await waitFor(() => expect(screen.getByText('Expand')).toBeTruthy())
    expect(screen.queryByText('Work on it')).toBeNull()
    expect(screen.getByText('Waiting on you · 0')).toBeTruthy()
    expect(screen.getByText('Start the next backlog item?')).toBeTruthy()
  })

  test('expanding an answered card shows the options with the pick marked, and still opens the session', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    const onOpenAgent = vi.fn()
    render(<OpenQuestions onOpenAgent={onOpenAgent} />)
    await waitFor(() => expect(screen.getByText('Work on it')).toBeTruthy())
    fireEvent.click(screen.getByText('Work on it'))
    await waitFor(() => expect(screen.getByText('Expand')).toBeTruthy())
    fireEvent.click(screen.getByText('Expand'))
    // The picked option is back, inert, alongside the rest; the session link still works.
    expect(screen.getByText('Work on it')).toBeTruthy()
    expect(screen.getByText('Stop the loop')).toBeTruthy()
    fireEvent.click(screen.getByText('Open session →'))
    expect(onOpenAgent).toHaveBeenCalledWith('p1', 'run-1')
    fireEvent.click(screen.getByText('Collapse'))
    expect(screen.queryByText('Stop the loop')).toBeNull()
  })

  test('a failed post does not collapse: the gate is still open', async () => {
    sendChoice.mockRejectedValue(new Error('boom'))
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Work on it')).toBeTruthy())
    fireEvent.click(screen.getByText('Work on it'))
    // useAction surfaces the thrown Error's own message.
    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy())
    expect(screen.queryByText('Expand')).toBeNull()
    expect(screen.getByText('Waiting on you · 1')).toBeTruthy()
  })
})
