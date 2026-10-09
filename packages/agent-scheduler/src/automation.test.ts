import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addAutomation, automationProblem, automationSkill, tryCheck, type NewAutomation } from './automation.js'
import { FOUND_MAX, MAX_NAME, TRY_TIMEOUT_MS } from './names.js'
import { readSchedule, skillSchedule } from './schedule.js'
import { runCheck } from './tick.js'
import { RETRIED_RM, git, removeRepo, testRepo } from './test-repo.js'

// A person's own automation: the skill file it becomes, what is refused, the file written into the project, and a check tried once.

const CHECK = `gh api "repos/{owner}/{repo}/issues/comments?since=$LAST_RUN" --jq '[.[] | select(.body | startswith("🤖") | not) | {url: .html_url}]'`
const ANSWER: NewAutomation = { name: 'answer-comments', prompt: 'Answer: each new comment below.\n\nBe short.\n', every: '15m', when: CHECK, waitsFor: 'when someone commented: at last' }

test('an automation becomes a command skill: the prompt is its text, its first line the description, and the schedule reads back exactly as typed, quotes, colons and several lines alike', () => {
  const text = automationSkill(ANSWER)
  assert.equal(
    text,
    [
      '---',
      'name: answer-comments',
      'description: "Answer: each new comment below."',
      'disable-model-invocation: true',
      'schedule:',
      '  every: 15m',
      '  waits-for: "when someone commented: at last"',
      '  when: |-',
      `    ${CHECK}`,
      '---',
      '',
      'Answer: each new comment below.',
      '',
      'Be short.',
      '',
    ].join('\n'),
  )
  assert.deepEqual(skillSchedule('answer-comments', text, '.claude/skills'), {
    commands: [{ name: 'answer-comments', when: CHECK, every: { count: 15, unit: 'm', ms: 15 * 60_000, text: '15m' }, waitsFor: 'when someone commented: at last', cap: 1, dir: '.claude/skills', description: 'Answer: each new comment below.' }],
    unreadable: [],
  })
  // A check of several lines, and a prompt whose own text holds a line of dashes.
  const lines = 'since="$LAST_RUN"\n  echo "[\\"$since\\"]" # new'
  const several = automationSkill({ name: 'm', prompt: 'First.\n---\nLast.', when: lines })
  assert.equal(skillSchedule('m', several, '.claude/skills').commands[0]!.when, lines)
  assert.ok(several.endsWith('---\n\nFirst.\n---\nLast.\n'))
  // By a pace alone: no check, and no line saying what one waits for.
  assert.deepEqual(skillSchedule('daily', automationSkill({ name: 'daily', prompt: 'Tidy up.', every: '1d' }), '.claude/skills').commands, [{ name: 'daily', every: { count: 1, unit: 'd', ms: 86_400_000, text: '1d' }, cap: 1, dir: '.claude/skills', description: 'Tidy up.' }])
  // A long first line is cut for the description, never for the prompt.
  const long = 'x'.repeat(400)
  const cut = automationSkill({ name: 'long', prompt: long, every: '1d' })
  assert.equal(skillSchedule('long', cut, '.claude/skills').commands[0]!.description, `${'x'.repeat(149)}…`)
  assert.ok(cut.endsWith(`\n\n${long}\n`))
})

