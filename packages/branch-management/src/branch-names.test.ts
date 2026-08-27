import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agentBranchName, isNamedRunBranch, isRunBranch, isWorktreeDirName, sessionNameOf } from './branch-names.js'

test('sessionNameOf reads the session name off a named agent branch (#1725)', () => {
  assert.equal(sessionNameOf('tf-add-comments'), 'add-comments')
  // A suffixed name is the name the agent was told it got.
  assert.equal(sessionNameOf('tf-add-comments-2'), 'add-comments-2')
})

test('sessionNameOf: the birth branch, the data branch and a user branch carry no name (#1725)', () => {
  assert.equal(sessionNameOf(agentBranchName('r1')), undefined)
  assert.equal(sessionNameOf('tf-data'), undefined)
  assert.equal(sessionNameOf('main'), undefined)
  assert.equal(sessionNameOf('feat/mine'), undefined)
  assert.equal(sessionNameOf(undefined), undefined)
})

test('the birth branch is a run branch and a checkout directory name; only a named run branch carries a name', () => {
  assert.equal(isRunBranch(agentBranchName('r1')), true)
  assert.equal(isWorktreeDirName(agentBranchName('r1')), true)
  assert.equal(isRunBranch('tf-add-comments'), true)
  assert.equal(isWorktreeDirName('tf-add-comments'), false)
  assert.equal(isRunBranch('tf-data'), false)
  assert.equal(isNamedRunBranch('tf-add-comments'), true)
  assert.equal(isNamedRunBranch(agentBranchName('r1')), false)
  assert.equal(isNamedRunBranch('tf-data'), false)
  assert.equal(isNamedRunBranch('main'), false)
})
