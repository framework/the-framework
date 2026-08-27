import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { startBranchLinksPass } from './branch-links-pass.js'

test('the pass covers every registered project and a stopped pass does nothing', async () => {
  const seen: string[] = []
  const pass = startBranchLinksPass({
    projects: async () => [{ path: '/a' }, { path: '/b' }],
    reconcile: async cwd => void seen.push(cwd),
  })
  await pass.tick()
  assert.deepEqual(seen, ['/a', '/b'])
  pass.stop()
  await pass.tick()
  assert.equal(seen.length, 2)
})
