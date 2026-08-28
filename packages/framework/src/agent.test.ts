import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runAgent } from './agent.js'
import { requestChoices, requestMultiSelect, resolveAwaitGate, runAwaitRounds, type ChoicesOption, type MultiSelectOption } from './await-gate.js'
import { FAKE_INTENT, fakeDriver } from './fake-script.js'
import { AgentMessageQueue } from './agent-messages.js'
import { FakeDriver, type Driver, type DriverSession } from 'agent-driver'
import type { AgentLocation } from './agent-location.js'
import { composeAgentSystem } from './system-prompt.js'
import type { ChoiceRequest, FrameworkEvent } from './events.js'
import { MAX_AWAIT_ROUNDS, continuationPrompt, stopMessage } from './turn-gate.js'

/** A driver that records the `system` framing it is started with, delegating the agent to the fake. */
function recordingDriver(): { driver: Driver; system: () => string } {
  const fd = fakeDriver()
  let captured = ''
  // Name it 'fake' so the workspace-verify stays off (no fs access in this unit test).
  const driver: Driver = {
    id: 'fake',
    start: opts => {
      captured = opts.system ?? ''
      return fd.start(opts)
    },
  }
  return { driver, system: () => captured }
}

test('a session drives the whole flow through the driver, offline', async () => {
  const events: FrameworkEvent[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver: fakeDriver(),
    cwd: '/tmp/ws',
    onEvent: e => events.push(e),
  })

  // No preset and no serve config, so nothing reviewed the build (#1372):
  // the loop never ran and the build turn was the whole agent.


  // We surfaced the wrapped agent's own progress.
  assert.ok(events.some(e => e.kind === 'driver'))
  assert.ok(events.some(e => e.kind === 'session' && e.fake === true))
  assert.equal(events.at(-1)!.kind, 'end')
})

test('runAgent surfaces the wrapped agent real session id via session-update', async () => {
  const events: FrameworkEvent[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver: fakeDriver(), // reports sessionId "fake-orders-app"
    cwd: '/tmp/ws',
    onEvent: e => events.push(e),
  })

  const updates = events.filter(e => e.kind === 'session-update')
  // The fake reports one stable id across all prompts, so it fires exactly once.
  assert.equal(updates.length, 1)
  assert.equal(updates[0]!.kind === 'session-update' && updates[0]!.sessionId, 'fake-orders-app')
  // No link template was given, so the update carries no link.
  assert.equal(updates[0]!.kind === 'session-update' && updates[0]!.sessionLink, undefined)
  // It arrives after the initial session event (id is not known at start).
  const sessionIdx = events.findIndex(e => e.kind === 'session')
  const updateIdx = events.findIndex(e => e.kind === 'session-update')
  assert.ok(sessionIdx >= 0 && updateIdx > sessionIdx)
})

test('runAgent resolves a {sessionId} link template once the id is known', async () => {
  const events: FrameworkEvent[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver: fakeDriver(),
    cwd: '/tmp/ws',
    sessionLink: 'https://code.example.com/s/{sessionId}',
    onEvent: e => events.push(e),
  })

  // The template cannot resolve at start, so the initial session event omits it.
  const session = events.find(e => e.kind === 'session')
  assert.ok(session && session.kind === 'session')
  assert.equal(session.sessionLink, undefined)

  // Once the id is known, the resolved URL is surfaced.
  const update = events.find(e => e.kind === 'session-update')
  assert.ok(update && update.kind === 'session-update')
  assert.equal(update.sessionLink, 'https://code.example.com/s/fake-orders-app')
})

test('runAgent accumulates per-turn usage and emits a running total (#322)', async () => {
  const events: FrameworkEvent[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver: fakeDriver(), // every scripted turn reports $0.02 usage
    cwd: '/tmp/ws',
    onEvent: e => events.push(e),
  })

  const usage = events.filter(e => e.kind === 'usage')
  assert.ok(usage.length >= 1)
  const last = usage.at(-1)!
  assert.equal(last.kind, 'usage')
  if (last.kind !== 'usage') return
  // One usage event per turn that reported usage; totals grow monotonically.
  assert.equal(last.turns, usage.length)
  // The fake driver prices its turns, so the total carries a cost.
  assert.ok(Math.abs(last.costUsd! - last.turns * 0.02) < 1e-9)
  assert.ok(last.cacheReadTokens > 0)
  const end = events.at(-1)!
  assert.equal(end.kind === 'end' && end.ok, true)
})

test('runAgent shows a literal session link immediately (no template)', async () => {
  const events: FrameworkEvent[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver: fakeDriver(),
    cwd: '/tmp/ws',
    sessionLink: 'https://code.example.com/live',
    onEvent: e => events.push(e),
  })

  // A literal URL (no placeholder) is shown right away on the session event.
  const session = events.find(e => e.kind === 'session')
  assert.ok(session && session.kind === 'session')
  assert.equal(session.sessionLink, 'https://code.example.com/live')
})

