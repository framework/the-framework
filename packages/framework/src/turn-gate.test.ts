import assert from 'node:assert/strict'
import { test } from 'node:test'
import { continuationPrompt, createTurnSignalEmitter, parseAwaitGate, parseErrors, parseMarkdownViews, parseReadyForMerge, parsePullRequest } from './turn-gate.js'
import type { FrameworkEvent } from './events.js'

const block = (json: string): string => 'Here are the options.\n```await-choices\n' + json + '\n```'

// D6: one gate, one block. A single choice, a multi-select, a plan approval and a browser hand-off
// were four tags with four parsers and four resolution branches; each is now a question with
// options, and what used to distinguish them is what the agent writes in them.

test('parseAwaitGate returns undefined when the agent did not stop to ask (#337)', () => {
  assert.equal(parseAwaitGate('Built the whole app. Done.'), undefined)
})

test('parseAwaitGate parses a well-formed block (#337)', () => {
  const gate = parseAwaitGate(
    block('{ "title": "Which database?", "options": [{ "id": "pg", "label": "Postgres", "detail": "relational" }, { "id": "sqlite", "label": "SQLite" }], "recommended": "pg" }'),
  )
  assert.equal(gate?.title, 'Which database?')
  assert.deepEqual(gate?.options, [
    { id: 'pg', label: 'Postgres', detail: 'relational' },
    { id: 'sqlite', label: 'SQLite' },
  ])
  assert.equal(gate?.recommended, 'pg')
})

test('parseAwaitGate synthesizes ids and defaults a blank title (#337)', () => {
  const gate = parseAwaitGate(block('{ "options": [{ "label": "A" }, { "label": "B" }] }'))
  assert.equal(gate?.title, 'Which option?')
  assert.deepEqual(gate?.options.map(o => o.id), ['opt:0', 'opt:1'])
})

test('parseAwaitGate maps a recommended label to its option id (#337)', () => {
  const gate = parseAwaitGate(block('{ "title": "Pick", "options": [{ "label": "First" }, { "label": "Second" }], "recommended": "Second" }'))
  assert.equal(gate?.recommended, 'opt:1')
})

test('parseAwaitGate takes the last block when a turn has more than one (#337)', () => {
  const gate = parseAwaitGate(block('{ "options": [{ "label": "old" }] }') + '\n' + block('{ "options": [{ "label": "new" }] }'))
  assert.deepEqual(gate?.options.map(o => o.label), ['new'])
})

test('parseAwaitGate falls back to an earlier block when the later one is malformed (#337)', () => {
  const gate = parseAwaitGate(block('{ "options": [{ "label": "good" }] }') + '\n' + block('{ not json'))
  assert.deepEqual(gate?.options.map(o => o.label), ['good'])
})

test('parseAwaitGate ignores a malformed or optionless block rather than throwing (#337)', () => {
  // A block with nothing pickable in it is not a gate: the agent carries on rather than parking on
  // an empty question, and a bad parse must never crash a build.
  assert.equal(parseAwaitGate(block('{ not json')), undefined)
  assert.equal(parseAwaitGate(block('"just a string"')), undefined)
  assert.equal(parseAwaitGate(block('{ "options": [] }')), undefined)
  assert.equal(parseAwaitGate(block('{ "options": [{ "detail": "no label" }] }')), undefined)
  assert.equal(parseAwaitGate(block('{ "title": "x" }')), undefined) // no options array
})

test('a multi gate says so and keeps its default-checked entries (#339)', () => {
  const gate = parseAwaitGate(
    block('{ "title": "Which to deep-dive?", "multi": true, "options": [{ "label": "auth", "default": true }, { "label": "paging" }] }'),
  )
  assert.equal(gate?.multi, true)
  assert.deepEqual(gate?.options, [{ id: 'opt:0', label: 'auth', default: true }, { id: 'opt:1', label: 'paging' }])
})

test('a single-pick gate carries no multi flag at all, rather than false (#339)', () => {
  const gate = parseAwaitGate(block('{ "options": [{ "label": "one" }] }'))
  assert.equal('multi' in gate!, false)
})

