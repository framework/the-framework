import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FrameworkEvent } from '@gemstack/the-framework'

// The component reads the bridge over telefunc, and an unmocked telefunc module dies in the
// browser test environment with `assertIsNotBrowser`, which reads as a telefunc bug and is not.
const onBridgeQuestion = vi.fn(async () => null as unknown)
const onBridgeEvents = vi.fn(async () => [] as unknown)
const onBridgeAnswer = vi.fn(async () => null as unknown)
vi.mock('../server/reads.telefunc.js', () => ({ onBridgeQuestion, onBridgeEvents, onBridgeAnswer }))
const sendBridgeAnswer = vi.fn(async () => ({ ok: true }) as { ok: boolean; error?: string })
const sendBridgeAnswerCancel = vi.fn(async () => undefined)
vi.mock('../server/control.telefunc.js', () => ({ sendBridgeAnswer, sendBridgeAnswerCancel }))

const { CloudRunNotice } = await import('./CloudRunNotice.js')

afterEach(() => {
  cleanup()
  onBridgeQuestion.mockReset()
  onBridgeQuestion.mockResolvedValue(null)
  onBridgeEvents.mockReset()
  onBridgeEvents.mockResolvedValue([])
  onBridgeAnswer.mockReset()
  onBridgeAnswer.mockResolvedValue(null)
  sendBridgeAnswer.mockReset()
  sendBridgeAnswer.mockResolvedValue({ ok: true })
  sendBridgeAnswerCancel.mockReset()
})

const URL = 'https://claude.ai/code/session_01ABCdefGHIjklMNO?from=cli&m=0'
const handOff = (url = URL): FrameworkEvent => ({ kind: 'driver', event: { type: 'action', label: `cloud ${url}` } })

const QUESTION = {
  sessionId: 'session_01ABCdefGHIjklMNO',
  title: 'Where should the tickets page live?',
  options: [{ label: 'One page, both routes', detail: 'lists every project' }, { label: 'Cross-project only' }],
  recommended: 'One page, both routes',
  receivedAt: '2026-07-26T18:00:00.000Z',
}

describe('CloudRunNotice (#610)', () => {
  test('says the session is still being created before the hand-off lands', () => {
    render(<CloudRunNotice target="web" events={[]} />)
    expect(screen.getByRole('status').textContent).toMatch(/Starting a Claude Code cloud session/i)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('links through to the cloud session once the driver reports it', () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    expect(screen.getByRole('link', { name: /Open the session/i }).getAttribute('href')).toBe(URL)
  })

  test('offers the teleport command, which is how the work comes back to this machine', () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    expect(screen.getByRole('status').textContent).toMatch(/claude --teleport session_01ABCdefGHIjklMNO/)
  })

  test('says the cloud session opens its own PR, since nothing streams back here', () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    expect(screen.getByRole('status').textContent).toMatch(/opens its own pull request/i)
  })

  test('says the session asks its questions over there, since none can be answered here (#1225)', () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    expect(screen.getByRole('status').textContent).toMatch(/asks its questions.*over there, not here/i)
  })

  test('renders nothing for the other targets', () => {
    for (const target of ['local', 'actions', 'remote'] as const) {
      const { container } = render(<CloudRunNotice target={target} events={[handOff()]} />)
      expect(container.firstChild).toBeNull()
    }
    expect(render(<CloudRunNotice events={[]} />).container.firstChild).toBeNull()
  })
})