test('the run system channel is exactly composeAgentSystem, with nothing appended (#547)', async () => {
  const { driver, system } = recordingDriver()
  await runAgent({ prompt: FAKE_INTENT, driver, cwd: '/tmp/ws', onEvent: () => {} })
  // runAgent composes no framing of its own.
  assert.equal(system(), composeAgentSystem({ tf: { prompt: FAKE_INTENT } }))
})

test('transparent empties the build-path system channel (#625)', async () => {
  const { driver, system } = recordingDriver()
  await runAgent({ prompt: FAKE_INTENT, driver, cwd: '/tmp/ws', transparent: true, onEvent: () => {} })
  assert.equal(system(), '') // raw claude: no #326 block, no emit protocols
})

test('the project never frames the agent (#547)', async () => {
  const { driver, system } = recordingDriver()
  await runAgent({ prompt: FAKE_INTENT, driver, cwd: '/tmp/ws', onEvent: () => {} })
  // Nothing about the project reaches the prompt — no skill, persona or memory framing.
  assert.doesNotMatch(system(), /vike-auth|llms\.txt|Skill:|Persona:|Project memory/)
})


/** A fake driver that records every prompt text it is sent, so a test can see which loop fired. */
function promptRecordingDriver(): { driver: Driver; prompts: () => string[] } {
  const sent: string[] = []
  const inner = new FakeDriver({
    turns: [
      { text: 'Built the app.' }, // build
      { text: 'Reviewed.\n```json\n{"blockers":[]}\n```' }, // review, clean
    ],
    sessionId: 'test',
  })
  const driver: Driver = {
    id: 'fake',
    start: async opts => {
      const session = await inner.start(opts)
      const wrapped: DriverSession = {
        id: session.id,
        cwd: session.cwd,
        prompt: (text, o) => {
          sent.push(text)
          return session.prompt(text, o)
        },
        dispose: () => session.dispose(),
      }
      return wrapped
    },
  }
  return { driver, prompts: () => sent }
}

const MS_OPTS: MultiSelectOption[] = [
  { id: 'p0', label: 'auth flow', default: true },
  { id: 'p1', label: 'routing' },
  { id: 'p2', label: 'data layer', detail: 'rated 2/10', default: true },
]

test('requestMultiSelect headless: auto-accepts the default-checked set (#332)', async () => {
  const events: FrameworkEvent[] = []
  const selected = await requestMultiSelect({
    id: 'ms',
    title: 'Pick problems',
    options: MS_OPTS,
    emit: e => events.push(e),
  })
  assert.deepEqual(selected, ['p0', 'p2']) // the two defaults
  const choice = events.find(e => e.kind === 'choice')
  assert.ok(choice && choice.kind === 'choice' && choice.multi === true && choice.recommended === undefined)
  const resolved = events.find(e => e.kind === 'choice-resolved')
  assert.ok(resolved && resolved.kind === 'choice-resolved')
  assert.deepEqual((resolved as { picked: unknown }).picked, ['p0', 'p2'])
  assert.equal((resolved as { by: string }).by, 'auto')
})

test('requestMultiSelect returns the user-picked subset, filtered to valid ids (#332)', async () => {
  const events: FrameworkEvent[] = []
  const selected = await requestMultiSelect({
    id: 'ms',
    title: 'Pick problems',
    options: MS_OPTS,
    emit: e => events.push(e),
    // The user unchecks a default (p0), keeps p1, and a stray id is dropped.
    requestChoice: async () => ({ picked: ['p1', 'p2', 'bogus'], by: 'user' }),
  })
  assert.deepEqual(selected, ['p1', 'p2'])
})

test('requestMultiSelect resolves to the defaults if the run aborts while parked (#332)', async () => {
  const events: FrameworkEvent[] = []
  const ac = new AbortController()
  const selected = await requestMultiSelect({
    id: 'ms',
    title: 'Pick problems',
    options: MS_OPTS,
    emit: e => events.push(e),
    signal: ac.signal,
    // Never resolves on its own; the abort must unblock it.
    requestChoice: () => {
      ac.abort()
      return new Promise(() => {})
    },
  })
  assert.deepEqual(selected, ['p0', 'p2']) // fell back to the defaults, not a hang
})

test('requestMultiSelect can resolve to an empty set when the user checks nothing (#332)', async () => {
  const selected = await requestMultiSelect({
    id: 'ms',
    title: 'Pick problems',
    options: MS_OPTS,
    emit: () => {},
    requestChoice: async () => ({ picked: [], by: 'user' }),
  })
  assert.deepEqual(selected, [])
})

test('on a multi-select, one stopping pick among several is still a stop (#358)', async () => {
  // An answer that says "stop" is not softened by the answers checked next to it.
  const gate = {
    title: 'What now?',
    multi: true,
    options: [
      { id: 'keep', label: 'Keep going' },
      { id: 'halt', label: 'Hand it back', stop: true },
    ],
  }
  const both = await resolveAwaitGate(gate, 0, { emit: () => {}, requestChoice: async () => ({ picked: ['keep', 'halt'] }) })
  assert.deepEqual(both, { answer: 'Keep going, Hand it back', stop: true })

  const neither = await resolveAwaitGate(gate, 0, { emit: () => {}, requestChoice: async () => ({ picked: ['keep'] }) })
  assert.deepEqual(neither, { answer: 'Keep going', stop: false })
})

