import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { WebContainerRunner, webContainerAvailable } from './webcontainer.js'
import { RunnerError } from './types.js'

// These run in plain Node (no browser), so they cover the capability guard and
// the Node-side contract. The real boot-and-serve is proven by the browser
// harness under `harness/webcontainer/` (see its README).

describe('webContainerAvailable', () => {
  it('is false in a non-isolated (Node) context', () => {
    assert.equal(webContainerAvailable(), false)
  })
})

describe('WebContainerRunner', () => {
  it('identifies its kind', () => {
    assert.equal(new WebContainerRunner().kind, 'webcontainer')
  })

  it('constructs without importing @webcontainer/api (browser-only dep stays lazy)', () => {
    // No throw here means the module loaded without eagerly requiring the browser dep.
    assert.doesNotThrow(() => new WebContainerRunner({ coep: 'credentialless', preview: false }))
  })

  it('boot() rejects with a clear error when not cross-origin isolated', async () => {
    await assert.rejects(() => new WebContainerRunner().boot(), (err: unknown) => {
      assert.ok(err instanceof RunnerError)
      assert.match((err as Error).message, /cross-origin isolated/)
      return true
    })
  })
})
