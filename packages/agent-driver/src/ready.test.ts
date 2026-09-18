import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { checkDriverReady, type CliProbe } from './ready.js'

/**
 * A probe that answers `--version` and the login question separately, so a test can say
 * "installed but logged out" without a whole CLI. The login question answers empty unless
 * given: what an old CLI that does not know the subcommand looks like.
 */
function probeFor(answers: { version?: { ok: boolean; output: string }; auth?: { ok: boolean; output: string } }): CliProbe {
  return (_bin, args) => Promise.resolve(args[0] === '--version' ? (answers.version ?? { ok: true, output: '1.2.3' }) : (answers.auth ?? { ok: true, output: '' }))
}

/** No root unless a test asks for it: the suite must pass in a root CI container. */
const notRoot = { isRoot: () => false }

test('an installed, logged-in Claude Code is ready', async () => {
  const ready = await checkDriverReady('claude-code', { ...notRoot, probe: probeFor({ auth: { ok: true, output: '{"loggedIn": true, "authMethod": "claude.ai"}' } }) })
  assert.deepEqual(ready, { problems: [], warnings: [] })
})

test('a missing CLI is a problem naming its install, and its login is not asked', async () => {
  const asked: string[][] = []
  const ready = await checkDriverReady('claude-code', {
    ...notRoot,
    probe: (_bin, args) => {
      asked.push([...args])
      return Promise.resolve({ ok: false, output: '' })
    },
  })
  assert.deepEqual(asked, [['--version']])
  assert.equal(ready.problems.length, 1)
  assert.match(ready.problems[0]!, /`claude` not found/)
  assert.match(ready.problems[0]!, /claude\.com\/claude-code/)
})

test('Codex is asked about codex, and a missing one points at the Codex install', async () => {
  const probed: string[] = []
  const ready = await checkDriverReady('codex', {
    ...notRoot,
    probe: (bin, args) => {
      if (args[0] === '--version') probed.push(bin)
      return Promise.resolve({ ok: false, output: '' })
    },
  })
  assert.deepEqual(probed, ['codex'])
  assert.match(ready.problems[0]!, /`codex` not found/)
  assert.match(ready.problems[0]!, /openai\.com\/codex/)
})

test('a logged-out Claude Code is a problem naming the command that fixes it', async () => {
  const ready = await checkDriverReady('claude-code', { ...notRoot, probe: probeFor({ auth: { ok: true, output: '{"loggedIn": false}' } }) })
  assert.equal(ready.problems.length, 1)
  assert.match(ready.problems[0]!, /not logged in/)
  assert.match(ready.problems[0]!, /claude auth login/)
})

test('"Not logged in" is not read as logged in, and is read off stderr too', async () => {
  // The positive is a substring of the negative; the probe merges stderr into the output.
  const ready = await checkDriverReady('codex', { ...notRoot, probe: probeFor({ auth: { ok: false, output: 'Not logged in' } }) })
  assert.equal(ready.problems.length, 1)
  assert.match(ready.problems[0]!, /codex login/)
})

test('a logged-in Codex is ready', async () => {
  const ready = await checkDriverReady('codex', { ...notRoot, probe: probeFor({ auth: { ok: true, output: 'Logged in using ChatGPT' } }) })
  assert.deepEqual(ready.problems, [])
})

test('a CLI that will not say whether it is logged in is ready', async () => {
  const ready = await checkDriverReady('claude-code', { ...notRoot, probe: probeFor({ auth: { ok: false, output: "error: unknown command 'auth'" } }) })
  assert.deepEqual(ready.problems, [])
})

test('root warns, naming the sudo user, and blocks nothing', async () => {
  const ready = await checkDriverReady('claude-code', { isRoot: () => true, sudoUser: 'alice', probe: probeFor({ auth: { ok: true, output: '{"loggedIn": true}' } }) })
  assert.deepEqual(ready.problems, [])
  assert.equal(ready.warnings.length, 1)
  assert.match(ready.warnings[0]!, /root/)
  assert.match(ready.warnings[0]!, /`alice`/)
})