test('whatever a person types changes no other key of the file, and reads the same to a coding agent, whose reader ends the front matter at the first three dashes anywhere', () => {
  // How Claude Code finds a skill's front matter.
  const agentReads = (text: string): string | undefined => /^---\s*\n([\s\S]*?)---\s*\n?/.exec(text)?.[1]
  const odd = ['a --- b', '---', '...', 'x: y', '# no comment', '| pipe', '> fold', '! tag', '& anchor', '* alias', '% dir', '@ at', '`tick`', "it's", 'say "hi"', 'tab\there', 'cr\rhere', 'esc\u001bhere', 'emoji 😀 here', 'disable-model-invocation: false', 'allowed-tools: Bash', 'echo "---"', "grep -- '---' x", 'a\\b \\n c', '\u2028sep', '\u0085nel', '\ufeffbom', '- item', 'null', 'true', '123']
  for (const text of odd) {
    for (const automation of [
      { name: 'x', prompt: text, every: '1d' },
      { name: 'x', prompt: 'Do it.', when: text, waitsFor: text },
      { name: 'x', prompt: `${text}\n${text}`, every: '1d', when: `first\n${text}\n\nlast` },
    ]) {
      const file = automationSkill(automation)
      assert.equal(automationProblem(automation), undefined, JSON.stringify(automation))
      const whole = file.slice(4, file.indexOf('\n---\n', 4) + 1)
      assert.equal(agentReads(file), whole, `the agent's reader sees the whole front matter: ${JSON.stringify(automation)}`)
      assert.ok(whole.includes('\ndisable-model-invocation: true\n') && !/^disable-model-invocation: false/m.test(whole) && !/^allowed-tools:/m.test(whole), `no key of the file's own level is added or changed: ${JSON.stringify(automation)}`)
      const read = skillSchedule('x', file, '.claude/skills').commands[0]!
      assert.equal(read.when, automation.when?.trim(), JSON.stringify(automation))
      assert.equal(read.waitsFor, 'waitsFor' in automation ? automation.waitsFor?.trim() : undefined, JSON.stringify(automation))
      assert.ok(file.endsWith(`\n---\n\n${automation.prompt.trim()}\n`), 'the prompt as typed')
    }
  }
  // Three dashes in the prompt's first line: the description holds them as an escape, and the agent's text still has them.
  const dashed = automationSkill({ name: 'mine', prompt: 'Review open PRs --- only mine', every: '1d' })
  assert.ok(dashed.includes('description: "Review open PRs --\\u002d only mine"\n'))
  assert.ok(dashed.endsWith('\n\nReview open PRs --- only mine\n'))
  // A description cut inside an emoji keeps whole characters, and half a character typed is replaced.
  const cut = automationSkill({ name: 'e', prompt: `${'x'.repeat(148)}😀😀😀`, every: '1d' })
  assert.equal(skillSchedule('e', cut, '.claude/skills').commands[0]!.description, `${'x'.repeat(148)}😀…`)
  assert.equal(skillSchedule('h', automationSkill({ name: 'h', prompt: 'p', when: 'echo \ud83d' }), '.claude/skills').commands[0]!.when, 'echo \ufffd')
  // A check a block cannot hold as typed is written quoted, and reads back the same.
  for (const when of ['a\n \nb', 'trail \nnext', 'tab\tin', 'cr\rin', 'echo "---"']) {
    const file = automationSkill({ name: 'q', prompt: 'p', when })
    assert.ok(!file.includes('when: |-'), when)
    assert.equal(skillSchedule('q', file, '.claude/skills').commands[0]!.when, when.trim())
  }
  // A check of several lines with its own indents stays a block, line for line.
  const indented = 'if true; then\n  echo "[1]"\n\nfi'
  assert.ok(automationSkill({ name: 'b', prompt: 'p', when: indented }).includes('  when: |-\n    if true; then\n      echo "[1]"\n\n    fi\n---'))
  assert.equal(skillSchedule('b', automationSkill({ name: 'b', prompt: 'p', when: indented }), '.claude/skills').commands[0]!.when, indented)
})