test('a build turn that stops to ask fires a live gate and resumes on the pick (#337)', async () => {
  const awaitBlock =
    'I need a decision first.\n```await-choices\n' +
    '{ "title": "Which data store?", "options": [{ "id": "sqlite", "label": "SQLite" }, { "id": "pg", "label": "Postgres" }], "recommended": "sqlite" }\n' +
    '```'
  const driver = new FakeDriver({
    respond: (prompt: string): string => {
      if (prompt === FAKE_INTENT) return awaitBlock // the build stops to ask
      if (/You paused to ask/.test(prompt)) return 'Built it with Postgres. Done.' // the resume
      return 'done'
    },
    sessionId: 'gate337',
  })

  const events: FrameworkEvent[] = []
  const prompts: string[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver,
    cwd: '/tmp/ws',
    onEvent: e => {
      events.push(e)
      if (e.kind === 'driver' && e.event.type === 'start') prompts.push(e.event.prompt)
    },
    requestChoice: async () => ({ picked: 'pg', by: 'user' }),
  })

  // The agent-authored choice surfaced as a live gate with the offered options.
  const choice = events.find(e => e.kind === 'choice' && e.id === 'await-choices')
  assert.ok(choice && choice.kind === 'choice')
  assert.equal(choice.title, 'Which data store?')
  assert.ok(choice.options.some(o => o.id === 'pg' && o.label === 'Postgres'))
  // The pick was narrated and the driver was re-prompted to continue from it.
  assert.ok(events.some(e => e.kind === 'log' && /Continuing with your choice: Postgres/.test(e.message)))
  assert.ok(prompts.some(p => /You paused to ask.*Which data store.*chose: Postgres/s.test(p)))
})

test('a run with no preset and no serve config reviews nothing (#1372)', async () => {
  const prompts: string[] = []
  const driver = new FakeDriver({
    respond: (prompt: string): string => {
      prompts.push(prompt)
      if (prompt === FAKE_INTENT) return 'Built it. Done.'
      return 'done'
    },
    sessionId: 'blackbox1372',
  })
  await runAgent({
    prompt: FAKE_INTENT,
    driver,
    cwd: '/tmp/ws',
    onEvent: () => {},
  })
  // The agent is a black box (#1372): with no opted-in review (preset) and no mechanical
  // gate (serve), the build prompt is the only prompt the agent ever sees.
  assert.equal(prompts.length, 1)
})

test('a build turn that stops to showMultiSelect fires a checklist gate and resumes (#339)', async () => {
  const awaitBlock =
    'Rated the problems.\n```await-choices\n' +
    '{ "title": "Which problems to deep-dive?", "multi": true, "options": [{ "id": "auth", "label": "auth", "default": true }, { "id": "routing", "label": "routing" }] }\n' +
    '```'
  const driver = new FakeDriver({
    respond: (prompt: string): string => {
      if (prompt === FAKE_INTENT) return awaitBlock
      if (/You paused to ask/.test(prompt)) return 'Added the picks to TODO. Done.'
      return 'done'
    },
    sessionId: 'multi339',
  })

  const events: FrameworkEvent[] = []
  const prompts: string[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver,
    cwd: '/tmp/ws',
    onEvent: e => {
      events.push(e)
      if (e.kind === 'driver' && e.event.type === 'start') prompts.push(e.event.prompt)
    },
    // The user unchecks the default `auth` and keeps `routing`.
    requestChoice: async req => (req.multi ? { picked: ['routing'], by: 'user' } : { picked: 'proceed', by: 'user' }),
  })

  const gate = events.find(e => e.kind === 'choice' && e.id === 'await-choices')
  assert.ok(gate && gate.kind === 'choice' && gate.multi === true)
  assert.ok(gate.options.some(o => o.id === 'auth' && o.default === true))
  // Resumed with the user's selection (routing only), not the defaults.
  assert.ok(events.some(e => e.kind === 'log' && /Continuing with your choice: routing/.test(e.message)))
  assert.ok(prompts.some(p => /You paused to ask.*chose: routing/s.test(p)))
})

test('a build turn that stops for plan approval resumes on Approve (#358)', async () => {
  const awaitBlock =
    'The scope is large, so I wrote a plan.\n```await-choices\n' +
    '{ "title": "Approve the orders plan?", "file": "PLAN_orders.agent.md", "options": [{ "id": "approve", "label": "Approve" }, { "id": "decline", "label": "Decline" }], "recommended": "approve" }\n' +
    '```'
  const driver = new FakeDriver({
    respond: (prompt: string): string => {
      if (prompt === FAKE_INTENT) return awaitBlock
      if (/You paused to ask/.test(prompt)) return 'Built the plan out. Done.'
      return 'done'
    },
    sessionId: 'confirm358',
  })

  const events: FrameworkEvent[] = []
  const prompts: string[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver,
    cwd: '/tmp/ws',
    onEvent: e => {
      events.push(e)
      if (e.kind === 'driver' && e.event.type === 'start') prompts.push(e.event.prompt)
    },
    requestChoice: async () => ({ picked: 'approve', by: 'user' }),
  })

  // The approval surfaced as an ordinary gate carrying the plan file — one card, two options.
  const gate = events.find(e => e.kind === 'choice' && e.id === 'await-choices')
  assert.ok(gate && gate.kind === 'choice')
  assert.equal(gate.file, 'PLAN_orders.agent.md')
  assert.equal(gate.recommended, 'approve')
  assert.deepEqual(gate.options.map(o => o.id), ['approve', 'decline'])
  // Approved: the driver was re-prompted to continue and the agent finished.
  assert.ok(events.some(e => e.kind === 'log' && /Continuing with your choice: Approve/.test(e.message)))
  assert.ok(prompts.some(p => /You paused to ask.*Approve the orders plan.*chose: Approve/s.test(p)))
})

