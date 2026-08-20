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

  test('a failed run renders in red (#1199)', () => {
    render(<EventList events={[{ kind: 'end', ok: false, detail: 'exited 1' }]} stick={false} />)
    expect(screen.getByText(/failed: exited 1/).className).toContain('text-danger')
  })

  test('a stopped run is not an error, so it is not red (#1199)', () => {
    render(<EventList events={[{ kind: 'end', ok: false, stopped: true }]} stick={false} />)
    expect(screen.getByText(/stopped/).className).not.toContain('text-danger')
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

// The prompt opens the log (#1170): it is emitted after `session` and `system-prompt`, so the one
// line the reader wrote used to sit under a char-count summary of a prompt they did not write.
describe('EventList prompt placement', () => {
  const rowText = () => Array.from(document.querySelectorAll('[data-message-id]')).map(n => n.textContent ?? '')

  test('the first prompt is hoisted above the session and system-prompt rows (#1170)', () => {
    const events: FrameworkEvent[] = [
      { kind: 'session', driver: 'claude-code', workspace: '/repo', fake: false },
      { kind: 'system-prompt', text: 'you are a careful engineer' },
      { kind: 'driver', event: { type: 'start', prompt: 'add a search box' } },
      { kind: 'driver', event: { type: 'text', text: 'done' } },
    ]
    render(<EventList events={events} stick={false} />)
    expect(rowText()[0]).toContain('add a search box')
  })

  test('a later turn stays where it happened, in the conversation (#1170)', () => {
    const events: FrameworkEvent[] = [
      { kind: 'system-prompt', text: 'you are a careful engineer' },
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
      { kind: 'system-prompt', text: 'you are a careful engineer' },
      { kind: 'driver', event: { type: 'text', text: 'resumed reply' } },
    ]
    render(<EventList events={events} stick={false} />)
    expect(rowText()[0]).toContain('system prompt sent')
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
    expect(sendChoice).toHaveBeenCalledWith('p1', 'gate-1', 'work', 'user', 'r1')
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

  test('only the latest firing of a re-fired gate is interactive', () => {
    render(<EventList events={[gate(), gate()]} stick={false} projectId="p1" agentId="r1" />)
    expect(screen.getAllByText('Work on it')).toHaveLength(1)
  })
})

// The latest `browser` row hosts the live inline preview (#1455 item 6b); earlier rows and the
// a feed without both halves keeps the formatter's text, and an ended agent's pane degrades (#1359).
describe('EventList inline browser rows (#1455 item 6b)', () => {
  const browser = (url = 'https://app.test/'): FrameworkEvent => ({ kind: 'browser', url })

  test('the latest browser row hosts the pane; an earlier one keeps its one-liner', () => {
    render(
      <EventList events={[browser('https://a.test/'), browser('https://b.test/')]} stick={false} projectId="p1" agentId="r1" />,
    )
    expect(screen.getAllByAltText("The agent's browser")).toHaveLength(1)
    expect(screen.getByText(/browser: https:\/\/a\.test\//)).toBeTruthy()
  })

  test('a re-said URL replaces its earlier row instead of stacking (the view re-show rule)', () => {
    render(
      <EventList events={[browser('https://a.test/'), browser('https://a.test/')]} stick={false} projectId="p1" agentId="r1" />,
    )
    expect(screen.getAllByAltText("The agent's browser")).toHaveLength(1)
    expect(screen.queryByText(/browser: https:\/\/a\.test\//)).toBeNull()
  })

  test('after end, a pane with no captured frame degrades to the one-liner (#1359)', () => {
    render(
      <EventList events={[browser('https://a.test/'), { kind: 'end', ok: true }]} stick={false} projectId="p1" agentId="r1" />,
    )
    expect(screen.queryByAltText("The agent's browser")).toBeNull()
    expect(screen.getByText(/browser · https:\/\/a\.test\//)).toBeTruthy()
  })

  test('without a agentId the row keeps the formatter text', () => {
    render(<EventList events={[browser()]} stick={false} projectId="p1" />)
    expect(screen.queryByAltText("The agent's browser")).toBeNull()
    expect(screen.getByText(/browser: https:\/\/app\.test\//)).toBeTruthy()
  })

  test('a browser badge is primary — a pushed surface', () => {
    render(<EventList events={[browser()]} stick={false} />)
    expect(screen.getByText('browser').className).toContain('text-primary')
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