test('what cannot be saved says why: a name that is no command, no prompt, and a schedule the tick could not read, in the reader\'s own words', () => {
  assert.equal(automationProblem(ANSWER), undefined)
  assert.deepEqual(automationProblem({ ...ANSWER, name: 'Answer comments' }), { ok: false, reason: 'bad-name', detail: 'a name is lower-case letters, digits and single or double dashes, and starts with a letter or a digit' })
  assert.deepEqual(automationProblem({ ...ANSWER, name: '-x' }), { ok: false, reason: 'bad-name', detail: 'a name is lower-case letters, digits and single or double dashes, and starts with a letter or a digit' })
  assert.equal(automationProblem({ ...ANSWER, name: 'a'.repeat(MAX_NAME) }), undefined)
  // Three dashes in a row would end the file's front matter for a coding agent, in the name as anywhere.
  assert.deepEqual(automationProblem({ ...ANSWER, name: 'a---b' }), { ok: false, reason: 'bad-name', detail: 'a name is lower-case letters, digits and single or double dashes, and starts with a letter or a digit' })
  assert.equal(automationProblem({ ...ANSWER, name: 'a--b' }), undefined)
  assert.deepEqual(automationProblem({ ...ANSWER, name: 'a'.repeat(MAX_NAME + 1) }), { ok: false, reason: 'bad-name', detail: `a name is ${MAX_NAME} characters at most` })
  assert.deepEqual(automationProblem({ ...ANSWER, prompt: ' \n ' }), { ok: false, reason: 'no-prompt' })
  assert.deepEqual(automationProblem({ ...ANSWER, prompt: '\0\0' }), { ok: false, reason: 'no-prompt' }, 'a NUL character is no text')
  assert.deepEqual(automationProblem({ name: 'x', prompt: 'p' }), { ok: false, reason: 'bad-schedule', detail: 'neither every nor when says when' })
  assert.deepEqual(automationProblem({ name: 'x', prompt: 'p', every: 'often' }), { ok: false, reason: 'bad-schedule', detail: 'every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)' })
  assert.deepEqual(automationProblem({ name: 'x', prompt: 'p', every: '1d', waitsFor: 'when it rains' }), { ok: false, reason: 'bad-schedule', detail: 'waits-for says what when waits for, and there is no when' })
  assert.deepEqual(automationProblem({ name: 'x', prompt: 'p', when: 'true', waitsFor: 'one\ntwo' }), { ok: false, reason: 'bad-schedule', detail: 'waits-for is one line of text' })
  assert.deepEqual(automationProblem({ name: 'x', prompt: 'p', when: '  ' }), { ok: false, reason: 'bad-schedule', detail: 'when is a shell command line' })
})

test('saving writes the skill file into the folder the coding agent reads, and the project schedules it at once; a name any skill of the project has is refused and nothing is written', async () => {
  const repo = await testRepo()
  try {
    const saved = await addAutomation(repo, ANSWER, git)
    assert.deepEqual(saved, { ok: true, command: 'answer-comments', file: '.claude/skills/answer-comments/SKILL.md', startsFrom: 'origin/main' })
    assert.equal(await readFile(join(repo, '.claude', 'skills', 'answer-comments', 'SKILL.md'), 'utf8'), automationSkill(ANSWER))
    assert.deepEqual((await readSchedule(repo)).commands.map(c => [c.name, c.when]), [['answer-comments', CHECK]])
    assert.equal((await git(['status', '--porcelain'], repo)).trim(), '?? .claude/skills/answer-comments/', 'a file of the person\'s to commit: nothing is committed for them')
    // Twice: the first is kept as it is.
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, prompt: 'Other words.' }, git), { ok: false, reason: 'taken', folder: '.claude/skills/answer-comments' })
    assert.equal(await readFile(join(repo, '.claude', 'skills', 'answer-comments', 'SKILL.md'), 'utf8'), automationSkill(ANSWER))
    // A skill the project has, in either folder, a link to one included.
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, name: 'work-queue' }, git), { ok: false, reason: 'taken', folder: '.claude/skills/work-queue' })
    await mkdir(join(repo, '.agents', 'skills', 'plan'), { recursive: true })
    await writeFile(join(repo, '.agents', 'skills', 'plan', 'SKILL.md'), '---\nname: plan\n---\nPlan.\n')
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, name: 'plan' }, git), { ok: false, reason: 'taken', folder: '.agents/skills/plan' })
    await symlink('../../.agents/skills/gone', join(repo, '.claude', 'skills', 'linked'))
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, name: 'linked' }, git), { ok: false, reason: 'taken', folder: '.claude/skills/linked' })
    // A name that differs from a folder only by its capitals: one folder on a disk that ignores them.
    await mkdir(join(repo, '.claude', 'skills', 'Loud'))
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, name: 'loud' }, git), { ok: false, reason: 'taken', folder: '.claude/skills/Loud' })
    // An empty folder of that name is taken too, and stays as it was.
    await mkdir(join(repo, '.claude', 'skills', 'hollow'))
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, name: 'hollow' }, git), { ok: false, reason: 'taken', folder: '.claude/skills/hollow' })
    // What cannot be saved writes nothing.
    assert.deepEqual(await addAutomation(repo, { name: 'nothing-says-when', prompt: 'p' }, git), { ok: false, reason: 'bad-schedule', detail: 'neither every nor when says when' })
    assert.deepEqual((await readSchedule(repo)).commands.map(c => c.name), ['answer-comments'])
    assert.deepEqual((await readdir(join(repo, '.claude', 'skills'))).sort(), ['Loud', 'answer-comments', 'hollow', 'linked', 'work-queue'], 'no folder left behind by a save that was refused')
  } finally {
    await removeRepo(repo)
  }
})

