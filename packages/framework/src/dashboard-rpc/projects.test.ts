import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { addProject } from '../registry.js'
import { projectErrorStore } from '../project-errors.js'
import { provideTestContext } from './test-context.js'
import { onProjects, sendScheduleSwitch } from './projects.js'

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
    provideTestContext({ projectErrors: errors.list })

    const clean = await onProjects()
    assert.equal(clean.length, 1)
    assert.equal('errors' in clean[0]!, false, 'a healthy project has no errors field at all')

    errors.set(dir, 'data-sync', 'the data branch could not be pushed: permission denied')
    const [stranded] = await onProjects()
    assert.deepEqual(stranded?.errors, [
      { code: 'data-sync', message: 'the data branch could not be pushed: permission denied', since: '2026-08-20T10:00:00.000Z' },
    ])
  } finally {
    await restore()
  }
})

test("sendScheduleSwitch runs the project's switch line with the command and on or off; no line and an unknown project are said", async () => {
  const { dir, restore } = await registered()
  try {
    provideTestContext({})
    const [project] = await onProjects()
    assert.deepEqual(await sendScheduleSwitch(project!.id, 'post-merge-cleanup', true), { ok: false, error: 'this project has no switch hook in .the-framework/hooks.yml' })
    await mkdir(join(dir, '.the-framework'))
    await writeFile(join(dir, '.the-framework', 'hooks.yml'), `switch: 'printf "%s %s" "$COMMAND" "$SWITCH" > switched.txt'\n`)
    assert.deepEqual(await sendScheduleSwitch(project!.id, 'post-merge-cleanup', true), { ok: true })
    assert.equal(await readFile(join(dir, 'switched.txt'), 'utf8'), 'post-merge-cleanup on')
    assert.deepEqual(await sendScheduleSwitch('no-such-project', 'post-merge-cleanup', false), { ok: false, error: 'unknown project' })
  } finally {
    await restore()
  }
})
