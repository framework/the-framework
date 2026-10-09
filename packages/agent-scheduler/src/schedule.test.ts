import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseInterval } from './pace.js'
import { checkFound, commandPrompt, FOUND_OPENING, isDue, lastRunValue, promptCommand, readSchedule, skillSchedule, FOUND_OPENING_OWN, ownAttached, skillText } from './schedule.js'
import { FOUND_MAX } from './names.js'

const CLAUDE = '.claude/skills'
const AGENTS = '.agents/skills'

/** What a skill file in Claude Code's folder schedules. */
const read = (name: string, md: string) => skillSchedule(name, md, CLAUDE)

/** A skill file whose front matter ends with the lines given. */
function skill(name: string, frontMatter: string): string {
  return `---\nname: ${name}\ndisable-model-invocation: true\n${frontMatter}---\n\nDo the job.\n`
}

test("a skill's schedule names its command, its check, what the check waits for and how many agents at once; a skill with no schedule has no command", () => {
  assert.deepEqual(read('work-queue', skill('work-queue', 'schedule:\n  when: npx queue\n  waits-for: when the queue holds a task\n  agents: 2\n')), {
    commands: [{ name: 'work-queue', when: 'npx queue', waitsFor: 'when the queue holds a task', cap: 2, dir: CLAUDE }],
    unreadable: [],
  })
  assert.deepEqual(read('update-tickets', skill('update-tickets', 'schedule:\n  when: npx tickets due\n')).commands, [{ name: 'update-tickets', when: 'npx tickets due', cap: 1, dir: CLAUDE }])
  // What the skill says it does goes with each of its commands; one that says nothing, or nothing a person can read, has none.
  assert.deepEqual(read('triage', skill('triage', 'description: "  Queue the ready tickets.  "\nschedule:\n  - word: quick\n    every: 6h\n  - word: consensual\n    every: 7d\n')).commands.map(c => [c.name, c.description]), [
    ['triage quick', 'Queue the ready tickets.'],
    ['triage consensual', 'Queue the ready tickets.'],
  ])
  assert.equal('description' in read('a', skill('a', 'description: [a, list]\nschedule:\n  every: 6h\n')).commands[0]!, false)
  assert.deepEqual(read('tickets', skill('tickets', '')), { commands: [], unreadable: [] })
  assert.deepEqual(read('notes', 'No front matter at all.\n'), { commands: [], unreadable: [] })
})

test('a row paces by time with `every`, alone or beside a check, the keys in any order; a check written as a block, with quotes and commas or over several lines, is the check as written', () => {
  assert.deepEqual(read('plan-tickets', skill('plan-tickets', 'schedule:\n  every: 6h\n')).commands, [{ name: 'plan-tickets', every: parseInterval('6h')!, cap: 1, dir: CLAUDE }])
  assert.deepEqual(read('plan-tickets', skill('plan-tickets', 'schedule:\n  agents: 1\n  when: npx tickets list\n  every: 30m\n')).commands, [
    { name: 'plan-tickets', when: 'npx tickets list', every: parseInterval('30m')!, cap: 1, dir: CLAUDE },
  ])
  const check = `gh issue list --search "a, b: c" | jq '[.[] | select(.body | test("(?m)^Closes tickets/\\\\w"))]'`
  assert.deepEqual(read('update-tickets', skill('update-tickets', `schedule:\n  every: 7d\n  when: |-\n    ${check}\n`)).commands, [
    { name: 'update-tickets', when: check, every: parseInterval('7d')!, cap: 1, dir: CLAUDE },
  ])
  // Several lines, a blank one after them, Windows line ends: the lines as written, nothing around them.
  assert.equal(read('a', skill('a', 'schedule:\n  when: |\n    one &&\n      two\n\n')).commands[0]!.when, 'one &&\n  two')
  assert.deepEqual(read('a', skill('a', 'schedule:\n  every: 6h\n  when: npx queue\n').replaceAll('\n', '\r\n')).commands, [{ name: 'a', when: 'npx queue', every: parseInterval('6h')!, cap: 1, dir: CLAUDE }])
})

