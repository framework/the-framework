import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { endedMessage, endedNews, readEndedLine, runEndedLine } from './ended.js'

test('the news: a waiting run always, a done run only with a pull request new to it, nothing else', () => {
  const pr = { url: 'https://x/pull/1' }
  assert.deepEqual(endedNews({ status: 'waiting', question: 'Ship it?' }), { status: 'waiting', question: 'Ship it?' })
  assert.deepEqual(endedNews({ status: 'waiting', question: 'Ship it?', pr, prBefore: pr }), { status: 'waiting', question: 'Ship it?' })
  assert.deepEqual(endedNews({ status: 'done', pr }), { status: 'done', pr })
  assert.equal(endedNews({ status: 'done', pr, prBefore: pr }), undefined)
  assert.equal(endedNews({ status: 'done' }), undefined)
  assert.equal(endedNews({ status: 'failed', pr }), undefined)
  assert.equal(endedNews({ status: 'stopped', pr }), undefined)
})

test('the message names the project, the prompt\'s first line cut short, and what the run needs or did, on one line', () => {
  assert.equal(endedMessage('shop', '/work-queue', { status: 'waiting', question: 'Ship\nit?' }), 'shop: "/work-queue" is waiting for you: Ship it?')
  assert.equal(endedMessage('shop', '/work-queue', { status: 'waiting', question: 'Ship it?', pr: { url: 'https://x/pull/1' } }), 'shop: "/work-queue" is waiting for you: Ship it? (pull request: https://x/pull/1)')
  const long = endedMessage('shop', `${'a'.repeat(100)}\nsecond line`, { status: 'done', pr: { url: 'https://x/pull/1' } })
  assert.equal(long, `shop: "${'a'.repeat(79)}…" opened a pull request: https://x/pull/1`)
})

async function project(config?: string): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), 'agent-runner-ended-'))
  if (config !== undefined) {
    await mkdir(join(repo, '.agent-runner'))
    await writeFile(join(repo, '.agent-runner', 'config.yml'), config)
  }
  return repo
}

test('the line is read from this machine\'s config; none, a file that is not YAML, or a key that is not a string is no line', async () => {
  const log: string[] = []
  assert.equal(await readEndedLine(await project(), l => log.push(l)), undefined)
  assert.equal(await readEndedLine(await project('ended: npx discord send "$MESSAGE"\n'), l => log.push(l)), 'npx discord send "$MESSAGE"')
  assert.equal(await readEndedLine(await project('ended: [a, b]\n'), l => log.push(l)), undefined)
  assert.equal(await readEndedLine(await project('ended: "unclosed\n'), l => log.push(l)), undefined)
  assert.equal(log.length, 2, 'the two broken files are said, the missing one is not')
})

test('a line that fails, or takes too long, is one line on the log and nothing more', async () => {
  const log: string[] = []
  const end = { id: 'r1', prompt: '/work-queue', status: 'waiting', question: 'Q?' }
  await runEndedLine(await project('ended: echo nope >&2; exit 3\n'), end, { log: l => log.push(l) })
  assert.deepEqual(log, ['[agent-runner] the ended line exited 3: nope'])
  // A child that outlives the shell and holds its stderr is ended with it, within the limit.
  const started = Date.now()
  await runEndedLine(await project('ended: sleep 30 & sleep 30\n'), end, { log: l => log.push(l), timeoutMs: 300 })
  assert.ok(Date.now() - started < 5000, 'the wait ends at the limit')
  assert.equal(log[1], '[agent-runner] the ended line took longer than 300ms and was ended')
})

test('what cannot even start is one line on the log, never a throw: a question carrying a NUL, a file that is not a map', async () => {
  const log: string[] = []
  await runEndedLine(await project('ended: "true"\n'), { id: 'r1', prompt: '/work-queue', status: 'waiting', question: 'a\u0000b' }, { log: l => log.push(l) })
  assert.equal(log.length, 1)
  assert.match(log[0]!, /^\[agent-runner\] the ended line could not run: /)
  assert.equal(await readEndedLine(await project('- ended: x\n'), l => log.push(l)), undefined)
  assert.match(log[1]!, /not a YAML map/)
})