describe('the parked question the bridge reports (#1237)', () => {
  test('shows the question and its options once the bridge has one', async () => {
    onBridgeQuestion.mockResolvedValue(QUESTION)
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    await waitFor(() => expect(screen.getByText(QUESTION.title)).toBeTruthy())
    expect(screen.getByText('One page, both routes')).toBeTruthy()
    expect(screen.getByText('Cross-project only')).toBeTruthy()
    expect(screen.getByText(/recommended/i)).toBeTruthy()
  })

  test('is asked for by cloud session id, which is what the bridge can see', async () => {
    onBridgeQuestion.mockResolvedValue(QUESTION)
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    await waitFor(() => expect(onBridgeQuestion).toHaveBeenCalledWith('session_01ABCdefGHIjklMNO'))
  })

  test('keeps the link out as the manual way to answer', async () => {
    onBridgeQuestion.mockResolvedValue(QUESTION)
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    const link = await screen.findByRole('link', { name: /Answer it in the session/i })
    expect(link.getAttribute('href')).toBe(URL)
  })

  test('shows nothing extra when no question is parked, so an ordinary run is unchanged', async () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    await waitFor(() => expect(onBridgeQuestion).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: /Answer it in the session/i })).toBeNull()
  })

  test('never asks before the hand-off lands: there is no session to ask about', () => {
    render(<CloudRunNotice target="web" events={[]} />)
    expect(onBridgeQuestion).not.toHaveBeenCalled()
  })
})

describe('answering from the dashboard (#1237)', () => {
  const ANSWER = { id: 'a1', sessionId: 'session_01ABCdefGHIjklMNO', label: 'Cross-project only', queuedAt: '', state: 'queued' as const }

  test('a pick has to be confirmed before anything is sent', async () => {
    onBridgeQuestion.mockResolvedValue(QUESTION)
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    const send = await screen.findByRole('button', { name: /Pick an answer/i })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Cross-project only/i }))
    const confirm = screen.getByRole('button', { name: /Send .Cross-project only./i })
    expect(sendBridgeAnswer).not.toHaveBeenCalled()
    fireEvent.click(confirm)
    await waitFor(() => expect(sendBridgeAnswer).toHaveBeenCalledWith('session_01ABCdefGHIjklMNO', 'Cross-project only'))
  })

  test('a queued answer shows as on its way, and can still be withdrawn', async () => {
    onBridgeQuestion.mockResolvedValue(QUESTION)
    onBridgeAnswer.mockResolvedValue(ANSWER)
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    await waitFor(() => expect(screen.getByText(/Sending .Cross-project only./i)).toBeTruthy())
    // The question card yields to the sending state, so a second pick cannot race the first.
    expect(screen.queryByText(QUESTION.title)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    await waitFor(() => expect(sendBridgeAnswerCancel).toHaveBeenCalledWith('session_01ABCdefGHIjklMNO'))
  })

  test('a delivered answer reads as answered, with the question gone', async () => {
    onBridgeAnswer.mockResolvedValue({ ...ANSWER, state: 'sent' })
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    await waitFor(() => expect(screen.getByText(/Answered .Cross-project only./i)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Cancel/i })).toBeNull()
  })

  test('a failed delivery says so and offers the question again', async () => {
    onBridgeQuestion.mockResolvedValue(QUESTION)
    onBridgeAnswer.mockResolvedValue({ ...ANSWER, state: 'failed', note: 'no composer on the page' })
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    await waitFor(() => expect(screen.getByText(/failed: no composer on the page/i)).toBeTruthy())
    expect(screen.getByText(QUESTION.title)).toBeTruthy()
  })
})

describe('the transcript the bridge scrapes (#1237)', () => {
  test('renders what the session has said, in order', async () => {
    onBridgeEvents.mockResolvedValue([
      { sessionId: 'session_01ABCdefGHIjklMNO', seq: 0, role: 'agent', text: 'Reading the repo', receivedAt: '' },
      { sessionId: 'session_01ABCdefGHIjklMNO', seq: 1, role: 'agent', text: 'Found three packages', receivedAt: '' },
    ])
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    await waitFor(() => expect(screen.getByText('Reading the repo')).toBeTruthy())
    expect(screen.getByText('Found three packages')).toBeTruthy()
  })

  test('shows nothing when the bridge has scraped nothing, so a run with no tab is unchanged', async () => {
    render(<CloudRunNotice target="web" events={[handOff()]} />)
    await waitFor(() => expect(onBridgeEvents).toHaveBeenCalled())
    expect(screen.queryByText(/Reading the repo/)).toBeNull()
  })

  test('never asks before the hand-off, since there is no session to ask about', () => {
    render(<CloudRunNotice target="web" events={[]} />)
    expect(onBridgeEvents).not.toHaveBeenCalled()
  })
})
