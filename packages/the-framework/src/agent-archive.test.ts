import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import type { GitRunner } from './project.js'
import type { StoreFs } from './store/index.js'
import {
  userDirName,
  agentArchiveDir,
  ensureArchiveIgnored,
  resolveUserDir,
  forgetUserDirs,
  ANONYMOUS_USER_DIR,
} from './agent-archive.js'
import { frameworkGitignore, archiveGitignore } from './framework-gitignore.js'
import { ARCHIVE_PATHSPEC } from './agent-commit.js'

/** A minimal in-memory {@link StoreFs}: this module only reads and writes one file. */
function memFs(seed: Record<string, string> = {}): StoreFs & { files: Map<string, string> } {
  const files = new Map<string, string>(Object.entries(seed))
  return {
    files,
    async read(path) {
      const value = files.get(path)
      if (value === undefined) throw new Error(`ENOENT: ${path}`)
      return value
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
    async mkdir() {},
    async readdir() {
      return []
    },
  }
}

const IGNORE = join('/repo', '.the-framework', '.gitignore')

test('an email becomes its own directory name (#1179)', () => {
  assert.equal(userDirName('git@brillout.com'), 'git@brillout.com')
  assert.equal(userDirName('  Git@Brillout.COM  '), 'git@brillout.com', 'trimmed and lowercased')
})

test('a name that could climb out of the directory is refused (#1179)', () => {
  // The value comes from repo configuration and is joined onto a path, so this is the one property
  // that has to hold: the result can never be `.`, `..`, or anything that starts with a dot.
  for (const hostile of ['..', '.', '../../etc/passwd', '.hidden', '/absolute', '..@evil.com']) {
    const dir = userDirName(hostile)
    assert.ok(!dir.startsWith('.'), `${hostile} -> ${dir} must not start with a dot`)
    assert.ok(!dir.includes('/'), `${hostile} -> ${dir} must not hold a separator`)
  }
  assert.equal(userDirName('..'), ANONYMOUS_USER_DIR)
  assert.equal(userDirName('/absolute'), ANONYMOUS_USER_DIR, 'a leading separator has nothing safe left')
})

test('no identity still gets a directory, rather than dropping the history (#1179)', () => {
  assert.equal(userDirName(undefined), ANONYMOUS_USER_DIR)
  assert.equal(userDirName(''), ANONYMOUS_USER_DIR)
  assert.equal(userDirName('   '), ANONYMOUS_USER_DIR)
  assert.equal(userDirName('a'.repeat(200)), ANONYMOUS_USER_DIR, 'an absurd length is not a directory name')
})

test('sessions live under the user, inside .the-framework (#1179)', () => {
  assert.equal(agentArchiveDir('/repo', 'git@brillout.com'), join('/repo', '.the-framework', 'git@brillout.com', 'agents'))
})

test('the ignore rules re-include every directory on the way down (#1179)', () => {
  // The seeded allow-list ignores everything with `*`, and git never descends into an ignored
  // directory — so un-ignoring only the files would never be reached. One name, the current one:
  // the `sessions/` D5 renamed away from is not re-included, because no repo carries one.
  const rules = archiveGitignore()
  assert.equal(rules, '!*/\n!*/agents/\n!*/agents/**\n')
})

test('a repo with no ignore file gets the whole file, transient state and all (#1179)', async () => {
  const fs = memFs()
  assert.equal(await ensureArchiveIgnored('/repo', 'me@example.com', fs), true)
  assert.equal(fs.files.get(IGNORE), frameworkGitignore())
})

test('a repo that predates the rules is repaired, once (#1179)', async () => {
  // Install writes the whole file, so this only fires for a repo activated before the archive
  // existed. Idempotent after that: the rule is already there, so nothing is written again.
  const fs = memFs({ [IGNORE]: '# The Framework\n*\n!.gitignore\n' })
  assert.equal(await ensureArchiveIgnored('/repo', 'me@example.com', fs), true)
  assert.equal(await ensureArchiveIgnored('/repo', 'me@example.com', fs), false, 'already there, so nothing written')
  const written = fs.files.get(IGNORE)!
  assert.equal(written.match(/!\*\/agents\/\*\*/g)?.length, 1)
})

test('a second user writes nothing: the rules already cover them (#1312)', async () => {
  // The whole point of the glob. Under the per-user form this was two writes to a tracked file,
  // one per person, each dirtying its own checkout.
  const fs = memFs()
  assert.equal(await ensureArchiveIgnored('/repo', 'a@example.com', fs), true)
  assert.equal(await ensureArchiveIgnored('/repo', 'b@example.com', fs), false, 'the glob already covers them')
  assert.ok(!fs.files.get(IGNORE)!.includes('@example.com'), 'no user is named')
})

test('a hand-edited file keeps every line it has (#1179)', async () => {
  // Repairing means adding what is missing, never rewriting what is there.
  const fs = memFs({ [IGNORE]: '# mine\n*\n!keep-me/\n' })
  assert.equal(await ensureArchiveIgnored('/repo', 'me@example.com', fs), true)
  const written = fs.files.get(IGNORE)!
  assert.ok(written.includes('# mine'), 'comments survive')
  assert.ok(written.includes('!keep-me/'), 'an unrelated rule survives')
  assert.ok(written.includes('!*/agents/**'), 'and the archive is un-ignored')
})

test('the identity comes from git, and is read once per repo (#1179)', async () => {
  forgetUserDirs()
  let calls = 0
  const git: GitRunner = async () => {
    calls++
    return 'git@brillout.com\n'
  }
  assert.equal(await resolveUserDir('/repo', git), 'git@brillout.com')
  assert.equal(await resolveUserDir('/repo', git), 'git@brillout.com')
  assert.equal(calls, 1, 'cached: this is read on every archive')
})

test('git with no identity configured falls back rather than throwing (#1179)', async () => {
  forgetUserDirs()
  const git: GitRunner = async () => {
    throw new Error('no user.email')
  }
  assert.equal(await resolveUserDir('/nowhere', git), ANONYMOUS_USER_DIR)
})

test('against real git: a committed session survives git clean -fdx, and nothing else leaks (#1179)', async () => {
  // The bug in one line, checked end to end. Real git because this turns on two behaviours a fake
  // filesystem cannot show: that git never descends into a directory its `*` rule already ignored
  // (so re-including the files alone would never be reached), and how `:(glob)` pathspecs match.
  const { mkdtemp, mkdir, writeFile, rm, readFile } = await import('node:fs/promises')
  const { existsSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { execFileSync } = await import('node:child_process')

  const repo = await mkdtemp(join(tmpdir(), 'fw-sessions-'))
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  try {
    git('init', '-q')
    git('config', 'user.email', 'git@example.com')
    git('config', 'user.name', 'Test')

    const fw = join(repo, '.the-framework')
    await mkdir(join(fw, 'git@example.com', 'agents'), { recursive: true })
    await mkdir(join(fw, 'agents'), { recursive: true })
    await mkdir(join(fw, 'branches', 'tf-agent-r9'), { recursive: true })
    await writeFile(join(fw, '.gitignore'), '# The Framework\n*\n!.gitignore\n')
    await writeFile(join(fw, 'git@example.com', 'agents', 'r1.json'), '{"id":"r1"}\n')
    await writeFile(join(fw, 'agents', 'old.json'), '{}\n')
    await writeFile(join(fw, 'events.jsonl'), '\n')
    await writeFile(join(fw, 'branches', 'tf-agent-r9', 'file.txt'), 'x\n')

    await ensureArchiveIgnored(repo, 'git@example.com')
    const status = git('status', '--porcelain', '-uall')
    assert.ok(status.includes('.the-framework/git@example.com/agents/r1.json'), 'the session is visible to git')
    assert.ok(!status.includes('.the-framework/agents/'), 'the transient archive stays ignored')
    assert.ok(!status.includes('.the-framework/events.jsonl'), 'the live log stays ignored')
    assert.ok(!status.includes('.the-framework/branches/'), 'a run checkout stays ignored')
    assert.ok((await readFile(join(fw, '.gitignore'), 'utf8')).includes('# The Framework'), 'the allow-list is kept')

    git('add', '--', ARCHIVE_PATHSPEC)
    git('commit', '-q', '-m', 'agents')
    git('clean', '-fdx')
    assert.ok(existsSync(join(fw, 'git@example.com', 'agents', 'r1.json')), 'the session survives the clean')
    assert.ok(!existsSync(join(fw, 'agents', 'old.json')), 'and the transient state is still swept, as before')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
