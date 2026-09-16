import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { commandPrompt, isDue, parseSchedule } from './schedule.js'

test('a schedule line names a command, its check and its cap; prose and headings are not read', () => {
  const schedule = parseSchedule(`# Agent schedule

Some words a person wrote.

- work-queue: when \`npx queue\`, cap 2
- update-tickets: when \`npx tickets due\`
`)
  assert.deepEqual(schedule.commands, [
    { name: 'work-queue', when: 'npx queue', cap: 2, line: 5 },
    { name: 'update-tickets', when: 'npx tickets due', cap: 1, line: 6 },
  ])
  assert.deepEqual(schedule.unreadable, [])
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
