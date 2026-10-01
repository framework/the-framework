import type { AgentMeta, FrameworkEvent } from '../../src/index.js'
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

const { EventList, askedReplies, passedEnds } = await import('./EventList.js')

beforeEach(() => {
  sendChoice.mockReset().mockResolvedValue(undefined)
})

afterEach(cleanup)

// The conversation view: the user's prompt is its own YOU row, the agent's reply is AGENT and
// renders as Markdown, and a long message collapses to its first line (#1035 follow-up).
describe('EventList conversation rows', () => {
  test('a quota reading is a row only when the quota is running low or used up', () => {
    const quota = (status: string): FrameworkEvent => ({ kind: 'driver', event: { type: 'rate-limit', limit: { status, window: 'five_hour', resetsAt: Date.UTC(2026, 8, 30, 11, 30) } } })
    render(<EventList events={[{ kind: 'driver', event: { type: 'start', prompt: 'hello' } }, quota('allowed'), quota('allowed_warning'), quota('rejected')]} stick={false} />)
    expect(screen.queryByText(/quota allowed/)).toBeNull()
    expect(screen.getByText(/quota running low/)).toBeTruthy()
    expect(screen.getByText(/quota exhausted/)).toBeTruthy()
  })

  test("the agent's session id is not a row: it is plumbing, read by the run's menu", () => {
    const events: FrameworkEvent[] = [
      { kind: 'driver', event: { type: 'start', prompt: 'hello' } },
      { kind: 'session-update', sessionId: '88cd200f-6f76-4e3e-b694-b161ea9b5e3e' },
      { kind: 'driver', event: { type: 'text', text: 'hi' } },
    ]
    render(<EventList events={events} stick={false} />)
    expect(screen.queryByText(/88cd200f/)).toBeNull()
    expect(screen.queryByText('resume')).toBeNull()
  })

  test('a message just sent shows at once as the last prompt, a YOU row of its own', () => {
    const events: FrameworkEvent[] = [
      { kind: 'driver', event: { type: 'start', prompt: 'first' } },
      { kind: 'driver', event: { type: 'text', text: 'done' } },
    ]
    render(<EventList events={events} sending="second" stick={false} />)
    expect(screen.getByText('second')).toBeTruthy()
    expect(screen.getAllByText('you')).toHaveLength(2)
  })

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

// A run's subagents in its chat: a row where each was started, read off the subagent's card, and
// the prompt that told the run a subagent ended as a row of the subagent's, not the reader's.
describe('EventList subagent rows', () => {
  const sub = (over: Partial<AgentMeta> = {}): AgentMeta => ({
    status: 'running',
    id: '2026-10-01T10-01-00-000Z',
    startedAt: '2026-10-01T10:01:00.000Z',
    updatedAt: '2026-10-01T10:01:00.000Z',
    parent: 'main',
    intent: 'Validate the form\n\nYou are a subagent: another agent started you.',
    ...over,
  })
  const events: FrameworkEvent[] = [
    { kind: 'driver', event: { type: 'start', prompt: 'split the work' }, at: '2026-10-01T10:00:00.000Z' },
    { kind: 'driver', event: { type: 'action', label: 'Bash', detail: 'npx orchestration start' }, at: '2026-10-01T10:00:59.000Z' },
    { kind: 'driver', event: { type: 'text', text: 'I started one subagent.' }, at: '2026-10-01T10:01:05.000Z' },
  ]

  test('a working subagent has a row where it was started, saying its task and what it is doing now', () => {
    const { container } = render(<EventList events={events} subagents={[sub()]} doing={{ '2026-10-01T10-01-00-000Z': 'Edit login.ts' }} stick={false} />)
    expect(screen.getByText('subagent')).toBeTruthy()
    expect(screen.getByText(/Validate the form/)).toBeTruthy()
    expect(screen.getByText('running')).toBeTruthy()
    expect(screen.getByText('Edit login.ts')).toBeTruthy()
    expect(screen.queryByText(/You are a subagent/)).toBeNull()
    // Between the command that started it and what the agent said next.
    const text = container.textContent ?? ''
    expect(text.indexOf('npx orchestration start')).toBeLessThan(text.indexOf('Validate the form'))
    expect(text.indexOf('Validate the form')).toBeLessThan(text.indexOf('I started one subagent.'))
    // The agent's reply after the row shows its badge again: the row broke the agent's run of rows.
    expect(screen.getAllByText('agent')).toHaveLength(2)
  })

  test('the row of an ended subagent says how it ended and how long it took, and a click opens the subagent', () => {
    const opened: string[] = []
    render(<EventList events={events} subagents={[sub({ status: 'failed', endedAt: '2026-10-01T10:03:10.000Z' })]} doing={{ '2026-10-01T10-01-00-000Z': 'stale' }} onOpenAgent={id => opened.push(id)} stick={false} />)
    expect(screen.getByText('failed')).toBeTruthy()
    expect(screen.getByText('2m')).toBeTruthy()
    expect(screen.queryByText('stale')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open the subagent: Validate the form' }))
    expect(opened).toEqual(['2026-10-01T10-01-00-000Z'])
  })

  test('the prompt that told the run its subagent ended is a SUBAGENT row saying how it ended, not a YOU row', () => {
    const told: FrameworkEvent = {
      kind: 'driver',
      event: { type: 'start', prompt: 'The run 2026-10-01T10-01-00-000Z, started for this run, ended done.\nIts work is on the branch agent-form.' },
      at: '2026-10-01T10:04:00.000Z',
    }
    render(<EventList events={[...events, told]} subagents={[sub({ status: 'done', endedAt: '2026-10-01T10:03:10.000Z' })]} stick={false} />)
    expect(screen.getAllByText('you')).toHaveLength(1)
    expect(screen.getAllByText('subagent')).toHaveLength(2)
    expect(screen.getByText('ended done')).toBeTruthy()
    expect(screen.getByText(/Its work is on the branch agent-form/)).toBeTruthy()
    expect(screen.queryByText(/started for this run/)).toBeNull()
  })

  test("right after the reader's own prompt, the row of a subagent's end still shows its own badge", () => {
    const typed: FrameworkEvent = { kind: 'driver', event: { type: 'start', prompt: 'and then?' }, at: '2026-10-01T10:03:30.000Z' }
    const told: FrameworkEvent = { kind: 'driver', event: { type: 'start', prompt: 'The run 2026-10-01T10-01-00-000Z, started for this run, ended done.' }, at: '2026-10-01T10:04:00.000Z' }
    render(<EventList events={[...events, typed, told]} subagents={[sub({ status: 'done', endedAt: '2026-10-01T10:03:10.000Z' })]} stick={false} />)
    expect(screen.getAllByText('you')).toHaveLength(2)
    expect(screen.getAllByText('subagent')).toHaveLength(2)
  })

  test('a subagent started right after another one ended goes on under the same SUBAGENT badge', () => {
    const told: FrameworkEvent = { kind: 'driver', event: { type: 'start', prompt: 'The run 2026-10-01T10-01-00-000Z, started for this run, ended done.' }, at: '2026-10-01T10:04:00.000Z' }
    const next = sub({ id: '2026-10-01T10-04-01-000Z', startedAt: '2026-10-01T10:04:01.000Z', intent: 'Second task' })
    const after: FrameworkEvent = { kind: 'driver', event: { type: 'text', text: 'Started the second.' }, at: '2026-10-01T10:04:05.000Z' }
    render(<EventList events={[...events, told, after]} subagents={[sub({ status: 'done', endedAt: '2026-10-01T10:03:10.000Z' }), next]} stick={false} />)
    // The first subagent's row, then its end and the second's row as one run of rows.
    expect(screen.getAllByText('subagent')).toHaveLength(2)
    expect(screen.getByText(/Second task/)).toBeTruthy()
  })

  test("a subagent's end right under the row of a subagent just started goes on under that row's badge", () => {
    const told: FrameworkEvent = { kind: 'driver', event: { type: 'start', prompt: 'The run 2026-10-01T10-01-00-000Z, started for this run, ended done.' }, at: '2026-10-01T10:04:00.000Z' }
    const second = sub({ id: '2026-10-01T10-03-59-000Z', startedAt: '2026-10-01T10:03:59.000Z', intent: 'Second task' })
    render(<EventList events={[...events, told]} subagents={[sub({ status: 'done', endedAt: '2026-10-01T10:03:10.000Z' }), second]} stick={false} />)
    expect(screen.getAllByText('subagent')).toHaveLength(2)
    expect(screen.getByText('ended done')).toBeTruthy()
  })

  test('the message being written under a subagent row at the end of the log shows the AGENT badge', () => {
    render(<EventList events={events} subagents={[sub({ id: '2026-10-01T10-09-00-000Z', startedAt: '2026-10-01T10:09:00.000Z', intent: 'Late task' })]} writing="Now I wait" stick={false} />)
    expect(screen.getAllByText('agent')).toHaveLength(2)
  })

  test('the same words about a run that is not a subagent of this one stay a YOU row', () => {
    const typed: FrameworkEvent = { kind: 'driver', event: { type: 'start', prompt: 'The run 2026-10-01T10-01-00-000Z, started for this run, ended done.' } }
    render(<EventList events={[...events, typed]} stick={false} />)
    expect(screen.getAllByText('you')).toHaveLength(2)
    expect(screen.queryByText('subagent')).toBeNull()
  })

  test('a subagent started after the last line is the last row', () => {
    const { container } = render(<EventList events={events} subagents={[sub({ id: 'late', startedAt: '2026-10-01T10:09:00.000Z', intent: 'Late task' })]} stick={false} />)
    const text = container.textContent ?? ''
    expect(text.indexOf('I started one subagent.')).toBeLessThan(text.indexOf('Late task'))
  })
})

// What the run's details already count is not said again in the chat, and "finished" is said once.
describe('EventList turn ends', () => {
  const prompt = (text: string): FrameworkEvent => ({ kind: 'driver', event: { type: 'start', prompt: text } })
  const reply = (text: string): FrameworkEvent => ({ kind: 'driver', event: { type: 'text', text } })
  const turnEnd = { kind: 'driver', event: { type: 'result', text: '' } } as FrameworkEvent
  const cost: FrameworkEvent = { kind: 'usage', costUsd: 0.12 }
  const end = (over: Record<string, unknown> = {}) => ({ kind: 'end', ok: true, ...over }) as FrameworkEvent

  test("a turn's end and the spend so far are not rows", () => {
    render(<EventList events={[prompt('go'), reply('did it'), turnEnd, cost, end()]} stick={false} />)
    expect(screen.queryByText(/turn complete/)).toBeNull()
    expect(screen.queryByText(/spend/)).toBeNull()
    expect(screen.queryByText('cost')).toBeNull()
    expect(screen.getByText(/finished/)).toBeTruthy()
  })

  test('a clean end the run went on after is not a row: only the last one says finished', () => {
    render(<EventList events={[prompt('go'), reply('one'), end(), prompt('more'), reply('two'), end()]} stick={false} />)
    expect(screen.getAllByText(/finished/)).toHaveLength(1)
  })

  test('the last clean end is not a row while the run is still going', () => {
    render(<EventList events={[prompt('go'), reply('started them'), end()]} going stick={false} />)
    expect(screen.queryByText(/finished/)).toBeNull()
  })

  test('a message just sent takes the place of the end above it at once, clean or waiting; a failed end stays', () => {
    const { unmount } = render(<EventList events={[prompt('go'), reply('did it'), end()]} sending="and now this" stick={false} />)
    expect(screen.queryByText(/finished/)).toBeNull()
    unmount()
    render(<EventList events={[prompt('go'), end({ ok: false, waiting: true })]} sending="my answer" stick={false} />)
    expect(screen.queryByText(/waiting for an answer/)).toBeNull()
    cleanup()
    render(<EventList events={[prompt('go'), end({ ok: false, detail: 'boom' })]} sending="try again" stick={false} />)
    expect(screen.getByText(/failed: boom/)).toBeTruthy()
  })

  test('an end that is not clean stays where it happened, and so does the clean end after it', () => {
    const first = end({ ok: false, detail: 'boom' })
    const stopped = end({ ok: false, stopped: true })
    const last = end()
    const events = [prompt('go'), first, prompt('again'), stopped, prompt('once more'), last]
    expect(passedEnds(events, false).size).toBe(0)
    expect([...passedEnds(events, true)]).toEqual([last])
    // What is written after the last end without a new prompt (a pull request line) leaves it the run's end.
    expect(passedEnds([prompt('go'), last, { kind: 'log', message: 'recorded' } as FrameworkEvent], false).size).toBe(0)
    // A failed last end is the run's end even while it is going.
    expect(passedEnds([prompt('go'), first], true).size).toBe(0)
  })

  test('an end waiting on an answer is not a row once the answer came, and is one until then, going or not', () => {
    const asked = end({ ok: false, waiting: true })
    expect([...passedEnds([prompt('go'), asked, prompt('Approve'), reply('on it')], false)]).toEqual([asked])
    expect(passedEnds([prompt('go'), asked], true).size).toBe(0)
    render(<EventList events={[prompt('go'), asked]} going stick={false} />)
    expect(screen.getByText(/waiting for an answer/)).toBeTruthy()
  })
})

describe('EventList replies a question follows', () => {
  const long = 'The plan is saved. '.repeat(10)
  const prompt: FrameworkEvent = { kind: 'driver', event: { type: 'start', prompt: 'plan it' } }
  const reply = (text: string): FrameworkEvent => ({ kind: 'driver', event: { type: 'text', text } })
  const choice = { kind: 'choice', id: 'await-choices', title: 'Start?', options: [{ id: 'a', label: 'Approve' }] } as FrameworkEvent

  test('the reply a question follows is shown whole, and a click folds it', () => {
    render(<EventList events={[prompt, reply(long), { kind: 'usage', costUsd: 0.1 }, choice]} stick={false} />)
    const toggle = screen.getByRole('button', { name: 'Collapse message' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Expand message' }).getAttribute('aria-expanded')).toBe('false')
  })

  test('any other long reply is folded: one before it in the turn, and one no question follows', () => {
    const early = reply(long + 'early')
    const asked = reply(long + 'asked')
    const later = reply(long + 'later')
    const events = [prompt, early, asked, choice, { kind: 'driver', event: { type: 'start', prompt: 'Approve' } } as FrameworkEvent, later, { kind: 'usage', costUsd: 0.2 } as FrameworkEvent]
    expect([...askedReplies(events)]).toEqual([asked])
    // A question in a later turn is not about a reply of the turn before.
    expect(askedReplies([prompt, early, { kind: 'driver', event: { type: 'start', prompt: 'go on' } } as FrameworkEvent, choice]).size).toBe(0)
    render(<EventList events={events} stick={false} />)
    expect(screen.getAllByRole('button', { name: 'Expand message' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Collapse message' })).toHaveLength(1)
  })
})

// The scroller brings its anchor to the top; only the newest prompt may be one.
describe('EventList scroll anchor', () => {
  const prompt = (text: string): FrameworkEvent => ({ kind: 'driver', event: { type: 'start', prompt: text } })
  const reply = (text: string): FrameworkEvent => ({ kind: 'driver', event: { type: 'text', text } })
  const anchors = (container: HTMLElement) => [...container.querySelectorAll('[data-scroll-anchor="true"]')].map(el => el.textContent)

  test('only the newest prompt is the anchor, and a message just sent takes it over', () => {
    const events = [prompt('first'), reply('one'), { kind: 'end', ok: true } as FrameworkEvent, prompt('second'), reply('two')]
    const { container, rerender } = render(<EventList events={events} stick={false} />)
    expect(anchors(container)).toHaveLength(1)
    expect(anchors(container)[0]).toContain('second')
    rerender(<EventList events={events} sending="third" stick={false} />)
    expect(anchors(container)).toHaveLength(1)
    expect(anchors(container)[0]).toContain('third')
  })

  test('a row keeps its identity when a row above it stops being shown', () => {
    const events = [prompt('first'), reply('one'), { kind: 'end', ok: true } as FrameworkEvent]
    const { container, rerender } = render(<EventList events={events} stick={false} />)
    const ids = () => [...container.querySelectorAll('[data-message-id]')].map(el => el.getAttribute('data-message-id'))
    expect(ids()).toEqual(['0', '1', '2'])
    // The run goes on: the end is no longer a row, and the new rows are known by their own place in the log.
    rerender(<EventList events={[...events, prompt('second'), reply('two')]} stick={false} />)
    expect(ids()).toEqual(['0', '1', '3', '4'])
  })
})
