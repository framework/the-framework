import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lookupProvidedCommand, readProvidedCommand, runPackageCommand } from './provided-command.js'

// Which package provides a kind (#1774, #1820), against real files: a throwaway project whose
// package.json lists dependencies, each installed under node_modules with its own package.json.

const ECHO = `process.stdout.write(JSON.stringify(process.argv.slice(2)))`

/** A project listing `deps`; `framework` is the project's own `framework` key, when given. */
async function project(deps: Record<string, Record<string, unknown>>, framework?: Record<string, string>): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'provided-command-')))
  await writeFile(join(root, 'package.json'), JSON.stringify({ devDependencies: Object.fromEntries(Object.keys(deps).map(name => [name, '*'])), ...(framework ? { framework } : {}) }))
  for (const [name, manifest] of Object.entries(deps)) {
    const dir = join(root, 'node_modules', name)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name, ...manifest }))
    await writeFile(join(dir, 'cmd.cjs'), ECHO)
  }
  return root
}

test('one package declaring a kind provides it; a declaration naming no command of the package is none; nobody declaring is nothing, and no problem', async () => {
  const root = await project({
    plain: { bin: { plain: 'cmd.cjs' } },
    'wrong-bin': { bin: { a: 'cmd.cjs' }, framework: { runs: 'b' } },
    logs: { bin: { logs: 'cmd.cjs' }, framework: { runs: 'logs' } },
  })
  try {
    const found = await lookupProvidedCommand(root, 'runs')
    assert.equal(found.command?.package, 'logs')
    assert.equal(found.command?.name, 'logs')
    assert.equal(found.command?.bin, join(root, 'node_modules', 'logs', 'cmd.cjs'))
    assert.equal(found.problem, undefined)
    assert.deepEqual(await lookupProvidedCommand(root, 'tickets'), {}, 'another kind: nobody declares it, and that is no problem')
    assert.equal(await readProvidedCommand(root, 'tickets'), undefined)
    assert.deepEqual(await lookupProvidedCommand(join(root, 'nowhere'), 'runs'), {}, 'no package.json: nothing')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('two packages declaring a kind: the one the project names provides; none named is none, with the reason; a name that does not provide it is none, said', async () => {
  const two = { github: { bin: { github: 'cmd.cjs' }, framework: { forge: 'github' } }, gitlab: { bin: { gitlab: 'cmd.cjs' }, framework: { forge: 'gitlab' } } }
  const unnamed = await project(two)
  const named = await project(two, { forge: 'gitlab' })
  const wrong = await project(two, { forge: 'plain' })
  const wrongAlone = await project({ github: two.github }, { forge: 'plain' })
  try {
    const none = await lookupProvidedCommand(unnamed, 'forge')
    assert.equal(none.command, undefined, 'never the first in dependency order')
    assert.equal(none.problem, '2 packages provide forge: github, gitlab; name one under "framework" in package.json')
    assert.equal(await readProvidedCommand(unnamed, 'forge'), undefined)

    const picked = await lookupProvidedCommand(named, 'forge')
    assert.equal(picked.command?.package, 'gitlab')
    assert.equal(picked.problem, undefined)

    assert.deepEqual(await lookupProvidedCommand(wrong, 'forge'), { problem: 'package.json names plain for forge, which does not provide it; the providers are github, gitlab' })
    assert.deepEqual(await lookupProvidedCommand(wrongAlone, 'forge'), { problem: 'package.json names plain for forge, which does not provide it; the providers are github' }, 'a wrong name is wrong even with one provider')
  } finally {
    for (const root of [unnamed, named, wrong, wrongAlone]) await rm(root, { recursive: true, force: true })
  }
})

test('a package command runs with Node in the project and answers its JSON, its last stderr line, or that it printed none', async () => {
  const root = await project({ tool: { bin: { tool: 'cmd.cjs' }, framework: { thing: 'tool' } } })
  const dir = join(root, 'node_modules', 'tool')
  await writeFile(join(dir, 'fails.cjs'), `process.stderr.write('first\\nno such thing\\n'); process.exit(1)`)
  await writeFile(join(dir, 'text.cjs'), `process.stdout.write('hello')`)
  await writeFile(join(dir, 'cwd.cjs'), `process.stdout.write(JSON.stringify(process.cwd()))`)
  try {
    const command = (await readProvidedCommand(root, 'thing'))!
    assert.deepEqual(await runPackageCommand(root, command, ['list', '--all']), { ok: true, output: ['list', '--all'] })
    assert.deepEqual(await runPackageCommand(root, { name: 'tool', bin: join(dir, 'fails.cjs') }, []), { ok: false, error: 'no such thing' })
    assert.deepEqual(await runPackageCommand(root, { name: 'tool', bin: join(dir, 'text.cjs') }, []), { ok: false, error: 'tool printed no JSON' })
    assert.deepEqual(await runPackageCommand(root, { name: 'tool', bin: join(dir, 'cwd.cjs') }, []), { ok: true, output: await realpath(root) })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
