import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli } from './cli.js'
import { DEFAULT_STATE, readState, statePath, writeState } from './state.js'
import { removeRepo, testRepo, writeSkill } from './test-repo.js'

// The contract on top of the functions: JSON on stdout, a line for a person on stderr, and an
// exit code that says refusal or failure. The commands that spawn or talk to Claude are covered
// by their modules; here the file-only ones run for real. `run` and `check` are agent-runner's.

interface Ran {
  code: number
  out: unknown
  err: string
}

async function run(cwd: string, ...argv: string[]): Promise<Ran> {
  const outLines: string[] = []
  const errLines: string[] = []
  const code = await runCli(argv, { cwd, stdout: line => outLines.push(line), stderr: line => errLines.push(line) })
  return { code, out: outLines.length ? JSON.parse(outLines.join('\n')) : undefined, err: errLines.join('\n') }
}

test('status reads the state; model and offset write it; stop turns it off; every answer is one JSON object', async () => {
  const repo = await testRepo()
  try {
    const fresh = await run(repo, 'status')
    assert.equal(fresh.code, 0)
    assert.deepEqual(fresh.out, { ok: true, on: false, keepAlive: false, model: 'opus', spendOffset: 100 / 14, running: false })

    const model = await run(repo, 'model', 'sonnet')
    assert.equal(model.code, 0)
    assert.equal((model.out as { model: string }).model, 'sonnet')
    const offset = await run(repo, 'offset', '50')
    assert.equal((offset.out as { spendOffset: number }).spendOffset, 50)
    assert.equal((await readState(repo)).model, 'sonnet')
    assert.match(await readFile(statePath(repo), 'utf8'), /"spendOffset": 50/)

    const stopped = await run(repo, 'stop')
    assert.equal(stopped.code, 0)
    assert.equal((stopped.out as { on: boolean }).on, false)

    // From inside a checkout the same command still acts on the project.
    const nested = await run(join(repo, '.claude'), 'status')
    assert.equal((nested.out as { model: string }).model, 'sonnet')
  } finally {
    await removeRepo(repo)
  }
})

test('usage errors exit 2 with the usage on stderr and nothing on stdout; outside a repository is a refusal', async () => {
  const repo = await testRepo()
  const elsewhere = await mkdtemp(join(tmpdir(), 'not-a-repo-'))
  try {
    for (const argv of [[], ['nope'], ['model'], ['offset', 'many'], ['status', 'extra'], ['init', 'extra'], ['run', 'Read the docs'], ['check'], ['switch', 'work-queue'], ['switch', 'work-queue', 'maybe'], ['publish', 'work-queue'], ['publish', 'work-queue', 'push'], ['publish', 'work-queue', 'file']]) {
      const bad = await run(repo, ...argv)
      assert.equal(bad.code, 2, argv.join(' '))
      assert.equal(bad.out, undefined)
      assert.match(bad.err, /usage: agent-scheduler/)
    }
    const outside = await run(elsewhere, 'status')
    assert.equal(outside.code, 1)
    assert.deepEqual(outside.out, { ok: false, reason: 'not-a-repo' })
    assert.equal(outside.err, 'not inside a git repository')
  } finally {
    await removeRepo(repo)
    await rm(elsewhere, { recursive: true, force: true })
  }
})

test('stop --unless-keep-alive leaves a keep-alive scheduler running, and stops any other', async () => {
  const repo = await testRepo()
  try {
    // This test's own process stands in for the scheduler's: a stop that signalled it would end the test.
    await writeState(repo, { ...DEFAULT_STATE, on: true, keepAlive: true, pid: process.pid, startedAt: '2026-01-01T00:00:00.000Z' })
    const kept = await run(repo, 'stop', '--unless-keep-alive')
    assert.equal(kept.code, 0)
    assert.equal(kept.err, 'keep-alive is on, the scheduler keeps running')
    const out = kept.out as { ok: boolean; on: boolean; kept: boolean; pid?: number }
    assert.equal(out.kept, true)
    assert.equal(out.on, true)
    assert.equal(out.pid, process.pid)
    const after = await readState(repo)
    assert.equal(after.on, true)
    assert.equal(after.pid, process.pid, 'the state is untouched')

    // Without keep-alive the flag changes nothing: off, no pid (the pid here is a dead one, so nothing is signalled).
    await writeState(repo, { ...DEFAULT_STATE, on: true, keepAlive: false, pid: 2 ** 31 - 1 })
    const stopped = await run(repo, 'stop', '--unless-keep-alive')
    assert.equal(stopped.code, 0)
    assert.equal(stopped.err, '')
    assert.deepEqual(stopped.out, { ok: true, on: false, keepAlive: false, model: 'opus', spendOffset: 100 / 14, kept: false })

    // A plain stop stops a keep-alive scheduler too: it is how a person turns the thing off.
    await writeState(repo, { ...DEFAULT_STATE, on: true, keepAlive: true, pid: 2 ** 31 - 1 })
    const plain = await run(repo, 'stop')
    assert.equal((plain.out as { on: boolean; kept: boolean }).on, false)
    assert.equal((plain.out as { kept: boolean }).kept, false)
  } finally {
    await removeRepo(repo)
  }
})

