import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { frameworkGitignore } from './framework-gitignore.js'

test('against real git: everything under .the-framework is transient on main (#1582)', async () => {
  // The lasting records live on the data branch, so the ignore file is "ignore it all" — a
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
