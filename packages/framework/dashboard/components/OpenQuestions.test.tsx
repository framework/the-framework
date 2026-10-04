import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { OpenQuestion } from '../../src/index.js'

// The list polls onOpenQuestions over the reads stub; stub it so nothing fetches a daemon that is
// not there. The control stub is mocked only to prove the list never answers.
const onOpenQuestions = vi.hoisted(() => vi.fn())
vi.mock('../rpc/reads.js', () => ({ onOpenQuestions }))
const sendChoice = vi.hoisted(() => vi.fn())
const sendMessage = vi.hoisted(() => vi.fn())
vi.mock('../rpc/control.js', () => ({ sendChoice, sendMessage }))

const { OpenQuestions } = await import('./OpenQuestions.js')

beforeEach(() => {
  onOpenQuestions.mockReset().mockResolvedValue([])
  sendChoice.mockReset()
  sendMessage.mockReset()
})

afterEach(cleanup)

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString()

const question = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  projectId: 'p1',
  projectName: 'alpha',
  agentId: 'run-1',
  intent: 'triage-queue',
  updatedAt: minutesAgo(12),
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
const second = () =>
  question({ projectId: 'p2', projectName: 'beta', agentId: 'run-9', intent: 'fix-ci', updatedAt: minutesAgo(3), choice: { id: 'gate-2', title: 'Approve the fix?', options: [{ id: 'ok', label: 'Approve it' }], recommended: 'ok' } })

const rows = () => screen.getAllByRole('listitem')

describe('OpenQuestions', () => {
  test('renders nothing while nothing waits: no section, no heading', async () => {
    const { container } = render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(onOpenQuestions).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  test('a row says, in order: Needs input, the agent, its question, its project, how long ago', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Waiting on you · 1')).toBeTruthy())
    expect(rows().map(row => [...row.querySelectorAll('button > span')].map(part => part.textContent))).toEqual([
      ['Needs input', 'triage-queue', 'Start the next backlog item?', 'alpha', '12m ago'],
    ])
    // The arrow closes the row.
    expect(rows()[0]!.querySelector('button')!.lastElementChild!.tagName.toLowerCase()).toBe('svg')
  })

  test('a row is named for all it says: the agent by the first line of its intent, else by its id, then its question', async () => {
    const { intent: _intent, ...unnamed } = second()
    onOpenQuestions.mockResolvedValue([question({ intent: 'fix the flaky test\nmore detail' }), unnamed])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open fix the flaky test: needs input, Start the next backlog item?' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Open run-9: needs input, Approve the fix?' })).toBeTruthy()
  })

  test('a question with no time says nothing about when', async () => {
    const { updatedAt: _updatedAt, ...timeless } = question()
    onOpenQuestions.mockResolvedValue([timeless])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(rows()[0]!.textContent).toBe('Needs inputtriage-queueStart the next backlog item?alpha')
  })

  test('rows keep the order the server gives, one per agent', async () => {
    onOpenQuestions.mockResolvedValue([question(), second()])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Waiting on you · 2')).toBeTruthy())
    expect(rows().map(row => row.querySelector('button')!.getAttribute('aria-label'))).toEqual(['Open triage-queue: needs input, Start the next backlog item?', 'Open fix-ci: needs input, Approve the fix?'])
  })

  test('a row opens its own agent, in its own project', async () => {
    onOpenQuestions.mockResolvedValue([question(), second()])
    const onOpenAgent = vi.fn()
    render(<OpenQuestions onOpenAgent={onOpenAgent} />)
    fireEvent.click(await screen.findByRole('button', { name: /^Open fix-ci:/ }))
    expect(onOpenAgent).toHaveBeenCalledTimes(1)
    expect(onOpenAgent).toHaveBeenCalledWith('p2', 'run-9')
    fireEvent.click(screen.getByRole('button', { name: /^Open triage-queue:/ }))
    expect(onOpenAgent).toHaveBeenLastCalledWith('p1', 'run-1')
  })

  test('with one project named, only its questions show', async () => {
    onOpenQuestions.mockResolvedValue([question(), second()])
    const { unmount } = render(<OpenQuestions projectId="p2" onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Waiting on you · 1')).toBeTruthy())
    expect(screen.getByText('Approve the fix?')).toBeTruthy()
    expect(screen.queryByText('Start the next backlog item?')).toBeNull()
    unmount()
    // A project with no question of its own shows no section at all.
    const { container } = render(<OpenQuestions projectId="p3" onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(onOpenQuestions).toHaveBeenCalledTimes(2))
    expect(container.querySelector('section')).toBeNull()
  })

  test('nothing is answered in the list: no option, no Submit, no Skip, and a click sends nothing', async () => {
    onOpenQuestions.mockResolvedValue([question()])
    render(<OpenQuestions onOpenAgent={vi.fn()} />)
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getAllByRole('button')).toHaveLength(1)
    for (const words of ['Work on it', 'Stop the loop', 'Submit', 'Skip']) expect(screen.queryByText(words)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Open triage-queue:/ }))
    expect(sendChoice).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  test('a row stays the same row when its agent asks another question', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      onOpenQuestions.mockResolvedValue([question()])
      render(<OpenQuestions onOpenAgent={vi.fn()} />)
      const before = await screen.findByRole('button', { name: 'Open triage-queue: needs input, Start the next backlog item?' })
      onOpenQuestions.mockResolvedValue([question({ choice: { id: 'gate-3', title: 'Open the pull request?', options: [{ id: 'yes', label: 'Yes' }] } })])
      // The next poll brings the new question.
      await vi.advanceTimersByTimeAsync(5000)
      await waitFor(() => expect(screen.getByText('Open the pull request?')).toBeTruthy())
      expect(screen.getByRole('button', { name: 'Open triage-queue: needs input, Open the pull request?' })).toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })
})