test('switch writes this machine\'s switch for a scheduled command: only a command switched on is kept; switching on a command no skill schedules is refused, with why when its skill\'s schedule cannot be read; off is taken for any name', async () => {
  const repo = await testRepo()
  try {
    // The project's one skill schedules nothing.
    const none = await run(repo, 'switch', 'work-queue', 'on')
    assert.equal(none.code, 1)
    assert.deepEqual(none.out, { ok: false, reason: 'not-scheduled', command: 'work-queue' })
    assert.equal(none.err, 'no skill of this project schedules work-queue')

    await writeSkill(repo, 'work-queue', 'schedule:\n  when: npx queue\n')
    await writeSkill(repo, 'triage', 'schedule:\n  - word: quick\n    every: 6h\n  - word: consensual\n    every: 7d\n')
    const on = await run(repo, 'switch', 'triage quick', 'on')
    assert.equal(on.code, 0)
    assert.deepEqual((on.out as { switches: unknown }).switches, { 'triage quick': true })
    await run(repo, 'switch', 'work-queue', 'on')
    // Switching off a command nobody switched on changes nothing.
    await run(repo, 'switch', 'triage consensual', 'off')
    assert.deepEqual((await readState(repo)).switches, { 'triage quick': true, 'work-queue': true })
    // Everything off again: nothing kept.
    await run(repo, 'switch', 'triage quick', 'off')
    await run(repo, 'switch', 'work-queue', 'off')
    assert.equal((await readState(repo)).switches, undefined)

    // The skill alone is no command when its rows carry a word.
    const unknown = await run(repo, 'switch', 'triage', 'on')
    assert.equal(unknown.code, 1)
    assert.deepEqual(unknown.out, { ok: false, reason: 'not-scheduled', command: 'triage' })
    assert.equal(unknown.err, 'no skill of this project schedules triage')

    // A skill whose schedule cannot be read: the refusal says why, not that nothing schedules it.
    await run(repo, 'switch', 'triage quick', 'on')
    await writeSkill(repo, 'triage', 'schedule:\n  word: quick\n  evry: 6h\n')
    const typo = await run(repo, 'switch', 'triage quick', 'on')
    assert.equal(typo.code, 1)
    assert.deepEqual(typo.out, { ok: false, reason: 'unreadable-schedule', skill: 'triage', detail: 'unknown key evry' })
    assert.equal(typo.err, 'the schedule of triage cannot be read: unknown key evry')
    assert.equal((await run(repo, 'publish', 'triage quick', 'pr')).err, 'the schedule of triage cannot be read: unknown key evry')
    // A switch left on can always be taken back, whatever became of the skill.
    assert.deepEqual((await readState(repo)).switches, { 'triage quick': true })
    const off = await run(repo, 'switch', 'triage quick', 'off')
    assert.equal(off.code, 0)
    assert.equal((await readState(repo)).switches, undefined)
    assert.equal((await run(repo, 'switch', 'never-heard-of', 'off')).code, 0)
  } finally {
    await removeRepo(repo)
  }
})