test('a declined plan stops the session cleanly instead of building on it (#358)', async () => {
  // The one self-stop left. It used to be reached through the gate's *kind* — a decline of an
  // `await-confirmation` — and is now reached through the option the agent marked `stop`, which
  // is the same stop without the plan-approval special case (D6).
  const awaitBlock =
    'Plan written.\n```await-choices\n' +
    '{ "title": "Approve?", "file": "PLAN_x.agent.md", "options": [{ "id": "approve", "label": "Approve" }, { "id": "decline", "label": "Decline", "stop": true }] }\n```'
  let resumed = false
  const driver = new FakeDriver({
    respond: (prompt: string): string => {
      if (prompt === FAKE_INTENT) return awaitBlock
      if (/You paused to ask/.test(prompt)) resumed = true
      return 'done'
    },
    sessionId: 'decline358',
  })

  const events: FrameworkEvent[] = []
  await assert.rejects(
    runAgent({
      prompt: FAKE_INTENT,
      driver,
      cwd: '/tmp/ws',
      onEvent: e => events.push(e),
      requestChoice: async () => ({ picked: 'decline', by: 'user' }),
    }),
  )
  assert.equal(resumed, false, 'the agent is never told the answer that ended it')
  assert.ok(events.some(e => e.kind === 'log' && /Stopped at your answer: Decline/.test(e.message)))
  // A stop the user asked for is a stop, not a failure.
  const end = events.find(e => e.kind === 'end')
  assert.ok(end && end.kind === 'end')
  assert.equal(end.ok, false)
  assert.equal(end.stopped, true)
  assert.equal(end.detail, 'stopped by your answer')
})

test('an unmarked option is an ordinary answer, whatever it is labelled (#358)', async () => {
  // The marker is the mechanism, not the wording: "Decline" without `stop` continues the session,
  // which is what keeps this a property of the question rather than a list of magic labels.
  const awaitBlock =
    'Plan written.\n```await-choices\n' +
    '{ "title": "Approve?", "options": [{ "id": "approve", "label": "Approve" }, { "id": "decline", "label": "Decline" }] }\n```'
  let resumedWith = ''
  const driver = new FakeDriver({
    respond: (prompt: string): string => {
      if (prompt === FAKE_INTENT) return awaitBlock
      if (/You paused to ask/.test(prompt)) resumedWith = prompt
      return 'Understood — waiting for your instructions.'
    },
    sessionId: 'decline-unmarked',
  })

  const events: FrameworkEvent[] = []
  await runAgent({
    prompt: FAKE_INTENT,
    driver,
    cwd: '/tmp/ws',
    onEvent: e => events.push(e),
    requestChoice: async () => ({ picked: 'decline', by: 'user' }),
  })

  assert.match(resumedWith, /chose: Decline/, 'the agent was told what the user picked')
  const end = events.find(e => e.kind === 'end')
  assert.ok(end && end.kind === 'end')
  assert.equal(end.ok, true)
  assert.notEqual(end.stopped, true)
})

test('a stop-marked answer in the live-chat phase stops the session, so it does not publish (#358)', async () => {
  // The opening rounds' stop is honored (#217); the chat leg after a build's backlog is the other
  // path an answer can arrive on, and it used to drop the flag — the session settled `ok:true` and
  // published the very work the answer declined. The stop must end it there too.
  const approvalBlock =
    'Plan written.\n```await-choices\n' +
    '{ "title": "Approve?", "options": [{ "id": "approve", "label": "Approve" }, { "id": "decline", "label": "Decline", "stop": true }] }\n```'
  const driver = new FakeDriver({
    respond: (prompt: string): string => {
      // The opening build turn settles; the chat message then draws the stop-marked gate.
      if (/dark mode/.test(prompt)) return approvalBlock
      return 'built it'
    },
    sessionId: 'chat-stop',
  })
  const messages = new AgentMessageQueue()
  const events: FrameworkEvent[] = []
  const run = assert.rejects(
    runAgent({
      prompt: FAKE_INTENT,
      driver,
      cwd: '/tmp/ws',
      messages,
      onEvent: e => events.push(e),
      requestChoice: async () => ({ picked: 'decline', by: 'user' }),
    }),
  )
  messages.push('now add dark mode')
  await new Promise(resolve => setImmediate(resolve))
  messages.close()
  await run

  const end = events.find(e => e.kind === 'end')
  assert.ok(end && end.kind === 'end')
  assert.equal(end.ok, false)
  assert.equal(end.stopped, true) // a stop, not a published success
  assert.equal(end.detail, 'stopped by your answer')
})

