import { test } from 'node:test'
import assert from 'node:assert/strict'
import { githubToken } from './gh.js'
import type { GhRunner } from './gh.js'

/** A `gh` that answers with `stdout`, or rejects, and records what it was asked. */
function fakeGh(stdout: string | Error): { gh: GhRunner; calls: string[][] } {
  const calls: string[][] = []
  const gh: GhRunner = async args => {
    calls.push(args)
    if (stdout instanceof Error) throw stdout
    return stdout
  }
  return { gh, calls }
}

test('GH_TOKEN wins over the gh CLI, which is not consulted at all', async () => {
  // CI sets the variable and must beat whatever gh happens to be logged in as on the runner.
  const { gh, calls } = fakeGh('gho_from_cli\n')
  assert.equal(await githubToken('/repo', { GH_TOKEN: 'ghp_from_env' }, gh), 'ghp_from_env')
  assert.deepEqual(calls, [])
})

test('GITHUB_TOKEN is honoured too, as the second environment spelling', async () => {
  const { gh } = fakeGh('gho_from_cli\n')
  assert.equal(await githubToken('/repo', { GITHUB_TOKEN: 'ghp_from_env' }, gh), 'ghp_from_env')
})

test('with no token in the environment, the gh CLI credential is used (#1352)', async () => {
  // The point of the change: a machine whose gh can already open PRs can run an Actions session,
  // instead of failing with the credential sitting one `gh auth token` away.
  const { gh, calls } = fakeGh('gho_from_cli\n')
  assert.equal(await githubToken('/repo', {}, gh), 'gho_from_cli')
  assert.deepEqual(calls, [['auth', 'token']])
})

test('a gh that is missing, logged out, or refusing yields no token rather than throwing', async () => {
  // The caller turns undefined into the run's stated reason; a rejection here would instead
  // surface as an unhandled failure deep in the start path.
  const { gh } = fakeGh(new Error('gh: command not found'))
  assert.equal(await githubToken('/repo', {}, gh), undefined)
})

test('an empty or blank gh answer is no token, not an empty-string one', async () => {
  // `gh auth token` prints nothing when logged out of the active host. An empty string would sail
  // past the caller's `if (!token)` check as a real credential and fail later, at the API.
  assert.equal(await githubToken('/repo', {}, fakeGh('').gh), undefined)
  assert.equal(await githubToken('/repo', {}, fakeGh('  \n').gh), undefined)
})

test('an empty environment variable falls through to the CLI rather than counting as a token', async () => {
  // `GH_TOKEN=` in a shell profile is the same as unset, and used to be treated as a real value.
  const { gh } = fakeGh('gho_from_cli\n')
  assert.equal(await githubToken('/repo', { GH_TOKEN: '' }, gh), 'gho_from_cli')
})
