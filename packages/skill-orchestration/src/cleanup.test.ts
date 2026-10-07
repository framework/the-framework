import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cleanup } from './cleanup.js'
import { runCli } from './cli.js'
import { SETTINGS_DIR, SETTINGS_FILE, writeSettings } from './settings.js'
import { git, removeRepo, testRepo } from './test-repo.js'

// `cleanup` on a real repository with a real remote: the package's own file goes, and nothing
// else in the project or on the remote changes.

const exists = (path: string): Promise<boolean> => stat(path).then(() => true, () => false)
const excludeOf = (repo: string): Promise<string> => readFile(join(repo, '.git', 'info', 'exclude'), 'utf8').catch(() => '')

/** What a clean-up must leave as it found it: the remote's branches, every local branch, the working tree. */
async function outside(repo: string): Promise<string> {
  return [await git(['ls-remote', 'origin'], repo), await git(['for-each-ref', 'refs/heads'], repo), await git(['status', '--porcelain'], repo)].join('---\n')
}

test('the settings, their directory and the rule hiding it go; the project and the remote stay as they were', async () => {
  const repo = await testRepo()
  try {
    const before = await outside(repo)
    await writeSettings(repo, { atOnce: 2 })
    assert.match(await excludeOf(repo), /^\/\.orchestration$/m)

    assert.deepEqual(await cleanup(repo), { ok: true, removed: [SETTINGS_DIR], kept: [] })
    assert.equal(await exists(join(repo, SETTINGS_DIR)), false)
    assert.doesNotMatch(await excludeOf(repo), /orchestration/)
    assert.equal(await outside(repo), before)

    assert.deepEqual(await cleanup(repo), { ok: true, removed: [], kept: [] }, 'a second pass finds nothing')

    // A save that was killed between its write and its rename leaves its own file: it goes too.
    await writeSettings(repo, { atOnce: 2 })
    await writeFile(join(repo, SETTINGS_DIR, `${SETTINGS_FILE}.4242.0f8fad5b-d9cb-469f-a165-70867728950e`), '{}\n')
    assert.deepEqual(await cleanup(repo), { ok: true, removed: [SETTINGS_DIR], kept: [] })
  } finally {
    await removeRepo(repo)
  }
})

test('a file of the person\'s own in the directory stays with it, and with the rule hiding it', async () => {
  const repo = await testRepo()
  try {
    await writeSettings(repo, { atOnce: 2 })
    await writeFile(join(repo, SETTINGS_DIR, 'notes.txt'), 'mine\n')
    assert.deepEqual(await cleanup(repo), {
      ok: true,
      removed: [`${SETTINGS_DIR}/${SETTINGS_FILE}`],
      kept: [{ path: `${SETTINGS_DIR}/notes.txt`, reason: 'not made by orchestration' }],
    })
    assert.equal(await readFile(join(repo, SETTINGS_DIR, 'notes.txt'), 'utf8'), 'mine\n')
    assert.match(await excludeOf(repo), /^\/\.orchestration$/m)
  } finally {
    await removeRepo(repo)
  }
})

test('the command answers the JSON of what went', async () => {
  const repo = await testRepo()
  try {
    await writeSettings(repo, { atOnce: 2 })
    const out: string[] = []
    const err: string[] = []
    const code = await runCli(['cleanup'], { cwd: repo, env: {}, stdout: line => out.push(line), stderr: line => err.push(line) })
    assert.deepEqual({ code, out: JSON.parse(out.join('\n')), err: err.join('\n') }, { code: 0, out: { ok: true, removed: [SETTINGS_DIR], kept: [] }, err: '' })
  } finally {
    await removeRepo(repo)
  }
})