test('with nobody to ask, a session takes the recommended option and carries on (#337/#846)', async () => {
  // One path means one answer to "what does a headless session do at a gate" (D2). The build path
  // used to leave the turn standing, so an unattended build stopped at its first question; the
  // prompt path auto-accepted, which is what #846 describes as "the fallback a fully headless agent
  // already uses and the one autopilot would have clicked". That is the one that survives.
  let resumed = false
  const driver = new FakeDriver({
    respond: (prompt: string): string => {
      if (prompt === FAKE_INTENT) return 'built it\n```await-choices\n{ "options": [{ "label": "A" }] }\n```'
      if (/You paused to ask/.test(prompt)) resumed = true
      return 'done'
    },
    sessionId: 'headless337',
  })
  const events: FrameworkEvent[] = []
  await runAgent({ prompt: FAKE_INTENT, driver, cwd: '/tmp/ws', onEvent: e => events.push(e) })
  assert.equal(resumed, true, 'the session continued from the recommended pick')
  const resolved = events.find(e => e.kind === 'choice-resolved')
  assert.ok(resolved && resolved.kind === 'choice-resolved')
  assert.equal(resolved.by, 'auto')
})

const CH_OPTS: ChoicesOption[] = [
  { id: 'a', label: 'Interpretation A' },
  { id: 'b', label: 'Interpretation B', detail: 'less likely' },
]

test('requestChoices headless: auto-accepts the recommended option (#335)', async () => {
  const events: FrameworkEvent[] = []
  const picked = await requestChoices({
    id: 'ch',
    title: 'Which interpretation?',
    options: CH_OPTS,
    recommended: 'b',
    emit: e => events.push(e),
  })
  assert.equal(picked, 'b')
  const choice = events.find(e => e.kind === 'choice')
  assert.ok(choice && choice.kind === 'choice' && choice.multi === undefined && choice.recommended === 'b')
  const resolved = events.find(e => e.kind === 'choice-resolved')
  assert.ok(resolved && resolved.kind === 'choice-resolved')
  assert.equal((resolved as { picked: unknown }).picked, 'b')
  assert.equal((resolved as { by: string }).by, 'auto')
})

test('requestChoices defaults the recommended option to the first when none is given (#335)', async () => {
  const events: FrameworkEvent[] = []
  const picked = await requestChoices({ id: 'ch', title: 'Pick one', options: CH_OPTS, emit: e => events.push(e) })
  assert.equal(picked, 'a')
  const choice = events.find(e => e.kind === 'choice')
  assert.ok(choice && choice.kind === 'choice' && choice.recommended === 'a')
})

test('requestChoices returns the user pick, falling back to recommended for an invalid id (#335)', async () => {
  const good = await requestChoices({
    id: 'ch',
    title: 'Pick one',
    options: CH_OPTS,
    recommended: 'a',
    emit: () => {},
    requestChoice: async () => ({ picked: 'b', by: 'user' }),
  })
  assert.equal(good, 'b')
  const bogus = await requestChoices({
    id: 'ch',
    title: 'Pick one',
    options: CH_OPTS,
    recommended: 'a',
    emit: () => {},
    requestChoice: async () => ({ picked: 'nope', by: 'user' }),
  })
  assert.equal(bogus, 'a') // an unknown id falls back to the recommended option
})

test('requestChoices resolves to the recommended option if the run aborts while parked (#335)', async () => {
  const ac = new AbortController()
  const picked = await requestChoices({
    id: 'ch',
    title: 'Pick one',
    options: CH_OPTS,
    recommended: 'b',
    emit: () => {},
    signal: ac.signal,
    // Never resolves on its own; the abort must unblock it.
    requestChoice: () => {
      ac.abort()
      return new Promise(() => {})
    },
  })
  assert.equal(picked, 'b') // fell back to the recommended option, not a hang
})

test('a fake run skips the backlog loop by default; the demo stays deterministic (#323)', async () => {
  const events: FrameworkEvent[] = []
  const result = await runAgent({
    prompt: FAKE_INTENT,
    driver: fakeDriver(),
    cwd: '/tmp/ws',
    onEvent: e => events.push(e),
  })
  assert.equal(result.todo, undefined)
  assert.equal(events.some(e => e.kind === 'log' && /Backlog/.test(e.message)), false)
})

