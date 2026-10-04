import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addProject, listProjects } from '../registry.js'
import { PROJECT_HOOKS_FILE } from '../project-hooks.js'
import { THE_FRAMEWORK_DIR } from '../framework-dir.js'
import { projectErrorStore } from '../project-errors.js'
import { provideTestContext } from './test-context.js'
import { onCommands, onProjects } from './projects.js'

// Against the real registry, pointed at a temp $XDG_CONFIG_HOME so the user's own is never touched.
async function registered(): Promise<{ dir: string; restore: () => Promise<void> }> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'framework-projects-rpc-')))
  const previous = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = join(dir, 'cfg')
  await mkdir(process.env.XDG_CONFIG_HOME, { recursive: true })
  const project = join(dir, 'app')
  await mkdir(project)
  await addProject(project, new Date().toISOString())
  return {
    dir: project,
    restore: async () => {
      if (previous === undefined) delete process.env.XDG_CONFIG_HOME
      else process.env.XDG_CONFIG_HOME = previous
      await rm(dir, { recursive: true, force: true })
    },
  }
}

test('onProjects carries each project’s recorded errors, and nothing when there are none (#1500)', async () => {
  const { dir, restore } = await registered()
  try {
    const errors = projectErrorStore(() => new Date('2026-08-20T10:00:00.000Z'))
    provideTestContext({ projectErrors: errors.read })

    const clean = await onProjects()
    assert.equal(clean.length, 1)
    assert.equal('errors' in clean[0]!, false, 'a healthy project has no errors field at all')

    errors.set(dir, 'data-sync', 'the data branch could not be pushed: permission denied')
    const [stranded] = await onProjects()
    assert.deepEqual(stranded?.errors, [
      { code: 'data-sync', message: 'the data branch could not be pushed: permission denied', since: '2026-08-20T10:00:00.000Z' },
    ])

    assert.equal('localOnly' in stranded!, false, 'a project whose repository has a remote carries no note')
    errors.setLocalOnly(dir, true)
    assert.equal((await onProjects())[0]?.localOnly, true)
    errors.setLocalOnly(dir, false)
    assert.equal('localOnly' in (await onProjects())[0]!, false)
  } finally {
    await restore()
  }
})

// The launcher's "start from" chip is offered only where the pick would be obeyed: a real
// repository, its start line and its branches changed one step at a time.
test('onCommands names the two branches an agent can start from only when the start line passes BASE on, the repository has a remote and the folder is on a branch', async () => {
  const { dir, restore } = await registered()
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com' } })
  const hooks = (line: string) => writeFile(join(dir, PROJECT_HOOKS_FILE), `start: ${line}\n`)
  const TAKES = `agent-runner run --detach "$PROMPT" \${BASE:+--base "$BASE"}`
  try {
    provideTestContext()
    const id = (await listProjects())[0]!.id
    const startFrom = async () => (await onCommands(id))?.startFrom
    await mkdir(join(dir, THE_FRAMEWORK_DIR), { recursive: true })
    git('init', '-q', '-b', 'main')
    git('commit', '-q', '--allow-empty', '-m', 'first')
    git('checkout', '-q', '-b', 'my/work')
    await hooks(TAKES)
    assert.equal(await startFrom(), undefined, 'no remote: one place to start from, nothing to pick')

    git('remote', 'add', 'origin', 'https://example.com/x.git')
    git('update-ref', 'refs/remotes/origin/main', 'main')
    assert.deepEqual(await startFrom(), { main: 'main', local: 'my/work' })

    git('checkout', '-q', 'main')
    assert.deepEqual(await startFrom(), { main: 'main', local: 'main' }, 'on the default branch itself: the local one may hold commits that are not pushed')

    await hooks('agent-runner run --detach "$PROMPT" ${PUBLISH:+--publish "$PUBLISH"}')
    assert.equal(await startFrom(), undefined, 'a line that does not pass BASE on: a pick would do nothing')
    await hooks('./start.sh "$PROMPT" "$BASE"')
    assert.deepEqual(await startFrom(), { main: 'main', local: 'main' }, 'a person\'s own line that names $BASE takes the pick')
    await hooks('./start.sh "$PROMPT" "$BASELINE"')
    assert.equal(await startFrom(), undefined, 'another variable whose name begins the same is not BASE')

    await hooks(TAKES)
    git('checkout', '-q', '--detach')
    assert.equal(await startFrom(), undefined, 'the folder is on no branch')

    await rm(join(dir, PROJECT_HOOKS_FILE))
    git('checkout', '-q', 'main')
    assert.deepEqual(await onCommands(id), { commands: [], startHook: false, gitHost: false, remote: true })
    assert.equal(await onCommands('no-such-project'), null)
  } finally {
    await restore()
  }
})
