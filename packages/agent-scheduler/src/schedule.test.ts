import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commandPrompt, isDue, promptCommand, readSchedule, skillSchedule } from './schedule.js'

/** A skill file whose front matter ends with the lines given. */
function skill(name: string, frontMatter: string): string {
  return `---\nname: ${name}\ndescription: A job.\ndisable-model-invocation: true\n${frontMatter}---\n\nDo the job.\n`
}

test("a skill's schedule names its command, its check, what the check waits for and how many agents at once; a skill with no schedule has no command", () => {
  assert.deepEqual(skillSchedule('work-queue', skill('work-queue', 'schedule:\n  when: npx queue\n  waits-for: when the queue holds a task\n  agents: 2\n')), {
    commands: [{ name: 'work-queue', when: 'npx queue', waitsFor: 'when the queue holds a task', cap: 2 }],
    unreadable: [],
  })
  assert.deepEqual(skillSchedule('update-tickets', skill('update-tickets', 'schedule:\n  when: npx tickets due\n')).commands, [{ name: 'update-tickets', when: 'npx tickets due', cap: 1 }])
  assert.deepEqual(skillSchedule('tickets', skill('tickets', '')), { commands: [], unreadable: [] })
  assert.deepEqual(skillSchedule('notes', 'No front matter at all.\n'), { commands: [], unreadable: [] })
})

test('a row paces by time with `every`, alone or beside a check, the keys in any order; a check over several lines, with quotes and commas, is the check as written', () => {
  assert.deepEqual(skillSchedule('plan-tickets', skill('plan-tickets', 'schedule:\n  every: 6h\n')).commands, [{ name: 'plan-tickets', every: { ms: 6 * 3_600_000, text: '6h' }, cap: 1 }])
  assert.deepEqual(skillSchedule('plan-tickets', skill('plan-tickets', 'schedule:\n  agents: 1\n  when: npx tickets list\n  every: 30m\n')).commands, [
    { name: 'plan-tickets', when: 'npx tickets list', every: { ms: 30 * 60_000, text: '30m' }, cap: 1 },
  ])
  const check = `gh issue list --search "a, b: c" | jq '[.[] | select(.body | test("(?m)^Closes tickets/\\\\w"))]'`
  assert.deepEqual(skillSchedule('update-tickets', skill('update-tickets', `schedule:\n  every: 7d\n  when: |-\n    ${check}\n`)).commands, [
    { name: 'update-tickets', when: check, every: { ms: 7 * 86_400_000, text: '7d' }, cap: 1 },
  ])
})

test('a skill with several modes lists one row per mode, each with the word the skill gets: the whole name is the command', () => {
  const schedule = skillSchedule('triage', skill('triage', 'schedule:\n  - word: quick\n    every: 6h\n  - word: consensual\n    every: 7d\n    when: npx tickets list\n'))
  assert.deepEqual(schedule, {
    commands: [
      { name: 'triage quick', every: { ms: 6 * 3_600_000, text: '6h' }, cap: 1 },
      { name: 'triage consensual', when: 'npx tickets list', every: { ms: 7 * 86_400_000, text: '7d' }, cap: 1 },
    ],
    unreadable: [],
  })
  // One row with a word, and a list where one row has none: both read.
  assert.deepEqual(skillSchedule('triage', skill('triage', 'schedule:\n  word: quick\n  every: 6h\n')).commands.map(c => c.name), ['triage quick'])
  assert.deepEqual(skillSchedule('triage', skill('triage', 'schedule:\n  - every: 1d\n  - word: quick\n    every: 6h\n')).commands.map(c => c.name), ['triage', 'triage quick'])

  assert.equal(commandPrompt('triage quick'), '/triage quick')
  // A person's prompt is filed under the command it names, else under its first word.
  assert.equal(promptCommand('/triage quick', schedule), 'triage quick')
  assert.equal(promptCommand('/triage consensual', schedule), 'triage consensual')
  assert.equal(promptCommand('/triage', schedule), 'triage')
  assert.equal(promptCommand('/triage quick', { commands: [], unreadable: [] }), 'triage')
  assert.equal(promptCommand('/work-queue now', schedule), 'work-queue')
  assert.equal(promptCommand('Read the docs', schedule), 'Read')
  assert.equal(promptCommand('  /triage quick  ', schedule), 'triage quick')
})