test('an approval is an ordinary gate: two options and the file under review (#358)', () => {
  // What used to be `await-confirmation` with its own parser, resolution branch and green/red card.
  const gate = parseAwaitGate(
    block('{ "title": "Approve the plan?", "file": "PLAN_orders.agent.md", "options": [{ "label": "Approve" }, { "label": "Decline" }], "recommended": "Approve" }'),
  )
  assert.equal(gate?.file, 'PLAN_orders.agent.md')
  assert.deepEqual(gate?.options.map(o => o.label), ['Approve', 'Decline'])
  assert.equal(gate?.recommended, 'opt:0')
})

test('a gate with no file omits it rather than carrying an empty string (#358)', () => {
  const gate = parseAwaitGate(block('{ "options": [{ "label": "x" }] }'))
  assert.equal('file' in gate!, false)
})

test('an option can say that picking it ends the session (#358)', () => {
  // Which answers mean "stop, I will take it from here" is a property of the question, so the
  // agent marks them. It used to be inferred from the gate's kind, which is what made a plan
  // approval a special case instead of one question among many.
  const gate = parseAwaitGate(
    block('{ "title": "Approve?", "options": [{ "label": "Approve" }, { "label": "Decline", "stop": true }] }'),
  )
  assert.deepEqual(gate?.options, [{ id: 'opt:0', label: 'Approve' }, { id: 'opt:1', label: 'Decline', stop: true }])
})

test('parseMarkdownViews returns [] when the turn has no show-markdown block (#441)', () => {
  assert.deepEqual(parseMarkdownViews('Built the app, nothing to show.'), [])
})

test('parseMarkdownViews parses a titled block, stripping the heading (#441)', () => {
  const views = parseMarkdownViews('Here is the plan.\n```show-markdown\n# Deployment plan\n## Steps\n- do X\n```')
  assert.deepEqual(views, [{ id: 'deployment-plan', title: 'Deployment plan', markdown: '## Steps\n- do X' }])
})

test('parseMarkdownViews falls back to Note when the block has no heading (#441)', () => {
  const views = parseMarkdownViews('```show-markdown\njust some body text\n```')
  assert.deepEqual(views, [{ id: 'note', title: 'Note', markdown: 'just some body text' }])
})

test('parseMarkdownViews collects several blocks and keeps the later of a repeated title (#441)', () => {
  const views = parseMarkdownViews(
    '```show-markdown\n# Plan\nfirst\n```\ntext\n```show-markdown\n# Summary\ndone\n```\n```show-markdown\n# Plan\nupdated\n```',
  )
  assert.deepEqual(views, [
    { id: 'plan', title: 'Plan', markdown: 'updated' },
    { id: 'summary', title: 'Summary', markdown: 'done' },
  ])
})

test('parseMarkdownViews skips a blank block (#441)', () => {
  assert.deepEqual(parseMarkdownViews('```show-markdown\n# Empty\n```'), [])
})

test('a heading with no usable characters still ids as `view` (#939)', () => {
  assert.deepEqual(parseMarkdownViews('```show-markdown\n# !!!\nbody\n```'), [
    { id: 'view', title: '!!!', markdown: 'body' },
  ])
})

test('parseReadyForMerge is true only when a ready-for-merge block is present (#326)', () => {
  assert.equal(parseReadyForMerge('Still building the feature.'), false)
  assert.equal(parseReadyForMerge('All done.\n```ready-for-merge\n```'), true)
  assert.equal(parseReadyForMerge('```ready-for-merge```'), true) // empty, no inner newline
})




// #1567/#1618: the `open-pr` block is how an agent opens a pull request through the framework
// rather than by running `gh pr create` itself — the agent names and describes the work, the
// framework keeps the ticket's issue reference and the recorded number. Read like a commit
// message: first line the title, the rest the body.
test('parsePullRequest reads the block as a commit message: first line title, rest body (#1618)', () => {
  const text = 'Done.\n```open-pr\nKeep the queued state across a reload\n\nThe reader re-read the file on mount.\n```\n'
  assert.deepEqual(parsePullRequest(text), {
    title: 'Keep the queued state across a reload',
    description: 'The reader re-read the file on mount.',
  })
})

