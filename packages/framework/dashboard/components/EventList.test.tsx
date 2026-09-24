import type { FrameworkEvent } from '../../src/index.js'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// The inline choice rows (#1455 item 6) mount real ChoicePanels, which post over the control
// stub; stub it (and the preferences plumbing) so nothing fetches a daemon that is not there.
const sendChoice = vi.hoisted(() => vi.fn())
vi.mock('../rpc/control.js', () => ({ sendChoice }))
vi.mock('../lib/preferences.js', () => ({
  usePreferences: () => ({}),
  updatePreferences: vi.fn(),
}))

const { EventList } = await import('./EventList.js')

beforeEach(() => {
  sendChoice.mockReset().mockResolvedValue(undefined)
})

afterEach(cleanup)

// The conversation view: the user's prompt is its own YOU row, the agent's reply is AGENT and
// renders as Markdown, and a long message collapses to its first line (#1035 follow-up).
describe('EventList conversation rows', () => {
  test('a prompt reads YOU and a reply reads AGENT', () => {
    const events: FrameworkEvent[] = [
      { kind: 'driver', event: { type: 'start', prompt: 'what is your name?' } },
      { kind: 'driver', event: { type: 'text', text: 'I am **Claude**.' } },
    ]
    render(<EventList events={events} stick={false} />)
    expect(screen.getByText('you')).toBeTruthy()
    expect(screen.getByText('agent')).toBeTruthy()
  })

  test('a row shows the time its line was written, and a line with no time shows none', () => {
    const at = '2026-09-25T10:04:05.000Z'
    const events: FrameworkEvent[] = [
      { kind: 'driver', event: { type: 'start', prompt: 'hello' }, at },
      { kind: 'driver', event: { type: 'text', text: 'hi' } },
    ]
    render(<EventList events={events} stick={false} />)
    expect(screen.getAllByText(new Date(at).toLocaleTimeString())).toHaveLength(1)
  })

  test('a prompt renders its text inline', () => {
    render(<EventList events={[{ kind: 'driver', event: { type: 'start', prompt: 'what is your name?' } }]} stick={false} />)
    expect(screen.getByText('what is your name?')).toBeTruthy()
  })

  test('a reply renders Markdown (bold, not raw asterisks)', () => {
    render(<EventList events={[{ kind: 'driver', event: { type: 'text', text: 'I am **Claude**.' } }]} stick={false} />)
    const strong = document.querySelector('strong')
    expect(strong?.textContent).toBe('Claude')
  })

  test('a long message collapses to its first line and offers to expand', () => {
    render(<EventList events={[{ kind: 'driver', event: { type: 'text', text: 'word '.repeat(40) } }]} stick={false} />)
    expect(screen.getByLabelText('Expand message')).toBeTruthy()
  })

  test('a short message renders inline without a collapse control', () => {
    render(<EventList events={[{ kind: 'driver', event: { type: 'text', text: 'all done' } }]} stick={false} />)
    expect(screen.queryByLabelText('Expand message')).toBeNull()
    expect(screen.getByText('all done')).toBeTruthy()
  })

  test('the tail renders inside the scroller, after the last row (#1265)', () => {
    render(
      <EventList
        events={[{ kind: 'driver', event: { type: 'text', text: 'all done' } }]}
        stick={false}
        tail={<div data-testid="tail-box">and then…</div>}
      />,
    )
    const tail = screen.getByTestId('tail-box')
    const viewport = screen.getByLabelText('Agent output')
    expect(viewport.contains(tail)).toBe(true)
    const row = screen.getByText('all done')
    // The tail follows the log rather than floating over it: document order puts it after the rows.
    expect(row.compareDocumentPosition(tail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// Colour carries meaning in the log (#1199/#1170): a failure is red, the reader's own turn is
// blue, and a stopped agent is neither, since stopping was asked for.
describe('EventList row colour', () => {
  test('an agent error renders in red (#1199)', () => {
    render(<EventList events={[{ kind: 'driver', event: { type: 'error', message: 'rate limited' } }]} stick={false} />)
    const row = screen.getByText(/agent error: rate limited/)
    expect(row.className).toContain('text-danger')
  })

  test('an error the agent reported itself renders in red (#1500)', () => {
    render(<EventList events={[{ kind: 'error', headline: 'gh is not logged in' }]} stick={false} />)
    expect(screen.getByText(/gh is not logged in/).className).toContain('text-danger')
  })

  test('a failed run renders in red (#1199)', () => {
    render(<EventList events={[{ kind: 'end', ok: false, detail: 'exited 1' }]} stick={false} />)
    expect(screen.getByText(/failed: exited 1/).className).toContain('text-danger')
  })

  test('a stopped run is not an error, so it is not red (#1199)', () => {
    render(<EventList events={[{ kind: 'end', ok: false, stopped: true }]} stick={false} />)
    expect(screen.getByText(/stopped/).className).not.toContain('text-danger')
  })

  test('a run waiting on its question is not a failure: it says so, and is not red (#1774)', () => {
    render(<EventList events={[{ kind: 'end', ok: false, waiting: true }]} stick={false} />)
    const row = screen.getByText(/waiting for an answer/)
    expect(row.className).not.toContain('text-danger')
    expect(screen.queryByText(/failed/)).toBeNull()
  })

  test('a finished run is not red (#1199)', () => {
    render(<EventList events={[{ kind: 'end', ok: true }]} stick={false} />)
    expect(screen.getByText(/finished/).className).not.toContain('text-danger')
  })

  test("the reader's own turn is blue (#1170)", () => {
    render(<EventList events={[{ kind: 'driver', event: { type: 'start', prompt: 'add a search box' } }]} stick={false} />)
    expect(screen.getByText('you').className).toContain('text-info')
  })
})

// The kind badge is tinted for scanning (#1455 follow-up): decisions amber, milestones green,
// pushed surfaces primary — the marker is coloured, not the body text.
describe('EventList badge tones', () => {
  const gate: FrameworkEvent = { kind: 'choice', id: 'g1', title: 'Proceed?', options: [{ id: 'a', label: 'Yes' }] }

  test('a choice badge is amber, and its body is not recoloured', () => {
    render(<EventList events={[gate]} stick={false} />)
    expect(screen.getByText('choice').className).toContain('text-warning')
    expect(screen.getByText(/Proceed\?/).className).not.toContain('text-warning')
  })

  test('a clean end badge is green; a stopped one stays muted', () => {
    render(<EventList events={[{ kind: 'end', ok: true }]} stick={false} />)
    expect(screen.getByText('end').className).toContain('text-success')
    cleanup()
    render(<EventList events={[{ kind: 'end', ok: false, stopped: true }]} stick={false} />)
    expect(screen.getByText('end').className).not.toContain('text-success')
  })

  test('a failed end keeps the failure red — semantics beat the kind map', () => {
    render(<EventList events={[{ kind: 'end', ok: false, detail: 'exited 1' }]} stick={false} />)
    expect(screen.getByText('end').className).toContain('text-danger')
  })

  test('a pushed view badge is primary', () => {
    render(<EventList events={[{ kind: 'view', id: 'v1', title: 'Plan', markdown: '# p' }]} stick={false} />)
    expect(screen.getByText('view').className).toContain('text-primary')
  })
})

// The prompt opens the log (#1170): it is emitted after `session`, so the one line the reader
// wrote used to sit under a row they did not write.
describe('EventList prompt placement', () => {
  const rowText = () => Array.from(document.querySelectorAll('[data-message-id]')).map(n => n.textContent ?? '')

  test('the first prompt is hoisted above the session row (#1170)', () => {
    const events: FrameworkEvent[] = [
      { kind: 'session', driver: 'claude-code', workspace: '/repo', fake: false },
      { kind: 'driver', event: { type: 'start', prompt: 'add a search box' } },
      { kind: 'driver', event: { type: 'text', text: 'done' } },
    ]
    render(<EventList events={events} stick={false} />)
    expect(rowText()[0]).toContain('add a search box')
  })

  test('a later turn stays where it happened, in the conversation (#1170)', () => {
    const events: FrameworkEvent[] = [
      { kind: 'session', driver: 'claude-code', workspace: '/repo', fake: false },
      { kind: 'driver', event: { type: 'start', prompt: 'first question' } },
      { kind: 'driver', event: { type: 'text', text: 'first answer' } },
      { kind: 'driver', event: { type: 'start', prompt: 'second question' } },
    ]
    render(<EventList events={events} stick={false} />)
    const rows = rowText()
    expect(rows[0]).toContain('first question')
    // Only the first prompt moves; the second must not be dragged up with it.
    expect(rows.at(-1)).toContain('second question')
  })

  test('a log with no prompt at all is left alone (#1170)', () => {
    const events: FrameworkEvent[] = [
      { kind: 'session', driver: 'claude-code', workspace: '/repo', fake: false },
      { kind: 'driver', event: { type: 'text', text: 'resumed reply' } },
    ]
    render(<EventList events={events} stick={false} />)
    expect(rowText()[0]).toContain('/repo')
  })
})

// A transcript entry that represents an interaction IS the interaction (#1455 item 6): with a
// projectId, an open `choice` row renders the same ChoicePanel the rail used to hold, and a
// resolved one collapses to the AnsweredChoice ✓ card.
describe('EventList inline choice rows (#1455 item 6)', () => {
  const gate = (id = 'gate-1'): FrameworkEvent => ({
    kind: 'choice',
    id,
    title: 'Start the next backlog item?',
    options: [
      { id: 'work', label: 'Work on it' },
      { id: 'stop', label: 'Stop the loop' },
    ],
    recommended: 'work',
  })
  const resolved = (id = 'gate-1'): FrameworkEvent => ({ kind: 'choice-resolved', id, picked: 'work', by: 'user' })

  test('an open gate renders the interactive panel, and a pick posts against the run', () => {
    render(<EventList events={[gate()]} stick={false} projectId="p1" agentId="r1" />)
    fireEvent.click(screen.getByText('Work on it'))
    expect(sendChoice).toHaveBeenCalledWith('p1', 'gate-1', 'work', 'r1')
  })

  test('without a projectId the row keeps the formatter text', () => {
    render(<EventList events={[gate()]} stick={false} />)
    expect(screen.queryByRole('button', { name: /Work on it/ })).toBeNull()
    expect(screen.getByText(/Start the next backlog item\?/)).toBeTruthy()
  })

  test('a resolved gate collapses to a ✓ line and hides its "chose" row', () => {
    render(<EventList events={[gate(), resolved()]} stick={false} projectId="p1" agentId="r1" />)
    const line = screen.getByRole('button', { name: /Start the next backlog item\?/ })
    expect(line.getAttribute('aria-expanded')).toBe('false')
    // The card says it better than the "✓ chose" formatter line, which is hidden with it there.
    expect(screen.queryByText(/chose/)).toBeNull()
    // And the gate is no longer answerable.
    expect(screen.queryByRole('region', { name: 'Start the next backlog item?' })).toBeNull()
  })

  test('the collapsed line expands to what was picked', () => {
    render(<EventList events={[gate(), resolved()]} stick={false} projectId="p1" agentId="r1" />)
    fireEvent.click(screen.getByRole('button', { name: /Start the next backlog item\?/ }))
    expect(screen.getByText('Work on it')).toBeTruthy()
    expect(screen.getByText('Stop the loop')).toBeTruthy()
  })

  test('a gate closed by end without an answer stays text — its audience is gone (#1359)', () => {
    render(
      <EventList events={[gate(), { kind: 'end', ok: false, stopped: true }]} stick={false} projectId="p1" agentId="r1" />,
    )
    expect(screen.queryByRole('button', { name: /Work on it/ })).toBeNull()
    expect(screen.getByText(/Start the next backlog item\?/)).toBeTruthy()
  })

  test('a run that ended waiting on its question keeps the question answerable, until the agent goes on (#1774)', () => {
    const waiting: FrameworkEvent = { kind: 'end', ok: false, waiting: true }
    const { rerender } = render(<EventList events={[gate(), waiting]} stick={false} projectId="p1" agentId="r1" />)
    fireEvent.click(screen.getByText('Work on it'))
    expect(sendChoice).toHaveBeenCalledWith('p1', 'gate-1', 'work', 'r1')
    // The answer resumed the run: its next turn closes the question.
    const next: FrameworkEvent = { kind: 'driver', event: { type: 'text', text: 'On it.' } }
    rerender(<EventList events={[gate(), waiting, next]} stick={false} projectId="p1" agentId="r1" />)
    expect(screen.queryByRole('button', { name: /Work on it/ })).toBeNull()
  })

  test('only the latest firing of a re-fired gate is interactive', () => {
    render(<EventList events={[gate(), gate()]} stick={false} projectId="p1" agentId="r1" />)
    expect(screen.getAllByText('Work on it')).toHaveLength(1)
  })
})

// The background wash (#1508): a tint across the whole line for the rows the eye hunts for —
// the reader's own turns, failures, the clean landing — while the bulk of the log stays plain.
describe('EventList row wash (#1508)', () => {
  test("the reader's own turn gets the blue wash", () => {
    const { container } = render(
      <EventList events={[{ kind: 'driver', event: { type: 'start', prompt: 'add a search box' } }]} stick={false} />,
    )
    expect(container.querySelector('[class*="bg-info/10"]')).toBeTruthy()
  })

  test('an agent-reported error gets the red wash too (#1500)', () => {
    const { container } = render(<EventList events={[{ kind: 'error', headline: 'push rejected' }]} stick={false} />)
    expect(container.querySelector('[class*="bg-danger/10"]')).toBeTruthy()
  })

  test('a failure gets the red wash', () => {
    const { container } = render(<EventList events={[{ kind: 'end', ok: false, detail: 'exited 1' }]} stick={false} />)
    expect(container.querySelector('[class*="bg-danger/10"]')).toBeTruthy()
  })

  test('a clean end gets the green wash; a stopped one gets none', () => {
    const { container } = render(<EventList events={[{ kind: 'end', ok: true }]} stick={false} />)
    expect(container.querySelector('[class*="bg-success/10"]')).toBeTruthy()
    cleanup()
    const { container: stopped } = render(<EventList events={[{ kind: 'end', ok: false, stopped: true }]} stick={false} />)
    expect(stopped.querySelector('[class*="bg-info"], [class*="bg-danger"], [class*="bg-success"]')).toBeNull()
  })

  test("an agent reply stays plain canvas — the log's bulk must not shout", () => {
    const { container } = render(
      <EventList events={[{ kind: 'driver', event: { type: 'text', text: 'working on it' } }]} stick={false} />,
    )
    expect(container.querySelector('[class*="bg-info"], [class*="bg-danger"], [class*="bg-success"]')).toBeNull()
  })
})

// A screen line (a command the agent ran showing a page, e.g. its browser): the newest open one is
// the live page framed in the chat, where the agent used it; an older one, or one after the run
// ended, is its one line; an `ended` line is hidden.
describe('EventList screen rows', () => {
  const at = (n: number) => `http://127.0.0.1:${n}/?t=x`
  const frames = () => [...document.querySelectorAll('iframe')].map(f => f.getAttribute('src'))

  test('the newest screen at an address is live; the one before it is its line', () => {
    const events: FrameworkEvent[] = [
      { kind: 'screen', url: at(1), label: 'browser · http://localhost:3000/' },
      { kind: 'driver', event: { type: 'text', text: 'looking' } },
      { kind: 'screen', url: at(1), label: 'browser · http://localhost:3000/b' },
    ]
    render(<EventList events={events} stick={false} />)
    expect(frames()).toEqual([at(1)])
    expect(screen.getByText('◆ browser · http://localhost:3000/')).toBeTruthy()
    expect(document.querySelector('iframe')?.getAttribute('title')).toBe('browser · http://localhost:3000/b')
  })

  test('an ended screen is gone: no frame, and its ended line is hidden', () => {
    const events: FrameworkEvent[] = [
      { kind: 'screen', url: at(1), label: 'browser · http://localhost:3000/' },
      { kind: 'screen', url: at(1), label: 'browser · closed', ended: true },
    ]
    render(<EventList events={events} stick={false} />)
    expect(frames()).toEqual([])
    expect(screen.queryByText('◆ browser · closed')).toBeNull()
    expect(screen.getByText('◆ browser · http://localhost:3000/')).toBeTruthy()
  })

  test('the run ending ends every screen', () => {
    const events: FrameworkEvent[] = [
      { kind: 'screen', url: at(1), label: 'browser · http://localhost:3000/' },
      { kind: 'end', ok: true },
    ]
    render(<EventList events={events} stick={false} />)
    expect(frames()).toEqual([])
  })

  test('a run waiting on an answer keeps its screen live', () => {
    const events: FrameworkEvent[] = [
      { kind: 'screen', url: at(1), label: 'browser · http://localhost:3000/' },
      { kind: 'end', ok: true, waiting: true },
    ]
    render(<EventList events={events} stick={false} />)
    expect(frames()).toEqual([at(1)])
  })

  test('only a loopback address is framed', () => {
    render(<EventList events={[{ kind: 'screen', url: 'https://example.com/', label: 'somewhere' }]} stick={false} />)
    expect(frames()).toEqual([])
    expect(screen.getByText('◆ somewhere')).toBeTruthy()
  })
})