test('publish writes this machine\'s publish pick for a scheduled command; a command no skill schedules is refused', async () => {
  const repo = await testRepo()
  try {
    const none = await run(repo, 'publish', 'work-queue', 'pr')
    assert.equal(none.code, 1)
    assert.deepEqual(none.out, { ok: false, reason: 'not-scheduled', command: 'work-queue' })

    await writeSkill(repo, 'work-queue', 'schedule:\n  when: npx queue\n')
    await writeSkill(repo, 'triage', 'schedule:\n  word: quick\n  every: 6h\n')
    const nothing = await run(repo, 'publish', 'work-queue', 'nothing')
    assert.equal(nothing.code, 0)
    assert.deepEqual((nothing.out as { publishes: unknown }).publishes, { 'work-queue': 'nothing' })
    await run(repo, 'publish', 'triage quick', 'pr')
    assert.deepEqual((await readState(repo)).publishes, { 'work-queue': 'nothing', 'triage quick': 'pr' })
    // A pick of what nobody picking gives, commit, is kept all the same.
    await run(repo, 'publish', 'work-queue', 'commit')
    assert.deepEqual((await readState(repo)).publishes, { 'work-queue': 'commit', 'triage quick': 'pr' })

    const unknown = await run(repo, 'publish', 'triage-quick', 'pr')
    assert.equal(unknown.code, 1)
    assert.deepEqual(unknown.out, { ok: false, reason: 'not-scheduled', command: 'triage-quick' })
    assert.equal(unknown.err, 'no skill of this project schedules triage-quick')
  } finally {
    await removeRepo(repo)
  }
})

test("pace writes this machine's pace for a scheduled command: an interval, a time of day with days or more, whenever there is work, and `skill` takes it back", async () => {
  const repo = await testRepo()
  try {
    await writeSkill(repo, 'work-queue', 'schedule:\n  when: npx queue\n')
    await writeSkill(repo, 'triage', 'schedule:\n  word: quick\n  every: 6h\n')
    const slower = await run(repo, 'pace', 'triage quick', '2d')
    assert.equal(slower.code, 0)
    const picked = (slower.out as { paces: Record<string, { every: string; at?: string; since: string }> }).paces['triage quick']!
    assert.equal(picked.every, '2d')
    assert.equal('at' in picked, false)
    assert.equal(new Date(picked.since).toISOString(), picked.since, 'when it was picked is recorded')
    await run(repo, 'pace', 'triage quick', '2w', '9:05')
    assert.deepEqual({ ...(await readState(repo)).paces!['triage quick'], since: '' }, { every: '2w', at: '09:05', since: '' })
    await run(repo, 'pace', 'work-queue', 'work')
    assert.deepEqual((await readState(repo)).paces!['work-queue'], { work: true })
    // The skill's own pace again: nothing kept.
    await run(repo, 'pace', 'triage quick', 'skill')
    await run(repo, 'pace', 'work-queue', 'skill')
    assert.equal((await readState(repo)).paces, undefined)

    // "Whenever there is work" needs a check to ask.
    const noCheck = await run(repo, 'pace', 'triage quick', 'work')
    assert.equal(noCheck.code, 1)
    assert.deepEqual(noCheck.out, { ok: false, reason: 'no-check', command: 'triage quick' })
    assert.equal(noCheck.err, 'triage quick has no check, so nothing would say when there is work')
    const unknown = await run(repo, 'pace', 'triage', '1h')
    assert.equal(unknown.code, 1)
    assert.deepEqual(unknown.out, { ok: false, reason: 'not-scheduled', command: 'triage' })
    assert.equal((await readState(repo)).paces, undefined, 'a refusal writes nothing')

    for (const argv of [['pace', 'work-queue'], ['pace', 'work-queue', 'often'], ['pace', 'work-queue', '0h'], ['pace', 'work-queue', '2d', '25:00'], ['pace', 'work-queue', '6h', '10:00'], ['pace', 'work-queue', 'work', '10:00'], ['pace', 'work-queue', '2d', '10:00', 'extra']]) {
      const bad = await run(repo, ...argv)
      assert.equal(bad.code, 2, argv.join(' '))
      assert.equal(bad.out, undefined)
    }
    assert.match((await run(repo, 'pace', 'work-queue', '6h', '10:00')).err, /^a time of day goes with days, weeks or months/)
  } finally {
    await removeRepo(repo)
  }
})

test('tick on a project with the scheduler off: the branch is pulled, nothing is decided, the state remembers the tick', async () => {
  const repo = await testRepo()
  try {
    await writeSkill(repo, 'work-queue', 'schedule:\n  when: echo []\n  waits-for: when the queue holds a task\n')
    const ticked = await run(repo, 'tick')
    assert.equal(ticked.code, 0)
    const out = ticked.out as { ok: boolean; note?: string; decisions: unknown[]; schedule: unknown[] }
    assert.equal(out.note, 'off')
    assert.deepEqual(out.decisions, [])
    // The tick lists the commands the project's skills schedule, on or off: what a dashboard draws.
    assert.deepEqual(out.schedule, [{ command: 'work-queue', when: 'echo []', waitsFor: 'when the queue holds a task' }])
    assert.equal((await readState(repo)).lastTick?.note, 'off')
  } finally {
    await removeRepo(repo)
  }
})