test('parsePullRequest returns undefined when the agent wrote no block (#1567)', () => {
  assert.equal(parsePullRequest('just some output'), undefined)
})

test('parsePullRequest keeps the body markdown whole below the title (#1567)', () => {
  const body = '## What changed\n\n- one thing\n- another\n\nSee `src/thing.ts`.'
  assert.deepEqual(parsePullRequest('```open-pr\nRewrite the queue reader\n\n' + body + '\n```'), {
    title: 'Rewrite the queue reader',
    description: body,
  })
})

test('parsePullRequest takes a one-line block as a title with nothing below it (#1618)', () => {
  // A name for the work and no more: the PR body then says what was asked for, as it does for
  // any session that wrote no description.
  assert.deepEqual(parsePullRequest('```open-pr\nRewrite the queue reader\n```'), { title: 'Rewrite the queue reader' })
})

test('parsePullRequest refuses a first line too long to be a name for the work (#1618)', () => {
  // A paragraph, not a title. Taken as body alone rather than cut to fit: a truncated sentence
  // as a PR title becomes a truncated sentence in `main`'s history once the PR is squashed.
  const paragraph = 'This change rewrites the queue reader so that a reload keeps the queued state, which it did not before because the reader re-read the file on mount.'
  assert.deepEqual(parsePullRequest('```open-pr\n' + paragraph + '\n```'), { description: paragraph })
})

test('parsePullRequest takes the last block, so the agent can revise it (#1567)', () => {
  const text = '```open-pr\nfirst\n```\nlater…\n```open-pr\nsecond\n```'
  assert.deepEqual(parsePullRequest(text), { title: 'second' })
})

test('parsePullRequest ignores an empty block rather than blanking the body (#1567)', () => {
  assert.equal(parsePullRequest('```open-pr\n\n```'), undefined)
  assert.deepEqual(parsePullRequest('```open-pr\nreal\n```\n```open-pr\n \n```'), { title: 'real' })
})

test('parseErrors returns nothing when the turn reported none (#1500)', () => {
  assert.deepEqual(parseErrors('All good, the import finished.'), [])
})

test('parseErrors splits the block into a headline and the detail below it (#1500)', () => {
  assert.deepEqual(parseErrors('```error\ngh is not logged in\n\nran `gh auth status`: You are not logged into any hosts\n```'), [
    { headline: 'gh is not logged in', detail: 'ran `gh auth status`: You are not logged into any hosts' },
  ])
})

test('parseErrors takes a one-line block as a headline with no detail (#1500)', () => {
  assert.deepEqual(parseErrors('```error\ntickets/meta.json has no lastImportedAt\n```'), [
    { headline: 'tickets/meta.json has no lastImportedAt' },
  ])
})

test('parseErrors keeps every block, in order: two things going wrong is two errors (#1500)', () => {
  const text = '```error\nfirst\n```\nand then\n```error\nsecond\n```'
  assert.deepEqual(parseErrors(text), [{ headline: 'first' }, { headline: 'second' }])
})

test('parseErrors ignores an empty block — an error with nothing to say is not one (#1500)', () => {
  assert.deepEqual(parseErrors('```error\n \n```'), [])
  assert.deepEqual(parseErrors('```error\n \n```\n```error\nreal\n```'), [{ headline: 'real' }])
})

test('the turn emitter logs an error once however often the agent restates it (#1500)', () => {
  const events: FrameworkEvent[] = []
  const emit = createTurnSignalEmitter(e => events.push(e))
  emit('```error\npush rejected\n```')
  emit('still stuck.\n```error\npush rejected\n```')
  assert.deepEqual(events, [{ kind: 'error', headline: 'push rejected' }])
})

test('the turn emitter treats a second, different failure as its own error (#1500)', () => {
  const events: FrameworkEvent[] = []
  const emit = createTurnSignalEmitter(e => events.push(e))
  emit('```error\npush rejected\n\nfirst attempt\n```')
  emit('```error\npush rejected\n\nsecond attempt, different remote\n```')
  assert.equal(events.length, 2)
})