test('a project with no remote and no skills folder yet: the folder is made, and the answer says a checkout starts from HEAD; a write that fails leaves no empty folder to be taken for a skill', async () => {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'agent-scheduler-automation-')))
  try {
    await git(['init', '-q', '-b', 'main'], repo)
    assert.deepEqual(await addAutomation(repo, { name: 'daily', prompt: 'Tidy up.', every: '1d' }, git), { ok: true, command: 'daily', file: '.claude/skills/daily/SKILL.md', startsFrom: 'HEAD' })
    assert.deepEqual((await readSchedule(repo)).commands.map(c => c.name), ['daily'])
    // The file cannot be written (a full disk): the save fails, and the folder made for it is taken away again.
    await assert.rejects(addAutomation(repo, { name: 'weekly', prompt: 'Tidy more.', every: '7d' }, git, { write: async () => Promise.reject(new Error('ENOSPC: no space left on device')) }), /ENOSPC/)
    assert.deepEqual(await readdir(join(repo, '.claude', 'skills')), ['daily'])
    assert.equal((await addAutomation(repo, { name: 'weekly', prompt: 'Tidy more.', every: '7d' }, git)).ok, true, 'and the name is free for the next save')
    // Kept on this machine, the same: the folder made for the first one is not left empty.
    await assert.rejects(addAutomation(repo, { name: 'monthly', prompt: 'Tidy most.', every: '1mo' }, git, { onThisMachine: true, write: async () => Promise.reject(new Error('ENOSPC: no space left on device')) }), /ENOSPC/)
    assert.deepEqual(await readdir(join(repo, '.agent-scheduler')).catch(() => 'no folder'), [], 'the tool\'s folder is there, hidden, with nothing in it')
  } finally {
    await rm(repo, RETRIED_RM)
  }
})

test('kept on this machine alone, an automation is one file in the tool\'s own folder, hidden from git, and the project schedules it at once with its text as what a run is sent; a name taken by a skill or by another automation, shared or kept here, is refused both ways', async () => {
  const repo = await testRepo()
  try {
    const kept = await addAutomation(repo, ANSWER, git, { onThisMachine: true })
    assert.deepEqual(kept, { ok: true, command: 'answer-comments', file: '.agent-scheduler/automations/answer-comments.md', startsFrom: 'origin/main', onThisMachine: true })
    assert.equal(await readFile(join(repo, '.agent-scheduler', 'automations', 'answer-comments.md'), 'utf8'), automationSkill(ANSWER), 'written like a skill\'s file')
    assert.equal((await git(['status', '--porcelain'], repo)).trim(), '', 'nothing of it shows in git: the folder is hidden before the file is written')
    assert.deepEqual((await readSchedule(repo)).commands.map(c => [c.name, c.dir, c.when, c.text]), [['answer-comments', '.agent-scheduler/automations', CHECK, 'Answer: each new comment below.\n\nBe short.']])
    // The name is taken now, for one kept here and for one shared, whatever the capitals of the file there.
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, prompt: 'Other.' }, git, { onThisMachine: true }), { ok: false, reason: 'taken', folder: '.agent-scheduler/automations/answer-comments.md' })
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, prompt: 'Other.' }, git), { ok: false, reason: 'taken', folder: '.agent-scheduler/automations/answer-comments.md' })
    await writeFile(join(repo, '.agent-scheduler', 'automations', 'Loud.md'), 'x')
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, name: 'loud' }, git), { ok: false, reason: 'taken', folder: '.agent-scheduler/automations/Loud.md' })
    // A skill of the project keeps its name from an automation kept here too.
    assert.deepEqual(await addAutomation(repo, { ...ANSWER, name: 'work-queue' }, git, { onThisMachine: true }), { ok: false, reason: 'taken', folder: '.claude/skills/work-queue' })
    // And a shared one keeps its name from one kept here.
    assert.equal((await addAutomation(repo, { name: 'shared-one', prompt: 'p', every: '1d' }, git)).ok, true)
    assert.deepEqual(await addAutomation(repo, { name: 'shared-one', prompt: 'p', every: '1d' }, git, { onThisMachine: true }), { ok: false, reason: 'taken', folder: '.claude/skills/shared-one' })
    // What cannot be saved is refused here as there, and writes nothing.
    assert.deepEqual(await addAutomation(repo, { name: 'never', prompt: 'p' }, git, { onThisMachine: true }), { ok: false, reason: 'bad-schedule', detail: 'neither every nor when says when' })
    // A text longer than a run can be handed is refused before it is saved; shared, it is a skill's text and has no such limit.
    assert.deepEqual(await addAutomation(repo, { name: 'endless', prompt: 'x'.repeat(32_001), every: '1d' }, git, { onThisMachine: true }), { ok: false, reason: 'long-prompt', detail: 'the prompt is 32001 characters, and one kept on this machine has 32000 at most' })
    assert.equal((await addAutomation(repo, { name: 'longest', prompt: 'x'.repeat(32_000), every: '1d' }, git, { onThisMachine: true })).ok, true)
    await rm(join(repo, '.agent-scheduler', 'automations', 'longest.md'))
    assert.deepEqual((await readdir(join(repo, '.agent-scheduler', 'automations'))).sort(), ['Loud.md', 'answer-comments.md'])
  } finally {
    await removeRepo(repo)
  }
})

