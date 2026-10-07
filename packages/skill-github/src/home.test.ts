import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { homeUrlFromRemote, homeUrlFor } from './home.js'

test('the home URL from the common remote forms: scp, ssh, https, with a credential, a .git suffix, a trailing newline', () => {
  const expected = 'https://github.com/openagt/openagent'
  assert.equal(homeUrlFromRemote('git@github.com:openagt/openagent.git'), expected)
  assert.equal(homeUrlFromRemote('git@github.com:openagt/openagent'), expected)
  assert.equal(homeUrlFromRemote('ssh://git@github.com/openagt/openagent.git'), expected)
  assert.equal(homeUrlFromRemote('https://github.com/openagt/openagent.git'), expected)
  assert.equal(homeUrlFromRemote('https://github.com/openagt/openagent'), expected)
  assert.equal(homeUrlFromRemote('https://user@github.com/openagt/openagent.git\n'), expected)
})

test('no home URL for a remote that is not GitHub, or junk', () => {
  assert.equal(homeUrlFromRemote('git@gitlab.com:o/r.git'), undefined)
  assert.equal(homeUrlFromRemote('https://example.com/o/r.git'), undefined)
  assert.equal(homeUrlFromRemote('https://github.com/'), undefined)
  assert.equal(homeUrlFromRemote('https://github.com/only-owner'), undefined)
  assert.equal(homeUrlFromRemote(''), undefined)
})

test('the home URL is read off origin; no origin is no URL', async () => {
  assert.equal(await homeUrlFor('/x', async () => 'git@github.com:openagt/openagent.git\n'), 'https://github.com/openagt/openagent')
  assert.equal(
    await homeUrlFor('/x', async () => {
      throw new Error('no origin')
    }),
    undefined,
  )
})
