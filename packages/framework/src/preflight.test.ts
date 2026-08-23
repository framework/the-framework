import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { preflight, preflightProblems, type CliProbe } from './preflight.js'

/**
 * A probe that answers `--version` and the agent's own auth args separately, so a test can say
 * "installed but logged out" without stubbing a whole CLI. Anything unlisted answers empty,
 * which is what an old CLI that does not know the subcommand looks like.
 */
function probeFor(answers: { version?: { ok: boolean; output: string }; auth?: { ok: boolean; output: string } }): CliProbe {
  return (_bin, args) =>
    Promise.resolve(
      args[0] === '--version'
        ? (answers.version ?? { ok: true, output: '1.2.3' })
        : (answers.auth ?? { ok: true, output: '' }),
    )
}

/** No root anywhere unless a test asks for it: the suite must pass under a root CI container. */
const notRoot = { isRoot: () => false }

test('preflight passes when the agent CLI is present', async () => {
  const result = await preflight({ ...notRoot, probe: probeFor({ version: { ok: true, output: '1.2.3 (Claude Code)' } }) })
  assert.equal(result.ok, true)
  const cc = result.checks.find(c => c.name === 'claude')
  assert.equal(cc?.ok, true)
  assert.match(cc!.detail, /1\.2\.3/)
})

test('preflight fails with install guidance when the agent CLI is missing', async () => {
  const result = await preflight({ ...notRoot, bin: 'claude', probe: probeFor({ version: { ok: false, output: '' } }) })
  assert.equal(result.ok, false)
  const cc = result.checks.find(c => c.name === 'claude')
  assert.equal(cc?.ok, false)
  assert.match(cc!.detail, /not found/)
  assert.match(cc!.detail, /claude\.com\/claude-code/)
})

test('preflight probes the picked agent, not always claude (#542)', async () => {
  const probed: string[] = []
  const result = await preflight({
    ...notRoot,
    driver: 'codex',
    probe: (bin, args) => {
      if (args[0] === '--version') probed.push(bin)
      return Promise.resolve({ ok: true, output: 'codex-cli 0.144.4' })
    },
  })
  assert.deepEqual(probed, ['codex'])
  assert.equal(result.ok, true)
  const cli = result.checks.find(c => c.name === 'codex')
  assert.match(cli!.detail, /0\.144\.4/)
})

test('a missing codex points at the codex install, not the claude one (#542)', async () => {
  const result = await preflight({ ...notRoot, driver: 'codex', probe: probeFor({ version: { ok: false, output: '' } }) })
  assert.equal(result.ok, false)
  const cli = result.checks.find(c => c.name === 'codex')
  assert.equal(cli?.ok, false)
  assert.match(cli!.detail, /`codex` not found/)
  assert.match(cli!.detail, /openai\.com\/codex/)
})

test('preflight always reports the node version', async () => {
  const result = await preflight({ ...notRoot, probe: probeFor({}) })
  const node = result.checks.find(c => c.name === 'node')
  assert.equal(node?.ok, true)
  assert.equal(node?.detail, process.version)
})

// #1326: installed is not usable. A logged-out CLI resolves and answers `--version` perfectly,
// then dies before the session exists, which is what #1323 spent six projects' branches on.

test('a logged-out claude fails preflight, naming the command that fixes it (#1326)', async () => {
  const result = await preflight({
    ...notRoot,
    probe: probeFor({ auth: { ok: true, output: '{"loggedIn": false}' } }),
  })
  assert.equal(result.ok, false)
  const auth = result.checks.find(c => c.name === 'claude auth')
  assert.equal(auth?.ok, false)
  assert.match(auth!.detail, /not logged in/)
  assert.match(auth!.detail, /claude auth login/)
})

test('a logged-in claude passes and says so (#1326)', async () => {
  const result = await preflight({
    ...notRoot,
    probe: probeFor({ auth: { ok: true, output: '{"loggedIn": true, "authMethod": "claude.ai"}' } }),
  })
  assert.equal(result.ok, true)
  assert.equal(result.checks.find(c => c.name === 'claude auth')?.ok, true)
})

test('a logged-out codex fails preflight, naming its own fix (#1326)', async () => {
  const result = await preflight({
    ...notRoot,
    driver: 'codex',
    probe: probeFor({ auth: { ok: false, output: 'Not logged in' } }),
  })
  assert.equal(result.ok, false)
  const auth = result.checks.find(c => c.name === 'codex auth')
  assert.equal(auth?.ok, false)
  assert.match(auth!.detail, /codex login/)
})

test('"Not logged in" is not read as logged in (#1326)', async () => {
  // The positive is a substring of the negative, so a naive test order would invert the answer.
  const result = await preflight({ ...notRoot, driver: 'codex', probe: probeFor({ auth: { ok: true, output: 'Not logged in' } }) })
  assert.equal(result.ok, false)
})

test('a logged-in codex passes (#1326)', async () => {
  const result = await preflight({ ...notRoot, driver: 'codex', probe: probeFor({ auth: { ok: true, output: 'Logged in using ChatGPT' } }) })
  assert.equal(result.ok, true)
  assert.equal(result.checks.find(c => c.name === 'codex auth')?.ok, true)
})

