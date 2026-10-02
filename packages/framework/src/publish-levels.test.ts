import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { offeredPublishPicks, publishLevelOf, publishPickIn } from './publish-levels.js'

test('a project with a git host is offered every pick; one without is offered Nothing and Publish branch', () => {
  assert.deepEqual(offeredPublishPicks(true), ['nothing', 'branch', 'pr', 'merge'])
  assert.deepEqual(offeredPublishPicks(false), ['nothing', 'branch'])
})

test('the pick in force: Nothing until one is saved; a pull request pick is Publish branch where there is no git host', () => {
  assert.equal(publishPickIn(undefined, true), 'nothing')
  assert.equal(publishPickIn('merge', true), 'merge')
  assert.equal(publishPickIn('pr', false), 'branch')
  assert.equal(publishPickIn('merge', false), 'branch')
  assert.equal(publishPickIn('branch', false), 'branch')
  assert.equal(publishPickIn('nothing', false), 'nothing')
})

test('Nothing hands the start hook no level; every other pick is its own level', () => {
  assert.equal(publishLevelOf('nothing'), undefined)
  assert.equal(publishLevelOf('branch'), 'branch')
  assert.equal(publishLevelOf('pr'), 'pr')
  assert.equal(publishLevelOf('merge'), 'merge')
})