test('a skill with several modes lists one row per mode, each with the word the skill gets: the whole name is the command', () => {
  const schedule = read('triage', skill('triage', 'schedule:\n  - word: quick\n    every: 6h\n  - word: consensual\n    every: 7d\n    when: npx tickets list\n'))
  assert.deepEqual(schedule, {
    commands: [
      { name: 'triage quick', every: parseInterval('6h')!, cap: 1, dir: CLAUDE },
      { name: 'triage consensual', when: 'npx tickets list', every: parseInterval('7d')!, cap: 1, dir: CLAUDE },
    ],
    unreadable: [],
  })
  // One row with a word, and a list where one row has none: both read.
  assert.deepEqual(read('triage', skill('triage', 'schedule:\n  word: quick\n  every: 6h\n')).commands.map(c => c.name), ['triage quick'])
  assert.deepEqual(read('triage', skill('triage', 'schedule:\n  - every: 1d\n  - word: quick\n    every: 6h\n')).commands.map(c => c.name), ['triage', 'triage quick'])

  assert.equal(commandPrompt({ name: 'triage quick' }), '/triage quick')
  // A person's prompt is filed under the scheduled command it names with a slash, else under the one its first word is; under none when it names none.
  assert.equal(promptCommand('/triage quick', schedule), 'triage quick')
  assert.equal(promptCommand('/triage consensual', schedule), 'triage consensual')
  assert.equal(promptCommand('  /triage quick  ', schedule), 'triage quick')
  assert.equal(promptCommand('/triage', schedule), undefined, 'the skill alone is no command when each of its rows has a word')
  assert.equal(promptCommand('/triage quick', { commands: [], unreadable: [] }), undefined)
  assert.equal(promptCommand('Read the docs', schedule), undefined)
  assert.equal(promptCommand('triage quick', schedule), undefined, 'no slash: no skill\'s command')
  const withQueue = { commands: [...schedule.commands, { name: 'work-queue', cap: 1, dir: '.claude/skills' }], unreadable: [] }
  assert.equal(promptCommand('/work-queue now', withQueue), 'work-queue')
})

