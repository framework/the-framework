import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { installProject } from './install.js'
import { PRESETS, PRESET_DIR } from './presets.js'
import { frameworkGitignore, gitignorePath } from './framework-gitignore.js'
import { layoutMarker, layoutMarkerPath } from './layout.js'
import type { GitRunner } from '@superskill/branch-management'
import type { StoreFs } from './store/index.js'

/** An in-memory {@link StoreFs} so the install logic is tested without touching disk. */
function memFs(seed: Record<string, string> = {}): StoreFs & { files: Map<string, string> } {
  const files = new Map<string, string>(Object.entries(seed))
  return {
    files,
    async read(path) {
      const v = files.get(path)
      if (v === undefined) throw new Error(`ENOENT: ${path}`)
      return v
    },
    async write(path, contents) {
      files.set(path, contents)
    },
    async append(path, contents) {
      files.set(path, (files.get(path) ?? '') + contents)
    },
    async exists(path) {
      return files.has(path)
    },
    async mkdir() {
      // no-op: the memory fs has no directories
    },
    async readdir(dir) {
      const prefix = dir.endsWith('/') ? dir : dir + '/'
      const names = new Set<string>()
      for (const p of files.keys()) {
        if (!p.startsWith(prefix)) continue
        const rest = p.slice(prefix.length)
        if (!rest.includes('/')) names.add(rest)
      }
      return [...names]
    },
  }
}

/** A scriptable {@link GitRunner} that records every call's args. */
function fakeGit(script: (args: string[], cwd: string) => Promise<string> | string) {
  const calls: string[][] = []
  const git: GitRunner = async (args, cwd) => {
    calls.push(args)
    return script(args, cwd)
  }
  return { git, calls }
}

const CWD = '/proj'

test('installProject on a clean repo seeds the ignore file and makes exactly one install commit', async () => {
  const fs = memFs()
  const { git, calls } = fakeGit(args => (args[0] === 'rev-parse' ? 'true' : ''))

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: true })
  assert.equal(fs.files.get(gitignorePath(CWD)), frameworkGitignore())

  const commits = calls.filter(args => args[0] === 'commit')
  assert.deepEqual(commits, [['commit', '-m', '[The Framework] install The Framework']])
})

test('installProject materializes the quality presets so an on-before-mergeable filePath resolves (#326)', async () => {
  const fs = memFs()
  const { git } = fakeGit(args => (args[0] === 'rev-parse' ? 'true' : ''))
  await installProject(CWD, { git, fs })
  for (const [name, text] of Object.entries(PRESETS)) {
    assert.equal(fs.files.get(join(CWD, PRESET_DIR, `${name}.md`)), text, `missing ${name}`)
  }
})

test('installProject seeds .the-framework/.gitignore ignoring everything transient (#313/#1582)', async () => {
  const fs = memFs()
  const { git } = fakeGit(args => (args[0] === 'rev-parse' ? 'true' : ''))

  await installProject(CWD, { git, fs })
  const ignore = fs.files.get(gitignorePath(CWD)) ?? ''
  // Everything under .the-framework/ is transient on main: the lasting records live on the data
  // branch (#1582), so nothing is un-ignored except the file itself.
  assert.match(ignore, /^\*$/m)
  assert.match(ignore, /^!\.gitignore$/m)
  assert.doesNotMatch(ignore, /agents/)
  assert.doesNotMatch(ignore, /sessions/)
})

test('installProject records the layout marker, tracked, so a skewed build is refused (#1575)', async () => {
  const fs = memFs()
  const { git } = fakeGit(args => (args[0] === 'rev-parse' ? 'true' : ''))

  await installProject(CWD, { git, fs })
  assert.equal(fs.files.get(layoutMarkerPath(CWD)), layoutMarker())
  // The seeded ignore un-ignores it: `*` would otherwise keep the marker out of the install commit.
  assert.match(fs.files.get(gitignorePath(CWD)) ?? '', /^!LAYOUT$/m)
})

test('installProject on a dirty repo leaves the user’s changes alone and adds only its own directory (#1638)', async () => {
  const fs = memFs()
  const { git, calls } = fakeGit(args => {
    if (args[0] === 'rev-parse') return 'true'
    return args[0] === 'status' ? ' M file.ts\n' : ''
  })

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: true })

  assert.deepEqual(calls.filter(args => args[0] === 'commit').map(args => args[2]), ['[The Framework] install The Framework'])
  assert.deepEqual(calls.filter(args => args[0] === 'add'), [['add', '.the-framework']], 'never `add -A`: the user’s file.ts is theirs')
})

test('installProject on an already-activated repo is a no-op that never calls git', async () => {
  const fs = memFs({ [gitignorePath(CWD)]: frameworkGitignore() })
  const { git, calls } = fakeGit(() => '')

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: true, alreadyActivated: true })
  assert.deepEqual(calls, [])
})

test('installProject surfaces a git failure as { ok: false }, never throws', async () => {
  const fs = memFs()
  const { git } = fakeGit(args => {
    if (args[0] === 'rev-parse') return 'true'
    if (args[0] === 'commit') throw new Error('nothing to commit')
    return ''
  })

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: false, error: 'nothing to commit' })
})

test('installProject initializes a git repo when the folder is not one yet, then installs', async () => {
  const fs = memFs()
  // rev-parse fails on a non-repo folder; every other git call succeeds.
  const { git, calls } = fakeGit(args => {
    if (args[0] === 'rev-parse') throw new Error('not a git repository')
    return ''
  })

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: true, initialized: true })
  assert.ok(calls.some(args => args[0] === 'init'), 'ran git init')
  const commits = calls.filter(args => args[0] === 'commit').map(args => args[2])
  assert.deepEqual(commits, ['[The Framework] install The Framework'])
})
