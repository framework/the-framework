import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import type { GitRunner } from '@gemstack/agent-data'
import { userDirName, resolveUserDir, forgetUserDirs, ANONYMOUS_USER_DIR } from './agent-archive.js'
import { frameworkGitignore } from './framework-gitignore.js'

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

test('against real git: everything under .the-framework is transient on main (#1582)', async () => {
  // The lasting records live on the data branch now, so the ignore file is "ignore it all" — a
  // session's live state, the transient archive, and the run checkouts must never dirty main.
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { execFileSync } = await import('node:child_process')

  const repo = await mkdtemp(join(tmpdir(), 'fw-sessions-'))
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  try {
    git('init', '-q')
    git('config', 'user.email', 'git@example.com')
    git('config', 'user.name', 'Test')

    const fw = join(repo, '.the-framework')
    await mkdir(join(fw, 'agents'), { recursive: true })
    await mkdir(join(fw, 'branches', 'agent-r9'), { recursive: true })
    await writeFile(join(fw, '.gitignore'), frameworkGitignore())
    await writeFile(join(fw, 'agents', 'old.json'), '{}\n')
    await writeFile(join(fw, 'events.jsonl'), '\n')
    await writeFile(join(fw, 'branches', 'agent-r9', 'file.txt'), 'x\n')

    const status = git('status', '--porcelain', '-uall')
    assert.ok(!status.includes('.the-framework/agents/'), 'the transient archive stays ignored')
    assert.ok(!status.includes('.the-framework/events.jsonl'), 'the live log stays ignored')
    assert.ok(!status.includes('.branches/'), 'a run checkout stays ignored')
    assert.ok(status.includes('.the-framework/.gitignore'), 'the ignore file itself is the one tracked thing')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