test('a schedule the reader cannot read gives no command and says why, the row named when there are several', () => {
  const why = (frontMatter: string): unknown => read('a', skill('a', frontMatter))
  const refused = (reason: string): unknown => ({ commands: [], unreadable: [{ skill: 'a', reason }] })
  assert.deepEqual(why('schedule:\n  every: 2y\n'), refused('every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)'))
  assert.deepEqual(why('schedule:\n  every: 100000000d\n'), refused('every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)'))
  assert.deepEqual(why('schedule:\n  every: 0h\n'), refused('every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)'))
  assert.deepEqual(why('schedule:\n  every: 15\n'), refused('every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  always: true\n'), refused('unknown key always'))
  assert.deepEqual(why('schedule:\n  waits-for: when there is work\n'), refused('neither every nor when says when'))
  assert.deepEqual(why('schedule:\n  every: 1d\n  waits-for: when there is work\n'), refused('waits-for says what when waits for, and there is no when'))
  assert.deepEqual(why('schedule:\n  when: ""\n'), refused('when is a shell command line'))
  assert.deepEqual(why('schedule:\n  when: [npx, queue]\n'), refused('when is a shell command line'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  waits-for: |\n    one line\n    and another\n'), refused('waits-for is one line of text'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  agents: 0\n'), refused('agents is a whole number from 1 to 99'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  agents: many\n'), refused('agents is a whole number from 1 to 99'))
  assert.deepEqual(why('schedule:\n  every: 1h\n  agents: 100\n'), refused('agents is a whole number from 1 to 99'))
  assert.equal(read('a', skill('a', 'schedule:\n  every: 1h\n  agents: 99\n')).commands[0]!.cap, 99)
  assert.deepEqual(why('schedule:\n  every: 1h\n  word: Quick Wins\n'), refused('word is one word of lower-case letters, digits and dashes'))
  assert.deepEqual(why('schedule: daily\n'), refused('a row is a list of keys'))
  assert.deepEqual(why('schedule: []\n'), refused('the schedule lists no row'))
  assert.deepEqual(why('schedule:\n'), refused('the schedule lists no row'))
  // One bad row stands the whole skill down, and the reason says which.
  assert.deepEqual(why('schedule:\n  - word: quick\n    every: 6h\n  - word: slow\n    evry: 7d\n'), refused('row 2: unknown key evry'))
  assert.deepEqual(why('schedule:\n  - word: quick\n    every: 6h\n  - word: quick\n    every: 7d\n'), refused('two rows are named a quick'))
  // A front matter that is no YAML at all: the skill is named when it holds a `schedule`, and left alone when it holds none.
  assert.deepEqual(read('a', '---\nname: a\nschedule: [\n---\nDo.\n'), refused('the front matter is not YAML'))
  assert.deepEqual(read('a', '---\nname: a\ndescription: Use when: asked\n  schedule: later\n---\nDo.\n'), { commands: [], unreadable: [] })
})

test("the schedule is read from both folders a coding agent reads skills from, each skill once, from Claude Code's folder first, in name order; a linked skill folder is read like a plain one", async () => {
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
    // In both folders with two texts: the copy in Claude Code's folder decides.
    await write('.claude/skills', 'update-tickets', 'schedule:\n  every: 1h\n')
    // Linked from one folder into the other, the way a project shares one copy.
    await symlink(join('..', '..', '.agents', 'skills', 'work-queue'), join(repo, '.claude', 'skills', 'work-queue'))
    // Only in Claude Code's folder.
    await write('.claude/skills', 'plan-tickets', 'schedule:\n  every: 6h\n')
    // In Claude Code's folder with no SKILL.md, in the second with one: the second folder's is read.
    await mkdir(join(repo, '.claude', 'skills', 'tickets'))
    await write('.agents/skills', 'review', 'schedule:\n  every: 3d\n')
    await mkdir(join(repo, '.claude', 'skills', 'review'))
    // Not a skill: a folder with no SKILL.md, a file, and a folder whose name is no command a person types.
    await write('.claude/skills', 'Not A Skill', 'schedule:\n  every: 1h\n')
    await mkdir(join(repo, '.claude', 'skills', 'empty'))
    await writeFile(join(repo, '.claude', 'skills', 'README.md'), 'schedule:\n  every: 1h\n')

    assert.deepEqual(await readSchedule(repo), {
      commands: [
        { name: 'archive', every: parseInterval('2d')!, cap: 1, dir: AGENTS },
        { name: 'plan-tickets', every: parseInterval('6h')!, cap: 1, dir: CLAUDE },
        { name: 'review', every: parseInterval('3d')!, cap: 1, dir: AGENTS },
        { name: 'update-tickets', every: parseInterval('1h')!, cap: 1, dir: CLAUDE },
        { name: 'work-queue', when: 'npx queue', cap: 1, dir: CLAUDE },
      ],
      unreadable: [{ skill: 'broken', reason: 'every is a number from 1 to 9999 and a unit, m, h, d, w or mo (15m, 6h, 7d, 2w, 1mo)' }],
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

test("a command's prompt is its slash command; an automation kept on this machine has its name as its prompt, with no slash, and its text is handed over with it, before what its check printed", () => {
  assert.equal(commandPrompt({ name: 'work-queue' }), '/work-queue')
  const text = 'Answer each new comment below.\n\n- Be short.'
  const own = { name: 'answer-comments', text, cap: 1, dir: '.agent-scheduler/automations' }
  assert.equal(commandPrompt(own), 'answer-comments')
  assert.equal(ownAttached(text), text, 'started by its pace alone: its text, and nothing after it')
  assert.equal(ownAttached(text, { stdout: '\n[{"url":"u"}]\n', lastRun: '2026-10-09T10:00:00Z' }), `${text}\n\n${FOUND_OPENING_OWN}\n[{"url":"u"}]`)
  assert.equal(FOUND_OPENING_OWN, 'The scheduler starts this when its check prints something, and this time the check printed what is below. It says why this run started; what the work is, the text above says.')
  // A run is counted by its prompt, which is the name and nothing else: whatever the text says, and however it changes.
  const schedule = { commands: [{ name: 'work-queue', cap: 1, dir: '.claude/skills' }, own], unreadable: [] }
  assert.equal(promptCommand('answer-comments', schedule), 'answer-comments')
  assert.equal(promptCommand(' answer-comments\n', schedule), 'answer-comments')
  assert.equal(promptCommand('/work-queue', schedule), 'work-queue')
  // The text itself, a prompt that only starts with the name, and the name typed as a command are no runs of the automation.
  assert.equal(promptCommand(text, schedule), undefined)
  assert.equal(promptCommand('answer-comments is broken, fix it', schedule), undefined)
  assert.equal(promptCommand('/answer-comments', schedule), undefined)
  // And a skill's command typed with no slash is no run of the skill's.
  assert.equal(promptCommand('work-queue', schedule), undefined)
})

test('the text of a skill file is what follows its front matter, wherever the reader of the schedule ends it: a closing line with blanks after its dashes, Windows line ends, a rule of dashes further down; NUL characters are dropped', () => {
  assert.equal(skillText('---\nname: x\n---\n\nDo it.\n'), 'Do it.')
  assert.equal(skillText('---\nname: x\n--- \n\nPart one.\n\n---\n\nPart two.\n'), 'Part one.\n\n---\n\nPart two.')
  assert.equal(skillText('---\r\nname: x\r\n---\r\n\r\nDo it.\r\nTwice.\r\n'), 'Do it.\r\nTwice.')
  assert.equal(skillText('No front matter.\n'), 'No front matter.')
  assert.equal(skillText('---\nname: x\n---\nDo\0 it.'), 'Do it.')
  assert.equal(skillText('---\nname: x\n---'), '')
})

test("the automations a person keeps on this machine are read after the skills, in name order, each one file whose text is what a run is handed; one that cannot be listed is named with why, and one named like a skill of the project takes that skill's commands off the list too", async () => {
  const repo = await mkdtemp(join(tmpdir(), 'scheduler-own-'))
  try {
    const own = join(repo, '.agent-scheduler', 'automations')
    await mkdir(own, { recursive: true })
    for (const [name, front] of [['work-queue', 'schedule:\n  when: npx queue\n'], ['triage', 'schedule:\n  - word: quick\n    every: 6h\n  - word: consensual\n    every: 7d\n'], ['update-tickets', 'schedule:\n  every: 15m\n']] as const) {
      await mkdir(join(repo, '.claude', 'skills', name), { recursive: true })
      await writeFile(join(repo, '.claude', 'skills', name, 'SKILL.md'), skill(name, front))
    }
    await mkdir(join(repo, '.claude', 'skills', 'plan'), { recursive: true })
    await writeFile(join(repo, '.claude', 'skills', 'plan', 'SKILL.md'), '---\nname: plan\n---\nPlan.\n')
    const file = (name: string, front: string, text = 'Do the job.') => writeFile(join(own, `${name}.md`), `---\nname: ${name}\ndescription: "What it does."\ndisable-model-invocation: true\n${front}---\n\n${text}\n`)
    await file('watch-competitor', 'schedule:\n  every: 1h\n', '/look for threads.\n\n---\n- Tell me.')
    await file('answer-comments', 'schedule:\n  when: gh api comments\n  waits-for: when someone commented\n')
    // Named like a scheduled skill: neither it nor the skill's commands are listed, so the skill does not start on the automation's switch.
    await file('work-queue', 'schedule:\n  every: 1d\n')
    await file('triage', 'schedule:\n  every: 1d\n')
    // Named like a skill that schedules nothing: only the automation is left out.
    await file('plan', 'schedule:\n  every: 1d\n')
    await file('two-rows', 'schedule:\n  - every: 1d\n  - word: fast\n    every: 1h\n')
    await file('worded', 'schedule:\n  word: fast\n  every: 1h\n')
    await file('typo', 'schedule:\n  evry: 1h\n')
    await file('wordless', 'schedule:\n  every: 1h\n', ' ')
    await file('unscheduled', '')
    await file('endless', 'schedule:\n  every: 1h\n', 'x'.repeat(32_001))
    await file('longest', 'schedule:\n  every: 1h\n', 'x'.repeat(32_000))
    // Not an automation's file: another ending.
    await writeFile(join(own, 'notes.txt'), 'x')
    // Files that are there and cannot be listed are named too: a name no command has, a folder, a link that leads nowhere.
    await writeFile(join(own, 'Loud Name.md'), '---\nschedule:\n  every: 1h\n---\nx\n')
    await mkdir(join(own, 'a-folder.md'))
    await symlink('nowhere.md', join(own, 'dangling.md'))
    const schedule = await readSchedule(repo)
    assert.deepEqual(schedule.commands, [
      { name: 'update-tickets', every: { count: 15, unit: 'm', ms: 900_000, text: '15m' }, cap: 1, dir: '.claude/skills' },
      { name: 'answer-comments', when: 'gh api comments', waitsFor: 'when someone commented', cap: 1, dir: '.agent-scheduler/automations', description: 'What it does.', text: 'Do the job.' },
      { name: 'longest', every: { count: 1, unit: 'h', ms: 3_600_000, text: '1h' }, cap: 1, dir: '.agent-scheduler/automations', description: 'What it does.', text: 'x'.repeat(32_000) },
      { name: 'watch-competitor', every: { count: 1, unit: 'h', ms: 3_600_000, text: '1h' }, cap: 1, dir: '.agent-scheduler/automations', description: 'What it does.', text: '/look for threads.\n\n---\n- Tell me.' },
    ])
    assert.deepEqual(schedule.unreadable, [
      { skill: 'Loud Name', reason: 'its file is named with something other than lower-case letters, digits and dashes', own: true },
      { skill: 'a-folder', reason: 'its file cannot be read', own: true },
      { skill: 'dangling', reason: 'its file cannot be read', own: true },
      { skill: 'endless', reason: 'its text is 32001 characters, and 32000 is the most', own: true },
      { skill: 'plan', reason: 'a skill of the project has this name too: rename or remove .agent-scheduler/automations/plan.md, then switch on what you want', own: true },
      { skill: 'triage', reason: 'a skill of the project has this name too, so neither is listed: rename or remove .agent-scheduler/automations/triage.md, then switch on what you want', own: true },
      { skill: 'two-rows', reason: 'it has one row, with no word', own: true },
      { skill: 'typo', reason: 'unknown key evry', own: true },
      { skill: 'unscheduled', reason: 'it has no schedule', own: true },
      { skill: 'worded', reason: 'it has one row, with no word', own: true },
      { skill: 'wordless', reason: 'it has no text after its front matter', own: true },
      { skill: 'work-queue', reason: 'a skill of the project has this name too, so neither is listed: rename or remove .agent-scheduler/automations/work-queue.md, then switch on what you want', own: true },
    ])
    // The names two things have: this machine's picks under them are taken back.
    assert.deepEqual(schedule.clashes, ['plan', 'triage', 'work-queue'])
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

/** The time the check was given, which a cut output names. */
const SINCE = '2026-10-09T10:00:00Z'

test('what a run is handed of its check: the opening words, then what the check printed without its outer blank lines and without NUL characters', () => {
  assert.equal(checkFound('\n[{"number": 12}]\n', SINCE), `${FOUND_OPENING}\n[{"number": 12}]`)
  assert.equal(FOUND_OPENING, 'The scheduler starts this command when its check prints something, and this time the check printed what is below. It says why this run started; what the work is, the command says.')
  assert.equal(checkFound('a.md\0b.md\0', SINCE), `${FOUND_OPENING}\na.mdb.md`, 'a command-line argument can hold no NUL')
})

test('a long output is cut at the end of the last whole line that fits, mid-line when its first line alone is too long, and a last line says how much was printed', () => {
  assert.equal(checkFound('y'.repeat(FOUND_MAX), SINCE), `${FOUND_OPENING}\n${'y'.repeat(FOUND_MAX)}`, 'exactly the limit is whole')
  const oneLine = 'x'.repeat(FOUND_MAX + 500)
  assert.equal(checkFound(oneLine, SINCE), `${FOUND_OPENING}\n${'x'.repeat(FOUND_MAX)}\n(cut: the check printed ${FOUND_MAX + 500} characters, these are the first ${FOUND_MAX}; it asked what is new since ${SINCE})`)
  // Lines of eleven characters with their line end: the limit falls inside line 727, which is left out whole.
  const lines = Array.from({ length: 1000 }, (_, i) => `"t-${String(i).padStart(5, '0')}",`).join('\n')
  const handed = checkFound(lines, SINCE).split('\n')
  assert.equal(handed[0], FOUND_OPENING)
  assert.equal(handed.at(-2), '"t-00726",', 'the last line shown is a whole one')
  assert.equal(handed.at(-1), `(cut: the check printed ${lines.length} characters, these are the first 7996; it asked what is new since ${SINCE})`)
  // A line that ends exactly at the limit is whole, and is kept.
  const exact = `${'a'.repeat(3999)}\n${'b'.repeat(4000)}\n${'c'.repeat(50)}`
  assert.equal(checkFound(exact, SINCE), `${FOUND_OPENING}\n${'a'.repeat(3999)}\n${'b'.repeat(4000)}\n(cut: the check printed 8051 characters, these are the first ${FOUND_MAX}; it asked what is new since ${SINCE})`)
})

test('the time a check is given: UTC to the whole second, the fraction dropped and never rounded up', () => {
  assert.equal(lastRunValue('2026-10-09T10:00:00.000Z'), '2026-10-09T10:00:00Z')
  assert.equal(lastRunValue('2026-10-09T10:00:00.999Z'), '2026-10-09T10:00:00Z', 'a thing of that same second is found twice rather than never')
  assert.equal(lastRunValue('2026-10-09T13:00:00+03:00'), '2026-10-09T10:00:00Z')
})
