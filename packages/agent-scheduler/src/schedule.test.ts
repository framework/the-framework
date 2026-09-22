import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { commandPrompt, commandSkill, isDue, parseSchedule } from './schedule.js'

test('a schedule line names a command, its check and its cap; prose and headings are not read', () => {
  const schedule = parseSchedule(`# Agent schedule

Some words a person wrote.

- work-queue: when \`npx queue\`, cap 2
- update-tickets: when \`npx tickets due\`
`)
  assert.deepEqual(schedule.commands, [
    { name: 'work-queue', when: 'npx queue', cap: 2, on: true, line: 5 },
    { name: 'update-tickets', when: 'npx tickets due', cap: 1, on: true, line: 6 },
  ])
  assert.deepEqual(schedule.unreadable, [])
})

test('a line paces by time with `every`, alone or beside a check, the clauses in any order; a comma inside the check is the check\'s', () => {
  const schedule = parseSchedule(`- triage-quick: every 6h
- triage-consensual: every 7d, cap 2
- update-tickets: every 1h, when \`gh issue list --search "a, b"\`
- plan-tickets: cap 1, when \`npx tickets list\`, every 30m
`)
  assert.deepEqual(schedule.commands, [
    { name: 'triage-quick', every: { ms: 6 * 3_600_000, text: '6h' }, cap: 1, on: true, line: 1 },
    { name: 'triage-consensual', every: { ms: 7 * 86_400_000, text: '7d' }, cap: 2, on: true, line: 2 },
    { name: 'update-tickets', when: 'gh issue list --search "a, b"', every: { ms: 3_600_000, text: '1h' }, cap: 1, on: true, line: 3 },
    { name: 'plan-tickets', when: 'npx tickets list', every: { ms: 30 * 60_000, text: '30m' }, cap: 1, on: true, line: 4 },
  ])
  assert.deepEqual(schedule.unreadable, [])
})

test('an `every` the parser cannot read is unreadable: a unit it does not know, zero, a clause twice, a word it does not know', () => {
  const schedule = parseSchedule(`- a: every 2w
- b: every 0h
- c: every 1h, every 2h
- d: every 1h, always
- e: every day
`)
  assert.deepEqual(schedule.commands, [])
  assert.deepEqual(schedule.unreadable.map(u => u.line), [1, 2, 3, 4, 5])
})

test('a list line the parser cannot read is skipped and named with its line', () => {
  const schedule = parseSchedule(`- work-queue: when \`npx queue\`
- Work Queue: every day
- triage: cap 3
- plan: when npx plan
`)
  assert.deepEqual(schedule.commands.map(c => c.name), ['work-queue'])
  assert.deepEqual(schedule.unreadable.map(u => u.line), [2, 3, 4])
  assert.equal(schedule.unreadable[0]!.text, '- Work Queue: every day')
})

test('`off` lists a command that runs only where a machine switched it on; once only', () => {
  const schedule = parseSchedule(`- post-merge-cleanup: every 1d, off
- triage-quick: off, every 6h, cap 2
- a: every 1d, off, off
- b: off
`)
  assert.deepEqual(schedule.commands, [
    { name: 'post-merge-cleanup', every: { ms: 86_400_000, text: '1d' }, cap: 1, on: false, line: 1 },
    { name: 'triage-quick', every: { ms: 6 * 3_600_000, text: '6h' }, cap: 2, on: false, line: 2 },
  ])
  // Twice is a typo; `off` alone still says nothing about when.
  assert.deepEqual(schedule.unreadable.map(u => u.line), [3, 4])
})

test('a command may carry one word after its folder name, the argument the skill gets: the whole name is the command, the first word is the folder', () => {
  const schedule = parseSchedule(`- triage quick: every 6h
- triage consensual: every 7d, when \`npx tickets list\`, off
- triage quick wins: every 6h
- triage  quick: every 6h
- triage quick : every 6h
`)
  assert.deepEqual(schedule.commands, [
    { name: 'triage quick', every: { ms: 6 * 3_600_000, text: '6h' }, cap: 1, on: true, line: 1 },
    { name: 'triage consensual', when: 'npx tickets list', every: { ms: 7 * 86_400_000, text: '7d' }, cap: 1, on: false, line: 2 },
  ])
  // Two words after the folder, two spaces, or a space before the colon: not a command a person types.
  assert.deepEqual(schedule.unreadable.map(u => u.line), [3, 4, 5])
  assert.equal(commandPrompt('triage quick'), '/triage quick')
  assert.equal(commandSkill('triage quick'), 'triage')
  assert.equal(commandSkill('work-queue'), 'work-queue')
})

test('a cap of zero reads as one: zero would spell "never", which is the line being absent', () => {
  assert.equal(parseSchedule('- work-queue: when `npx queue`, cap 0')!.commands[0]!.cap, 1)
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
