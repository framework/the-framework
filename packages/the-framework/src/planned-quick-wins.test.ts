import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  insertQueueEntry,
  isAutoImplementable,
  parsePlanVerdict,
  parseTicketHeader,
  planPathFor,
  plannedQueueMessage,
  promotePlannedQuickWins,
  queueEntryFor,
  ticketForPlan,
} from './planned-quick-wins.js'

describe('parsePlanVerdict (#1334)', () => {
  it('reads both keys out of the header', () => {
    const md = ['Effort: quick-win', 'Consensus: consensual', '', '# [Plan] Something', '', '## Plan', ''].join('\n')
    assert.deepEqual(parsePlanVerdict(md), { effort: 'quick-win', consensus: 'consensual' })
  })

  it('stops at the first section, so prose cannot declare a verdict', () => {
    const md = ['# [Plan] Something', '', '## Plan', '', 'Effort: quick-win', 'Consensus: consensual'].join('\n')
    assert.deepEqual(parsePlanVerdict(md), {})
  })

  it('ignores a value it does not recognize rather than guessing', () => {
    const md = ['Effort: trivial', 'Consensus: yes', '', '# [Plan] X'].join('\n')
    assert.deepEqual(parsePlanVerdict(md), {})
  })

  it('is case-insensitive on the key and the value', () => {
    assert.deepEqual(parsePlanVerdict('effort: QUICK-WIN\nCONSENSUS: Consensual\n\n# [Plan] X'), {
      effort: 'quick-win',
      consensus: 'consensual',
    })
  })
})

describe('isAutoImplementable (#1334)', () => {
  it('needs both keys, explicitly', () => {
    assert.equal(isAutoImplementable({ effort: 'quick-win', consensus: 'consensual' }), true)
    assert.equal(isAutoImplementable({ effort: 'quick-win' }), false)
    assert.equal(isAutoImplementable({ consensus: 'consensual' }), false)
    assert.equal(isAutoImplementable({}), false)
  })

  it('refuses anything the plan flagged', () => {
    assert.equal(isAutoImplementable({ effort: 'significant', consensus: 'consensual' }), false)
    assert.equal(isAutoImplementable({ effort: 'quick-win', consensus: 'open-questions' }), false)
  })
})

describe('plan and ticket paths', () => {
  it('round-trips', () => {
    assert.equal(planPathFor('tickets/2026-07-28_x.md'), 'tickets/2026-07-28_x.plan.md')
    assert.equal(ticketForPlan('tickets/2026-07-28_x.plan.md'), 'tickets/2026-07-28_x.md')
  })

  it('does not treat a ticket or a spike as a plan', () => {
    assert.equal(ticketForPlan('tickets/2026-07-28_x.md'), undefined)
    assert.equal(ticketForPlan('tickets/2026-07-28_x.spike.md'), undefined)
  })
})

describe('parseTicketHeader', () => {
  it('reads the title, the numeric priority and the status', () => {
    const md = ['Status: open', 'Priority: 8', '', '# Fix the thing', '', '## TLDR', ''].join('\n')
    assert.deepEqual(parseTicketHeader(md), { title: 'Fix the thing', priority: 8, open: true })
  })

  it('treats an unmarked status as open', () => {
    assert.equal(parseTicketHeader('# Title').open, true)
  })

  it('reads a closed ticket as closed', () => {
    assert.equal(parseTicketHeader('Status: closed\n\n# Title').open, false)
  })
})

describe('insertQueueEntry (#1334)', () => {
  const queue = ['# TODO_AGENTS', '', '## Priority 9', '', '- [A](tickets/a.md)', '', '## Priority 5', '', '- [B](tickets/b.md)', ''].join('\n')

  it('adds to the end of the matching priority section, not the end of the file', () => {
    const out = insertQueueEntry(queue, '[C](tickets/c.md)', 9)
    const lines = out.split('\n')
    assert.deepEqual(lines.slice(2, 6), ['## Priority 9', '', '- [A](tickets/a.md)', '- [C](tickets/c.md)'])
    // Still above the less urgent section: order in the file is the drain order.
    assert.ok(out.indexOf('tickets/c.md') < out.indexOf('## Priority 5'))
  })

  it('creates a missing section in descending order', () => {
    const out = insertQueueEntry(queue, '[C](tickets/c.md)', 7)
    assert.ok(out.indexOf('## Priority 9') < out.indexOf('## Priority 7'))
    assert.ok(out.indexOf('## Priority 7') < out.indexOf('## Priority 5'))
    assert.ok(out.includes('- [C](tickets/c.md)'))
  })

  it('puts the least urgent section last', () => {
    const out = insertQueueEntry(queue, '[C](tickets/c.md)', 1)
    assert.ok(out.indexOf('## Priority 5') < out.indexOf('## Priority 1'))
    assert.ok(out.trimEnd().endsWith('- [C](tickets/c.md)'))
  })

  it('appends to a file with no priority headings at all', () => {
    assert.equal(insertQueueEntry('# TODO_AGENTS\n', '[C](tickets/c.md)', 5), '# TODO_AGENTS\n- [C](tickets/c.md)\n')
  })
})

