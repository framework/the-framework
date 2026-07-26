import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { FrameworkEvent } from '@gemstack/the-framework'

// The component reads the bridge over telefunc, and an unmocked telefunc module dies in the
// browser test environment with `assertIsNotBrowser`, which reads as a telefunc bug and is not.
const onBridgeQuestion = vi.fn(async () => null as unknown)
vi.mock('../server/reads.telefunc.js', () => ({ onBridgeQuestion }))

const { CloudRunNotice } = await import('./CloudRunNotice.js')

afterEach(() => {
  cleanup()
  onBridgeQuestion.mockReset()
  onBridgeQuestion.mockResolvedValue(null)
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

  test('points at the session to answer, since the pick cannot travel back yet', async () => {
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
