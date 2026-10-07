import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { FIRST_COMMIT_MESSAGE, installProject } from './install.js'
import { openagentGitignore, gitignorePath } from './openagent-gitignore.js'
import type { GitRunner } from '@openagt/agent-data'
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

/** A git that answers as a repository with commits does: inside a work tree, HEAD resolves. */
const inRepoWithCommits = (args: string[]): string => (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree' ? 'true' : '')

test('installProject on a repo with commits seeds the ignore file and commits nothing', async () => {
  const fs = memFs()
  const { git, calls } = fakeGit(inRepoWithCommits)

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: true })
  assert.equal(fs.files.get(gitignorePath(CWD)), openagentGitignore())

  assert.deepEqual(
    calls.map(args => args[0]),
    ['rev-parse', 'rev-parse'],
    'two questions and nothing else: no add, no commit, the branch is the person’s',
  )
})

test('installProject seeds .openagent/.gitignore ignoring everything, itself included (#313/#1582)', async () => {
  const fs = memFs()
  const { git } = fakeGit(inRepoWithCommits)

  await installProject(CWD, { git, fs })
  const ignore = fs.files.get(gitignorePath(CWD)) ?? ''
  // Everything under .openagent/ stays out of git: the lasting records live on the data branch
  // (#1582), and nothing is un-ignored, so the directory leaves no trace in the repository.
  const rules = ignore.split('\n').filter(line => line && !line.startsWith('#'))
  assert.deepEqual(rules, ['*'])
})

/** A real repository in a temporary folder, removed after `body`. */
async function withRealRepo(body: (repo: string, git: (...args: string[]) => string) => Promise<void>): Promise<void> {
  const { mkdtemp, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { execFileSync } = await import('node:child_process')
  const repo = await mkdtemp(join(tmpdir(), 'fw-install-'))
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  try {
    git('init', '-q')
    git('config', 'user.email', 'git@example.com')
    git('config', 'user.name', 'Test')
    await body(repo, git)
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
}

test('against real git: adding a project leaves the person’s repository as it was, their uncommitted and staged work included (#1638)', async () => {
  const { writeFile, readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  await withRealRepo(async (repo, git) => {
    await writeFile(join(repo, 'file.ts'), 'one\n')
    git('add', 'file.ts')
    git('commit', '-q', '-m', 'theirs')
    await writeFile(join(repo, 'file.ts'), 'two\n')
    await writeFile(join(repo, 'staged.ts'), 'new\n')
    git('add', 'staged.ts')
    const before = { log: git('log', '--format=%H %s'), status: git('status', '--porcelain', '-uall') }

    assert.deepEqual(await installProject(repo), { ok: true })

    assert.equal(await readFile(gitignorePath(repo), 'utf8'), openagentGitignore(), 'the ignore file is written')
    assert.equal(git('log', '--format=%H %s'), before.log, 'no commit on the person’s branch')
    assert.equal(git('status', '--porcelain', '-uall'), before.status, 'git shows no new file, and their changes are as they left them')
    assert.deepEqual(await installProject(repo), { ok: true, alreadyActivated: true })
  })
})

test('against real git: a repository with no commit gets an empty first one, and a file the person staged stays staged, uncommitted', async () => {
  const { writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  await withRealRepo(async (repo, git) => {
    await writeFile(join(repo, 'staged.ts'), 'new\n')
    await writeFile(join(repo, 'loose.ts'), 'new\n')
    git('add', 'staged.ts')

    assert.deepEqual(await installProject(repo), { ok: true })

    assert.equal(git('log', '--format=%s').trim(), FIRST_COMMIT_MESSAGE)
    assert.equal(git('ls-tree', '-r', '--name-only', 'HEAD'), '', 'the commit holds no file')
    assert.equal(git('status', '--porcelain', '-uall'), 'A  staged.ts\n?? loose.ts\n', 'their files are where they left them')
    // An agent's branch can start now.
    git('branch', 'agent-x')
  })
})

test('installProject on an already-activated repo is a no-op that never calls git', async () => {
  const fs = memFs({ [gitignorePath(CWD)]: openagentGitignore() })
  const { git, calls } = fakeGit(() => '')

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: true, alreadyActivated: true })
  assert.deepEqual(calls, [])
})

test('installProject surfaces a git failure as { ok: false }, never throws, and a first commit that fails leaves no marker, so the next add tries again', async () => {
  const fs = memFs()
  const { git } = fakeGit(args => {
    if (args[0] === 'rev-parse') throw new Error('no')
    if (args[0] === 'commit-tree') throw new Error('Author identity unknown')
    return ''
  })

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: false, error: 'Author identity unknown' })
  assert.equal(fs.files.has(gitignorePath(CWD)), false)
})

test('installProject initializes a git repo when the folder is not one yet, and gives it an empty first commit for agents to start from', async () => {
  const fs = memFs()
  // Both rev-parse questions fail on a non-repo folder; every other git call succeeds.
  const { git, calls } = fakeGit(args => {
    if (args[0] === 'rev-parse') throw new Error('not a git repository')
    return args[0] === 'commit-tree' ? 'abc123\n' : ''
  })

  assert.deepEqual(await installProject(CWD, { git, fs }), { ok: true, initialized: true })
  assert.deepEqual(
    calls.filter(args => args[0] !== 'rev-parse'),
    [['init'], ['commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', FIRST_COMMIT_MESSAGE], ['update-ref', 'HEAD', 'abc123']],
    'the commit is made from the empty tree, never from the index: nothing of the person’s is in it',
  )
})
