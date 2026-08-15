import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SupervisorEvent } from './run-types.js'
import { FakeDriver } from './driver/index.js'
import {
  driverBuild,
  extendPrompt,
  isWorkspaceEmpty,
} from './steps.js'

/** Make a throwaway workspace dir, seeded with the given relative files. */
function makeWorkspace(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'fw-steps-'))
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, contents)
  }
  return dir
}

test('driverBuild emits supervisor events and returns the driver summary', async () => {
  const session = await new FakeDriver({ turns: [{ text: 'Built the app.' }] }).start({ cwd: '/ws' })
  const events: SupervisorEvent[] = []
  const run = await driverBuild(session)({
    scope: 'full',
    intent: 'orders app',
    onEvent: e => events.push(e),
  })
  assert.equal(run.text, 'Built the app.')
  assert.deepEqual(
    events.map(e => e.type),
    ['plan', 'dispatch-start', 'dispatch-result', 'synthesize'],
  )
})

test('isWorkspaceEmpty: true for an empty dir and one with only noise, false with a source file', () => {
  const empty = makeWorkspace()
  const noise = makeWorkspace({
    'package-lock.json': '{}',
    '.gitignore': 'node_modules',
    'node_modules/dep/index.js': 'x',
  })
  const built = makeWorkspace({ 'src/index.ts': 'export {}' })
  try {
    assert.equal(isWorkspaceEmpty(empty), true)
    assert.equal(isWorkspaceEmpty(noise), true)
    assert.equal(isWorkspaceEmpty(built), false)
    assert.equal(isWorkspaceEmpty(join(empty, 'does-not-exist')), true)
  } finally {
    for (const d of [empty, noise, built]) rmSync(d, { recursive: true, force: true })
  }
})

test('driverBuild re-prompts to scaffold from scratch when the workspace stays empty (#182)', async () => {
  const cwd = makeWorkspace() // empty: the agent produced nothing
  try {
    const session = await new FakeDriver({
      turns: [{ text: 'thinking about the stack' }, { text: 'scaffolded the whole app' }],
    }).start({ cwd })
    const events: SupervisorEvent[] = []
    const run = await driverBuild(session, { verifyWorkspace: true })({
      scope: 'full',
      intent: 'a blog',
      onEvent: e => events.push(e),
    })
    // Two dispatches: the build, then the hard from-scratch retry.
    assert.equal(session.prompts.length, 2)
    assert.match(session.prompts[1]!, /from scratch|empty/i)
    assert.equal(run.plan.length, 2)
    assert.deepEqual(
      events.map(e => e.type),
      ['plan', 'dispatch-start', 'dispatch-result', 'dispatch-start', 'dispatch-result', 'synthesize'],
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('driverBuild does not re-prompt when the build produced files', async () => {
  const cwd = makeWorkspace({ 'package.json': '{}', 'pages/index.tsx': 'export default () => null' })
  try {
    const session = await new FakeDriver({ turns: [{ text: 'built it' }] }).start({ cwd })
    const run = await driverBuild(session, { verifyWorkspace: true })({
      scope: 'full',
      intent: 'a blog',
      onEvent: () => {},
    })
    assert.equal(session.prompts.length, 1)
    assert.equal(run.plan.length, 1)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('driverBuild extends an existing project instead of rebuilding it (#185)', async () => {
  const cwd = makeWorkspace({ 'package.json': '{}', 'src/index.ts': 'export {}' })
  try {
    const session = await new FakeDriver({ turns: [{ text: 'added the feature' }] }).start({ cwd })
    const events: SupervisorEvent[] = []
    await driverBuild(session, { verifyWorkspace: true })({
      scope: 'full',
      intent: 'add a search box',
      onEvent: e => events.push(e),
    })
    // Existing codebase: extend framing, and no from-scratch scaffolding language.
    assert.equal(session.prompts.length, 1)
    assert.match(session.prompts[0]!, /existing codebase/i)
    assert.doesNotMatch(session.prompts[0]!, /scaffold the whole project|workspace may be empty/i)
    const plan = events.find(e => e.type === 'plan')
    assert.ok(plan?.type === 'plan')
    assert.match(plan.subtasks[0]!.description, /existing codebase/i)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('driverBuild uses greenfield framing for an empty workspace (#185)', async () => {
  const cwd = makeWorkspace() // empty: a from-scratch build
  try {
    const session = await new FakeDriver({ turns: [{ text: 'scaffolded it' }] }).start({ cwd })
    await driverBuild(session, { verifyWorkspace: true })({
      scope: 'full',
      intent: 'a blog',
      onEvent: () => {},
    })
    assert.match(session.prompts[0]!, /Build this app end to end/i)
    assert.doesNotMatch(session.prompts[0]!, /existing codebase/i)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('extendPrompt names the work and the workspace, and nothing else (#1224)', () => {
  const prompt = extendPrompt('add a settings page')
  assert.match(prompt, /add a settings page/)
  // The one thing the agent cannot infer: this codebase already exists.
  assert.match(prompt, /existing codebase/i)
  // #1224: the rules telling it how to behave are gone, not reworded.
  assert.doesNotMatch(prompt, /do NOT re-scaffold|swap its stack|smallest coherent|read the existing code first/i)
  // #1372: the set-scope ask went with the production-grade gate it existed to skip.
  assert.doesNotMatch(prompt, /set-scope/)
})