test('a schedule the reader cannot read gives no command and says why, the row named when there are several', () => {
  const why = (frontMatter: string): unknown => skillSchedule('a', skill('a', frontMatter))
  const refused = (reason: string): unknown => ({ commands: [], unreadable: [{ skill: 'a', reason }] })
  assert.deepEqual(why('schedule:\n  every: 2w\n'), refused('every is a number above 0 and a unit, m, h or d (15m, 6h, 7d)'))
  assert.deepEqual(why('schedule:\n  every: 0h\n'), refused('every is a number above 0 and a unit, m, h or d (15m, 6h, 7d)'))
  assert.deepEqual(why('schedule:\n  every: 15\n'), refused('every is a number above 0 and a unit, m, h or d (15m, 6h, 7d)'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  always: true\n'), refused('unknown key always'))
  assert.deepEqual(why('schedule:\n  waits-for: when there is work\n'), refused('neither every nor when says when'))
  assert.deepEqual(why('schedule:\n  when: ""\n'), refused('when is a shell command line'))
  assert.deepEqual(why('schedule:\n  when: [npx, queue]\n'), refused('when is a shell command line'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  waits-for: |\n    one line\n    and another\n'), refused('waits-for is one line of text'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  agents: 0\n'), refused('agents is a whole number, 1 or more'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  agents: many\n'), refused('agents is a whole number, 1 or more'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  word: Quick Wins\n'), refused('word is one word of lower-case letters, digits and dashes'))
  assert.deepEqual(why('schedule: daily\n'), refused('a row is a list of keys'))
  assert.deepEqual(why('schedule: []\n'), refused('the schedule lists no row'))
  assert.deepEqual(why('schedule:\n'), refused('the schedule lists no row'))
  // One bad row stands the whole skill down, and the reason says which.
  assert.deepEqual(why('schedule:\n  - word: quick\n    every: 6h\n  - word: slow\n    evry: 7d\n'), refused('row 2: unknown key evry'))
  assert.deepEqual(why('schedule:\n  - word: quick\n    every: 6h\n  - word: quick\n    every: 7d\n'), refused('two rows are named a quick'))
  // A front matter that is no YAML at all: the skill is named, since its schedule cannot be known.
  assert.deepEqual(skillSchedule('a', '---\nname: a\nschedule: [\n---\nDo.\n'), refused('the front matter is not YAML'))
})

test('the schedule is read from both folders a coding agent reads skills from, each skill once, in name order; a linked skill folder is read like a plain one', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'scheduler-skills-'))
  const write = async (dir: string, name: string, frontMatter: string): Promise<void> => {
    await mkdir(join(repo, dir, name), { recursive: true })
    await writeFile(join(repo, dir, name, 'SKILL.md'), skill(name, frontMatter))
  }
  try {
    assert.deepEqual(await readSchedule(repo), { commands: [], unreadable: [] }, 'no skills folder, nothing scheduled')

    await write('.agents/skills', 'work-queue', 'schedule:\n  when: npx queue\n')
    await write('.agents/skills', 'update-tickets', 'schedule:\n  every: 15m\n')
    await write('.agents/skills', 'tickets', '')
    // Only in the second folder, and first by name: the order is the names', not the folders'.
    await write('.agents/skills', 'archive', 'schedule:\n  every: 2d\n')
    await write('.agents/skills', 'broken', 'schedule:\n  every: often\n')
    // In both folders with two texts: the first folder's copy decides, as with the coding agent.
    await write('.claude/skills', 'update-tickets', 'schedule:\n  every: 1h\n')
    // Linked from one folder into the other, the way a project shares one copy.
    await symlink(join('..', '..', '.agents', 'skills', 'work-queue'), join(repo, '.claude', 'skills', 'work-queue'))
    // Only in Claude Code's folder.
    await write('.claude/skills', 'plan-tickets', 'schedule:\n  every: 6h\n')
    // Not a skill: a folder with no SKILL.md, and a file.
    await mkdir(join(repo, '.claude', 'skills', 'empty'))
    await writeFile(join(repo, '.claude', 'skills', 'README.md'), 'schedule:\n  every: 1h\n')

    assert.deepEqual(await readSchedule(repo), {
      commands: [
        { name: 'archive', every: { ms: 2 * 86_400_000, text: '2d' }, cap: 1 },
        { name: 'plan-tickets', every: { ms: 6 * 3_600_000, text: '6h' }, cap: 1 },
        { name: 'update-tickets', every: { ms: 3_600_000, text: '1h' }, cap: 1 },
        { name: 'work-queue', when: 'npx queue', cap: 1 },
      ],
      unreadable: [{ skill: 'broken', reason: 'every is a number above 0 and a unit, m, h or d (15m, 6h, 7d)' }],
    })
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('due is a check whose JSON is not empty; a non-JSON answer is due by its text', () => {
  assert.equal(isDue('["- [x](tickets/a.md)"]'), true)
  assert.equal(isDue('[]'), false)
  assert.equal(isDue('{}'), false)
  assert.equal(isDue('{"open": 1}'), true)
  assert.equal(isDue('null'), false)
  assert.equal(isDue('false'), false)
  assert.equal(isDue('true'), true)
  assert.equal(isDue('""'), false)
  assert.equal(isDue(''), false)
  assert.equal(isDue('   \n'), false)
  assert.equal(isDue('three entries'), true)
})

test("a command's prompt is its slash command", () => {
  assert.equal(commandPrompt('work-queue'), '/work-queue')
})