test('runAgent runs the backlog loop after the build when opted in (#323)', async () => {
  const { mkdtemp, realpath, rm, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { nodeGitRunner } = await import('@gemstack/skill-branches')
  const { withDataBranch } = await import('./data-branch.js')
  // The queue lives on the data branch (#1582), so the fixture is a real repo.
  const git = nodeGitRunner()
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'framework-run-todo-')))
  await git(['init', '-b', 'main'], cwd)
  await git(['config', 'user.email', 't@t'], cwd)
  await git(['config', 'user.name', 't'], cwd)
  await writeFile(join(cwd, 'README.md'), '# t\n')
  await git(['add', '-A'], cwd)
  await git(['commit', '-m', 'init'], cwd)
  await withDataBranch(cwd, 'seed', async dir => {
    await writeFile(join(dir, 'TODO_AGENTS.md'), '- [ ] leftover task\n', 'utf8')
  })
  try {
    const events: FrameworkEvent[] = []
    // The fake script only answers; the loop's own check-off (#1582) drains the entry —
    // proving the wiring runs post-build with the agent's own session.
    const result = await runAgent({
      prompt: FAKE_INTENT,
      driver: fakeDriver(),
      cwd,
      todoLoop: true,
      onEvent: e => events.push(e),
    })
    assert.deepEqual(result.todo, { completed: 1, reason: 'empty', file: 'TODO_AGENTS.md' })
    assert.ok(events.some(e => e.kind === 'log' && /Backlog: TODO_AGENTS\.md has 1 open item\(s\)/.test(e.message)))
    // The loop runs before the agent's end event.
    const endIndex = events.findIndex(e => e.kind === 'end')
    const doneIndex = events.findIndex(e => e.kind === 'log' && /Backlog done/.test(e.message))
    assert.ok(doneIndex !== -1 && doneIndex < endIndex)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

// The await rounds shared by the direct prompt path and the backlog loop (#569). Both used
// to carry their own copy, which is how the turn-signal emission missed one of them (#563).

/** A gate the fake agent can emit, in the wire shape `parseAwaitGate` reads. */
const choicesGate = (title: string): string =>
  `${title}\n\`\`\`await-choices\n${JSON.stringify({ title, options: [{ id: 'a', label: 'Option A' }, { id: 'b', label: 'Option B' }] })}\n\`\`\``

/**
 * An approval, which since D6 is an ordinary gate with two options rather than its own kind — the
 * declining one marked `stop`, which is the shape the protocol teaches.
 */
const approvalGate = (title: string): string =>
  `${title}\n\`\`\`await-choices\n${JSON.stringify({ title, options: [{ id: 'approve', label: 'Approve' }, { id: 'decline', label: 'Decline', stop: true }], recommended: 'approve' })}\n\`\`\``

test('runAwaitRounds resolves a gate, re-prompts with the answer, and emits every turn signal', async () => {
  const events: FrameworkEvent[] = []
  const prompts: string[] = []
  const signalled: string[] = []
  const driver = new FakeDriver({
    respond: (prompt, i) => {
      prompts.push(prompt)
      return i === 0 ? choicesGate('Which way?') : 'All done.'
    },
  })
  const session = await driver.start({ cwd: '/tmp/ws' })
  const result = await runAwaitRounds({
    session,
    prompt: 'open',
    emitTurnSignals: text => void signalled.push(text),
    requestChoice: async () => ({ picked: 'b' }),
    emit: e => void events.push(e),
  })

  assert.deepEqual(result, { text: 'All done.', exhausted: false, stopped: false })
  // One shared continuation wording for every path (#570), built from the gate title + pick.
  assert.deepEqual(prompts, ['open', continuationPrompt('Which way?', 'Option B')])
  assert.ok(events.some(e => e.kind === 'log' && e.message === 'Continuing with your choice: Option B'))
  // Every turn goes through the signal emitter, the gate turn included (#563).
  assert.equal(signalled.length, 2)
  assert.match(signalled[0]!, /await-choices/)
  assert.equal(signalled[1], 'All done.')
})

test('runAwaitRounds stops instead of re-prompting when the answer is marked stop (#358)', async () => {
  const events: FrameworkEvent[] = []
  const prompts: string[] = []
  const driver = new FakeDriver({ respond: prompt => (prompts.push(prompt), approvalGate('Plan ok?')) })
  const session = await driver.start({ cwd: '/tmp/ws' })
  const result = await runAwaitRounds({
    session,
    prompt: 'open',
    emitTurnSignals: () => {},
    requestChoice: async () => ({ picked: 'decline' }),
    emit: e => void events.push(e),
  })

  assert.equal(result.stopped, true)
  // Not exhausted: the round cap had nothing to do with it, and reporting both would make a
  // deliberate stop read as a session that ran out of turns.
  assert.equal(result.exhausted, false)
  assert.deepEqual(prompts, ['open'], 'it stopped rather than continuing')
  assert.ok(events.some(e => e.kind === 'log' && e.message === stopMessage('Decline')))
})

test('runAwaitRounds continues on the approving half of the same gate (#358)', async () => {
  // The same block, the other answer: a `stop` option only stops when it is the one picked.
  const prompts: string[] = []
  let asked = 0
  const driver = new FakeDriver({
    respond: prompt => (prompts.push(prompt), asked++ === 0 ? approvalGate('Plan ok?') : 'Built it.'),
  })
  const session = await driver.start({ cwd: '/tmp/ws' })
  const result = await runAwaitRounds({
    session,
    prompt: 'open',
    emitTurnSignals: () => {},
    requestChoice: async () => ({ picked: 'approve' }),
    emit: () => {},
  })

  assert.equal(result.stopped, false)
  assert.equal(prompts.length, 2)
  assert.match(prompts[1]!, /chose: Approve/)
})

test('runAwaitRounds gives up after MAX_AWAIT_ROUNDS and reports it exhausted', async () => {
  const prompts: string[] = []
  // An agent that asks forever: the cap is what stops it.
  const driver = new FakeDriver({ respond: prompt => (prompts.push(prompt), choicesGate('Again?')) })
  const session = await driver.start({ cwd: '/tmp/ws' })
  const result = await runAwaitRounds({
    session,
    prompt: 'open',
    emitTurnSignals: () => {},
    requestChoice: async () => ({ picked: 'a' }),
    emit: () => {},
  })

  assert.equal(result.exhausted, true)
  assert.equal(prompts.length, MAX_AWAIT_ROUNDS + 1) // the opener, then one per round
})

test('a stay-open run says it is parked each time it waits for the user (#785/#1390)', async () => {
  // The stay-open park is now only for an agent whose own terminal dashboard is the single surface
  // (#1390) — everything else ends itself on an idle queue. In that mode, the build settles and
  // chat parks: that is the moment the agent stops working and the agent is waiting on you. Before
  // #785 nothing said so, and the dashboard kept animating "running".
  const prompts: string[] = []
  const driver = new FakeDriver({ respond: prompt => (prompts.push(prompt), 'built it') })
  const session = await driver.start({ cwd: '/tmp/ws' })
  const messages = new AgentMessageQueue()
  const events: FrameworkEvent[] = []

  const done = runAwaitRounds({
    session,
    prompt: 'build it',
    emitTurnSignals: () => {},
    emit: e => events.push(e),
    messages,
    stayOpenChat: true,
  })
  // One message, then close: parked -> working -> parked again -> end.
  messages.push('now add dark mode')
  await new Promise(resolve => setImmediate(resolve))
  messages.close()
  await done

  // Once after the build settles, once after the chat turn: every park is announced, so the
  // dashboard can stop animating the moment the agent stops. (The matching "working again"
  // edge is the driver's own `start` event, which applyEventToMeta clears the flag on.)
  assert.equal(events.filter(e => e.kind === 'settled').length, 2)
  assert.ok(prompts.includes('now add dark mode'), 'the chat turn ran between the two parks')
})

test('runAwaitRounds does not report exhausted when a chat phase follows the opening cap (#742)', async () => {
  // The opening prompt asks forever and hits the cap, but live chat is wired: the agent stays open
  // and ends because chat closes (Stop), not "at the await limit". So exhausted must be false —
  // before #742 the opening drain's `exhausted: true` leaked through into a spurious end log.
  const driver = new FakeDriver({ respond: () => choicesGate('Again?') })
  const session = await driver.start({ cwd: '/tmp/ws' })
  const messages = new AgentMessageQueue()
  messages.close() // no messages: the stay-open phase ends immediately.
  const result = await runAwaitRounds({
    session,
    prompt: 'open',
    emitTurnSignals: () => {},
    requestChoice: async () => ({ picked: 'a' }),
    emit: () => {},
    messages,
  })

  assert.equal(result.exhausted, false)
})

/**
 * A driver whose every reply is the same note about where the work went (#1225) — the shape
 * of a hand-off, whatever it hands off to. Named 'fake' so the workspace-verify stays off,
 * which keeps these unit tests off the filesystem.
 */
function handsOffDriver(): { driver: Driver; prompts: () => readonly string[] } {
  const prompts: string[] = []
  const inner = new FakeDriver({
    respond: (prompt: string) => {
      prompts.push(prompt)
      return 'Handed off. View the session: https://claude.ai/code/session_01ABC'
    },
    sessionId: 'session_01ABC',
  })
  return { driver: { id: 'fake', start: opts => inner.start(opts) }, prompts: () => prompts }
}

test('a hand-off run ends at the hand-off: no review passes, no backlog gate (#1225)', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-handsoff-'))
  await writeFile(join(cwd, 'TODO_AGENTS.md'), '- [ ] leftover task\n')
  try {
    const events: FrameworkEvent[] = []
    const asked: ChoiceRequest[] = []
    const { driver, prompts } = handsOffDriver()
    const { todo } = await runAgent({
      prompt: FAKE_INTENT,
      driver,
      location: 'web',
      cwd,
      // Explicit, so this proves the hand-off outranks an opt-in rather than merely
      // sharing a default with it.
      todoLoop: true,
      requestChoice: async req => {
        asked.push(req)
        return { picked: req.options[0]!.id, by: 'user' }
      },
      onEvent: e => events.push(e),
    })

    // The build prompt was the whole agent: no phase followed it, so nothing read the
    // hand-off note as a reply.
    assert.equal(prompts().length, 1)
    // The backlog is still there and still unasked about: this machine has no standing to
    // ask which item to start next when the work is somewhere it cannot see.
    assert.equal(todo, undefined)
    assert.deepEqual(asked, [])
    assert.ok(!events.some(e => e.kind === 'choice'))
    assert.match(await readFile(join(cwd, 'TODO_AGENTS.md'), 'utf8'), /leftover task/)
    // And it says why it stopped, before the end.
    const handed = events.findIndex(e => e.kind === 'log' && /^Handed off:/.test(e.message))
    assert.ok(handed !== -1 && handed < events.findIndex(e => e.kind === 'end'))
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a hand-off run is told to land everything, a local one is not (#1225)', async () => {
  // Nothing here sees a cloud session's workspace, so it has to commit and open its own PR. Its
  // gates are left exactly as a local agent has them (#1554): no decide-alone mode.
  const systemOf = async (driver: Driver, location: AgentLocation): Promise<string> => {
    const events: FrameworkEvent[] = []
    await runAgent({ prompt: FAKE_INTENT, driver, location, cwd: '/tmp/ws', onEvent: e => events.push(e) })
    const prompt = events.find(e => e.kind === 'system-prompt')
    return prompt?.kind === 'system-prompt' ? prompt.text : ''
  }
  const web = await systemOf(handsOffDriver().driver, 'web')
  assert.ok(web.includes('This session runs detached — land everything'))
  assert.ok(!web.includes('decide alone'))
  assert.ok(!(await systemOf(new FakeDriver(), 'local')).includes('This session runs detached'))
})

test('a hand-off run does not stay open for messages (#1225)', async () => {
  const { driver } = handsOffDriver()
  // Left open on purpose: an agent that still waited on it would never resolve, since the
  // composer it waits for cannot reach the session it handed to.
  const messages = new AgentMessageQueue()
  const agent = runAgent({
    prompt: FAKE_INTENT,
    driver,
    location: 'web',
    cwd: '/tmp/ws',
    messages,
    onEvent: () => {},
  })
  const timer = new Promise<'waited'>(resolve => setTimeout(() => resolve('waited'), 2000).unref())
  assert.notEqual(await Promise.race([agent.then(() => 'ended' as const), timer]), 'waited')
})

test('runAgent resumes a stopped leg: session resumed, message sent verbatim (#1467)', async () => {
  const fd = fakeDriver()
  let startedWith: { resumeSessionId?: string } | undefined
  const prompts: string[] = []
  const driver: Driver = {
    id: 'fake',
    start: async opts => {
      startedWith = opts
      const session = await fd.start(opts)
      // Explicit delegation rather than a spread: the fake session's methods live on its
      // prototype, so a spread would silently drop `dispose`.
      const wrapped: DriverSession = {
        id: session.id,
        cwd: session.cwd,
        prompt: (text, promptOpts) => {
          prompts.push(text)
          return session.prompt(text, promptOpts)
        },
        dispose: () => session.dispose(),
      }
      return wrapped
    },
  }
  const events: FrameworkEvent[] = []
  const RESUME = 'Resume: continue where the previous leg stopped.'
  await runAgent({
    prompt: RESUME,
    driver,
    cwd: '/tmp/ws',
    resumeSessionId: 'sess-42',
    onEvent: e => events.push(e),
  })
  // The driver resumed the prior conversation rather than starting a new one.
  assert.equal(startedWith?.resumeSessionId, 'sess-42')
  // The continuation message went out verbatim — no build/extend prompt re-framing (#782).
  assert.equal(prompts[0], RESUME)
  // The flow still ran as a build: the session announced its intent and the backlog followed.
  assert.ok(events.some(e => e.kind === 'intent' && e.text === RESUME))
})

// The build framing, now that one path opens every session (D2). These used to live in
// steps.test.ts against `driverBuild`; the framing is the same, the seam it hangs off is not.

/** A real-named driver over the fake one, so the workspace check is live (the fake opts out). */
function realNamedDriver(turns: { text: string }[]): { driver: Driver; prompts: string[] } {
  const prompts: string[] = []
  const inner = new FakeDriver({ turns })
  const driver: Driver = {
    id: 'claude-code',
    start: async opts => {
      const session = await inner.start(opts)
      const wrapped: DriverSession = {
        ...session,
        dispose: () => session.dispose(),
        prompt: (text, o) => {
          prompts.push(text)
          return session.prompt(text, o)
        },
      }
      return wrapped
    },
  }
  return { driver, prompts }
}

test('a build opens with the intent itself, rendered through the user-prompt slot — no wrapper (#185)', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'fw-extend-'))
  await mkdir(join(cwd, 'src'), { recursive: true })
  await writeFile(join(cwd, 'src/index.ts'), 'export {}')
  try {
    const { driver, prompts } = realNamedDriver([{ text: 'added the feature' }])
    await runAgent({ prompt: 'add a search box', driver, cwd, todoLoop: false })
    assert.equal(prompts[0], 'add a search box')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a prompt session runs its text without build framing, and works no backlog (#353)', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'fw-promptkind-'))
  await writeFile(join(cwd, 'TODO_AGENTS.md'), '- [ ] leftover task\n')
  try {
    const { driver, prompts } = realNamedDriver([{ text: 'reviewed it' }])
    const { todo } = await runAgent({ prompt: 'review the auth flow', kind: 'prompt', driver, cwd, vanilla: true })
    assert.equal(prompts.length, 1, 'one prompt, and no backlog turns after it')
    assert.equal(prompts[0], 'review the auth flow')
    assert.equal(todo, undefined)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