/** A promotion driven off in-memory files, so the policy is what is under test. */
function harness(files: Record<string, string>, opts: { dirty?: string } = {}) {
  const written: Record<string, string> = {}
  const git: string[][] = []
  return {
    written,
    git,
    run: () =>
      promotePlannedQuickWins('/repo', {
        list: async () => Object.keys(files).filter(f => f.startsWith('tickets/')).map(f => f.slice('tickets/'.length)),
        read: async path => {
          const key = path.replace(/^\/repo\//, '')
          const found = files[key] ?? written[key]
          if (found === undefined) throw new Error(`no such file ${key}`)
          return found
        },
        write: async (path, content) => {
          written[path.replace(/^\/repo\//, '')] = content
        },
        git: async args => {
          git.push(args)
          return args[0] === 'status' ? (opts.dirty ?? '') : ''
        },
      }),
  }
}

const QUEUE = ['# TODO_AGENTS', '', '## Priority 8', '', '- [Existing](tickets/existing.md)', ''].join('\n')
const ticket = (title: string, priority = 8) => `Status: open\nPriority: ${priority}\n\n# ${title}\n`
const plan = (effort: string, consensus: string) => `Effort: ${effort}\nConsensus: ${consensus}\n\n# [Plan] X\n`

describe('promotePlannedQuickWins (#1334)', () => {
  it('queues a ticket its plan called a consensual quick-win', async () => {
    const h = harness({
      'TODO_AGENTS.md': QUEUE,
      'tickets/a.md': ticket('Do the thing'),
      'tickets/a.plan.md': plan('quick-win', 'consensual'),
    })
    const out = await h.run()
    assert.deepEqual(out.queued, ['[Do the thing](tickets/a.md)'])
    assert.ok(h.written['TODO_AGENTS.md']!.includes('- [Do the thing](tickets/a.md)'))
    // Committed, path-scoped, so nothing else in the checkout rides along.
    assert.deepEqual(h.git.at(-1), ['commit', '-m', plannedQueueMessage(1), '--', 'TODO_AGENTS.md'])
  })

  it('leaves a significant or unsettled plan alone', async () => {
    for (const verdict of [plan('significant', 'consensual'), plan('quick-win', 'open-questions'), '# [Plan] X\n']) {
      const h = harness({ 'TODO_AGENTS.md': QUEUE, 'tickets/a.md': ticket('Do the thing'), 'tickets/a.plan.md': verdict })
      const out = await h.run()
      assert.deepEqual(out.queued, [])
      assert.equal(h.written['TODO_AGENTS.md'], undefined)
    }
  })

  it('does not queue the same ticket twice', async () => {
    const h = harness({
      'TODO_AGENTS.md': ['## Priority 8', '', '- [Already there](tickets/a.md)', ''].join('\n'),
      'tickets/a.md': ticket('Already there'),
      'tickets/a.plan.md': plan('quick-win', 'consensual'),
    })
    assert.deepEqual((await h.run()).queued, [])
  })

  it('skips a closed ticket', async () => {
    const h = harness({
      'TODO_AGENTS.md': QUEUE,
      'tickets/a.md': 'Status: closed\nPriority: 8\n\n# Done already\n',
      'tickets/a.plan.md': plan('quick-win', 'consensual'),
    })
    assert.deepEqual((await h.run()).queued, [])
  })

  it('stands off a queue file a human is mid-edit on', async () => {
    const h = harness(
      {
        'TODO_AGENTS.md': QUEUE,
        'tickets/a.md': ticket('Do the thing'),
        'tickets/a.plan.md': plan('quick-win', 'consensual'),
      },
      { dirty: ' M TODO_AGENTS.md' },
    )
    const out = await h.run()
    assert.deepEqual(out.queued, [])
    assert.equal(out.blocked, true)
    assert.equal(h.written['TODO_AGENTS.md'], undefined)
  })

  it('places each ticket by its own priority, in one commit', async () => {
    const h = harness({
      'TODO_AGENTS.md': QUEUE,
      'tickets/a.md': ticket('Urgent one', 9),
      'tickets/a.plan.md': plan('quick-win', 'consensual'),
      'tickets/b.md': ticket('Later one', 2),
      'tickets/b.plan.md': plan('quick-win', 'consensual'),
    })
    const out = await h.run()
    assert.equal(out.queued.length, 2)
    const queue = h.written['TODO_AGENTS.md']!
    assert.ok(queue.indexOf('Urgent one') < queue.indexOf('Existing'))
    assert.ok(queue.indexOf('Existing') < queue.indexOf('Later one'))
    assert.equal(h.git.filter(args => args[0] === 'commit').length, 1)
  })

  it('reports nothing to do without calling it an obstacle', async () => {
    const h = harness({ 'TODO_AGENTS.md': QUEUE, 'tickets/a.md': ticket('No plan yet') })
    const out = await h.run()
    assert.deepEqual(out.queued, [])
    assert.equal(out.blocked, undefined)
  })
})

describe('queueEntryFor', () => {
  it('links the ticket and says nothing more: the plan is where the detail lives', () => {
    assert.equal(queueEntryFor('tickets/a.md', 'Do the thing'), '[Do the thing](tickets/a.md)')
  })
})
