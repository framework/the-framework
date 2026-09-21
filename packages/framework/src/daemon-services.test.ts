import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { checkProviders, syncProjectData } from './daemon-services.js'
import { projectErrorStore } from './project-errors.js'

const git = promisify(execFile)

/**
 * The data-sync error state (#1599/#1500): one project's sync turn sets the project's `data-sync`
 * error when the branch cannot converge with origin, and clears it the first time it does. Real
 * git, because the two outcomes are git's own: no remote at all, then a bare remote added.
 */
test('a project whose data branch cannot reach a remote carries a data-sync error until a sync converges (#1599)', async () => {
  const project = await mkdtemp(join(tmpdir(), 'framework-sync-proj-'))
  const remote = await mkdtemp(join(tmpdir(), 'framework-sync-remote-'))
  try {
    await git('git', ['init', '-q', '-b', 'main'], { cwd: project })
    await git('git', ['config', 'user.email', 'test@example.com'], { cwd: project })
    await git('git', ['config', 'user.name', 'Test'], { cwd: project })
    await git('git', ['config', 'commit.gpgsign', 'false'], { cwd: project })
    const errors = projectErrorStore()
    const logs: string[] = []

    // No remote: the branch is born locally, but nothing else can ever read it — an error, not a mode.
    await syncProjectData(project, errors, m => logs.push(m))
    const [noRemote] = errors.list(project)
    assert.equal(noRemote?.code, 'data-sync')
    assert.match(noRemote?.message ?? '', /no remote/)
    assert.ok(logs.some(m => m.includes('data sync') && m.includes('no remote')), 'still said on the daemon log too')

    // The user fixes it: the next turn converges and the error is gone, not merely re-worded.
    await git('git', ['init', '-q', '--bare'], { cwd: remote })
    await git('git', ['remote', 'add', 'origin', remote], { cwd: project })
    await syncProjectData(project, errors, () => {})
    assert.deepEqual(errors.list(project), [])
  } finally {
    await rm(project, { recursive: true, force: true })
    await rm(remote, { recursive: true, force: true })
  }
})

/**
 * The provider error (#1820): two packages declaring the same kind with no line in the project's
 * package.json is a state the user must fix, shown as the project's `provider` error; the line
 * clears it at the next turn.
 */
test('a project where two packages provide the same kind carries a provider error until its package.json names one (#1820)', async () => {
  const project = await mkdtemp(join(tmpdir(), 'framework-providers-'))
  try {
    const manifest = (framework?: Record<string, string>) => JSON.stringify({ devDependencies: { a: '*', b: '*' }, ...(framework ? { framework } : {}) })
    await writeFile(join(project, 'package.json'), manifest())
    for (const name of ['a', 'b']) {
      await mkdir(join(project, 'node_modules', name), { recursive: true })
      await writeFile(join(project, 'node_modules', name, 'package.json'), JSON.stringify({ name, bin: { [name]: 'cmd.cjs' }, framework: { tickets: name } }))
      await writeFile(join(project, 'node_modules', name, 'cmd.cjs'), '')
    }
    const errors = projectErrorStore()
    await checkProviders(project, errors)
    const [unsettled] = errors.list(project)
    assert.equal(unsettled?.code, 'provider')
    assert.equal(unsettled?.message, '2 packages provide tickets: a, b; name one under "framework" in package.json')

    await writeFile(join(project, 'package.json'), manifest({ tickets: 'b' }))
    await checkProviders(project, errors)
    assert.deepEqual(errors.list(project), [])
  } finally {
    await rm(project, { recursive: true, force: true })
  }
})