test('trying a check runs it once as a tick would, asking what is new since a day ago, and says what it printed and whether an agent would start; a check that fails says its last line', async () => {
  const now = new Date('2026-10-09T10:00:00.400Z')
  const found = await tryCheck(process.cwd(), 'printf \'["since %s"]\' "$LAST_RUN"', now)
  assert.deepEqual(found, { lastRun: '2026-10-08T10:00:00Z', ran: true, due: true, printed: '["since 2026-10-08T10:00:00Z"]' })
  assert.deepEqual(await tryCheck(process.cwd(), 'echo "[]"', now), { lastRun: '2026-10-08T10:00:00Z', ran: true, due: false, printed: '[]' })
  assert.deepEqual(await tryCheck(process.cwd(), 'true', now), { lastRun: '2026-10-08T10:00:00Z', ran: true, due: false, printed: '' })
  const failed = await tryCheck(process.cwd(), 'echo half; echo first >&2; echo "no such thing" >&2; exit 3', now)
  assert.deepEqual(failed, { lastRun: '2026-10-08T10:00:00Z', ran: false, due: false, printed: 'half', error: 'no such thing' })
  // A long output is cut as a run is handed it, and says so.
  const long = await tryCheck(process.cwd(), 'unused', now, async () => ({ ok: true, stdout: 'y'.repeat(FOUND_MAX + 10), stderr: '' }))
  assert.equal(long.printed, `${'y'.repeat(FOUND_MAX)}\n(cut: the check printed ${FOUND_MAX + 10} characters, these are the first ${FOUND_MAX}; it asked what is new since 2026-10-08T10:00:00Z)`)
  // The check is the tick's own runner, with less time: a dashboard waits for the answer and gives up before a tick would.
  const seen: unknown[] = []
  await tryCheck('/repo', 'npx queue', now, async (...args) => (seen.push(args), { ok: true, stdout: '', stderr: '' }))
  assert.deepEqual(seen, [['/repo', 'npx queue', TRY_TIMEOUT_MS, '2026-10-08T10:00:00Z']])
  assert.ok(TRY_TIMEOUT_MS < 30_000, 'under the 30 seconds a dashboard gives a command')
  // A line that outlives its time says so, not the shell's own words; one that reads its input finds none and ends at once.
  const slow = await tryCheck(process.cwd(), 'sleep 5', now, runCheck, 300)
  assert.deepEqual(slow, { lastRun: '2026-10-08T10:00:00Z', ran: false, due: false, printed: '', error: 'it took longer than 0.3 seconds' })
  const reading = Date.now()
  assert.deepEqual(await tryCheck(process.cwd(), 'cat', now, runCheck, 5_000), { lastRun: '2026-10-08T10:00:00Z', ran: true, due: false, printed: '' })
  assert.ok(Date.now() - reading < 3_000, 'it did not wait out its time')
  // A very long last line of error is cut.
  const loud = await tryCheck(process.cwd(), 'unused', now, async () => ({ ok: false, stdout: '', stderr: `first\n${'e'.repeat(2000)}\n` }))
  assert.equal(loud.error, `${'e'.repeat(500)}…`)
})
