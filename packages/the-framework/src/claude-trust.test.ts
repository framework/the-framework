import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readClaudeTrust } from './claude-trust.js'

async function configFile(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'claude-trust-'))
  const path = join(dir, 'claude.json')
  await writeFile(path, content, 'utf8')
  return path
}

test('a trusted root reads as trusted, an asked-but-declined one as untrusted (#1318)', async () => {
  const path = await configFile(
    JSON.stringify({
      projects: {
        '/repo/trusted': { hasTrustDialogAccepted: true },
        '/repo/declined': { hasTrustDialogAccepted: false },
      },
    }),
  )
  assert.deepEqual(await readClaudeTrust('/repo/trusted', path), { known: true, trusted: true })
  assert.deepEqual(await readClaudeTrust('/repo/declined', path), { known: true, trusted: false })
})

test('a root the CLI has never seen is known-untrusted, not unknown (#1318)', async () => {
  // The distinction matters: "no entry" means the dialog will fire on the next start there,
  // which is exactly when the launcher should warn. Unknown is reserved for a file we could
  // not read or did not understand.
  const path = await configFile(JSON.stringify({ projects: {} }))
  assert.deepEqual(await readClaudeTrust('/repo/new', path), { known: true, trusted: false })
})

test('a missing, unparseable or reshaped config answers unknown (#1318)', async () => {
  assert.deepEqual(await readClaudeTrust('/repo', '/nowhere/claude.json'), { known: false, trusted: false })
  assert.deepEqual(await readClaudeTrust('/repo', await configFile('not json {')), { known: false, trusted: false })
  assert.deepEqual(await readClaudeTrust('/repo', await configFile('{"projects": []}')), { known: false, trusted: false })
  assert.deepEqual(await readClaudeTrust('/repo', await configFile('"just a string"')), { known: false, trusted: false })
})