test('a CLI that will not say whether it is logged in does not fail the run (#1326)', async () => {
  // An older CLI prints usage for a subcommand it does not have. Unreadable means unknown, and
  // an agent that might work beats a warning we cannot stand behind.
  const result = await preflight({ ...notRoot, probe: probeFor({ auth: { ok: false, output: "error: unknown command 'auth'" } }) })
  assert.equal(result.ok, true)
  assert.equal(result.checks.find(c => c.name === 'claude auth'), undefined)
})

test('auth is not probed when the CLI itself is missing (#1326)', async () => {
  const args: string[][] = []
  const result = await preflight({
    ...notRoot,
    probe: (_bin, a) => {
      args.push([...a])
      return Promise.resolve({ ok: false, output: '' })
    },
  })
  assert.deepEqual(args, [['--version']])
  // One "not found" rather than two lines saying the same thing.
  assert.deepEqual(preflightProblems(result).length, 1)
})

test('the auth answer is read off stderr too (#1326)', async () => {
  // The default probe merges the streams because the two CLIs disagree about where status goes.
  const result = await preflight({ ...notRoot, driver: 'codex', probe: probeFor({ auth: { ok: false, output: 'Not logged in' } }) })
  assert.equal(result.checks.find(c => c.name === 'codex auth')?.ok, false)
})

// #1326: root is the sudo-HOME trap (#1323). sudo moves HOME, so the CLI reads root's credentials, finds
// none, and every agent dies identically with a log that says nothing about why.

test('running as root warns without blocking the run (#1326)', async () => {
  const result = await preflight({ probe: probeFor({}), isRoot: () => true, sudoUser: undefined })
  const root = result.checks.find(c => c.name === 'root')
  assert.equal(root?.warn, true)
  assert.equal(root?.ok, true)
  assert.match(root!.detail, /credentials/)
  assert.match(root!.detail, /sudo/)
  // A container legitimately runs as root, so this must never be the thing that stops a start.
  assert.equal(result.ok, true)
})

test('the root warning names the user sudo came from (#1326)', async () => {
  const result = await preflight({ probe: probeFor({}), isRoot: () => true, sudoUser: 'richard' })
  assert.match(result.checks.find(c => c.name === 'root')!.detail, /`richard`/)
})

test('no root check when the process is not root (#1326)', async () => {
  const result = await preflight({ probe: probeFor({}), isRoot: () => false })
  assert.equal(result.checks.find(c => c.name === 'root'), undefined)
})

test('preflightProblems lists only the failures, each with its fix (#1326)', async () => {
  const result = await preflight({
    probe: probeFor({ auth: { ok: true, output: '{"loggedIn": false}' } }),
    isRoot: () => true,
  })
  const problems = preflightProblems(result)
  assert.equal(problems.length, 1)
  assert.match(problems[0]!, /^claude auth: /)
  // The warning is not a problem, and must not be reported as one.
  assert.equal(problems.some(p => p.startsWith('root')), false)
})

// #1419: an armed PR/merge rung publishes through `gh` at the finish, hours after the Start that
// could have said it will not work. Warnings only — the agent itself needs no gh to do its work.

/** A probe that answers for `gh` separately from the agent CLI, which always passes here. */
function withGh(gh: { version: { ok: boolean; output: string }; auth?: { ok: boolean; output: string } }): CliProbe {
  return (bin, args) =>
    Promise.resolve(
      bin === 'gh'
        ? args[0] === '--version'
          ? gh.version
          : (gh.auth ?? { ok: true, output: '' })
        : { ok: true, output: '1.2.3' },
    )
}

test('publish warns when gh is missing, naming install and login, without blocking (#1419)', async () => {
  const result = await preflight({ ...notRoot, publish: true, probe: withGh({ version: { ok: false, output: '' } }) })
  assert.equal(result.ok, true)
  const gh = result.checks.find(c => c.name === 'gh')
  assert.equal(gh?.warn, true)
  assert.match(gh!.detail, /`gh` not found/)
  assert.match(gh!.detail, /brew install gh/)
  assert.match(gh!.detail, /gh auth login/)
})

test('publish warns when gh is logged out, naming the fix, without blocking (#1419)', async () => {
  const result = await preflight({
    ...notRoot,
    publish: true,
    probe: withGh({ version: { ok: true, output: 'gh version 2.93.0' }, auth: { ok: false, output: 'You are not logged into any GitHub hosts.' } }),
  })
  assert.equal(result.ok, true)
  const auth = result.checks.find(c => c.name === 'gh auth')
  assert.equal(auth?.warn, true)
  assert.match(auth!.detail, /not logged in/)
  assert.match(auth!.detail, /gh auth login/)
})

test('publish adds nothing when gh is installed and logged in (#1419)', async () => {
  const result = await preflight({ ...notRoot, publish: true, probe: withGh({ version: { ok: true, output: 'gh version 2.93.0' } }) })
  assert.equal(result.checks.some(c => c.name.startsWith('gh')), false)
})

test('gh is not probed at all when no publish rung asks for it (#1419)', async () => {
  const probed: string[] = []
  await preflight({
    ...notRoot,
    probe: (bin, _args) => {
      probed.push(bin)
      return Promise.resolve({ ok: true, output: '1.2.3' })
    },
  })
  assert.equal(probed.includes('gh'), false)
})
