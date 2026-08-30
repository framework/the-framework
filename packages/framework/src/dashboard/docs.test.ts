import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, realpath, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readDocs, DOC_CATEGORIES } from './docs.js'
import { withFileBranch } from '@gemstack/skill-branches'
import { TICKETS_BRANCH } from '@gemstack/skill-tickets'
import { nodeGitRunner } from '@gemstack/skill-branches'
/** A real repo whose queue lives on the tickets branch (#1582/#1748), the way readDocs reads it. */
async function repoWithQueue(md: string): Promise<string> {
  const git = nodeGitRunner()
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'framework-docs-repo-')))
  await git(['init', '-b', 'main'], repo)
  await git(['config', 'user.email', 't@t'], repo)
  await git(['config', 'user.name', 't'], repo)
  await writeFile(join(repo, 'README.md'), '# t\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-m', 'init'], repo)
  const seeded = await withFileBranch(repo, TICKETS_BRANCH, 'seed', async dir => {
    await writeFile(join(dir, 'TODO_AGENTS.md'), md, 'utf8')
  })
  assert.ok(seeded.ok)
  return repo
}

test('readDocs returns the surfaced docs, PLAN before the data-branch backlog (#319/#1582)', async () => {
  const cwd = await repoWithQueue('- [ ] later\n')
  try {
    await writeFile(join(cwd, 'PLAN.md'), '# Plan\n')
    const docs = await readDocs(cwd)
    assert.deepEqual(docs.map(d => d.name), ['PLAN.md', 'TODO_AGENTS.md'])
    assert.equal(docs[0]!.content, '# Plan\n')
    assert.equal(docs[1]!.content, '- [ ] later\n')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('readDocs surfaces session-scoped PLAN_/TODO_ .agent.md files (#323/#326)', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-docs-'))
  try {
    await writeFile(join(cwd, 'TODO_my-branch.agent.md'), '- [ ] later\n')
    await writeFile(join(cwd, 'PLAN_my-branch.agent.md'), '# Plan\n')
    // A flat file coexists as a fallback and sorts before the scoped one in its group.
    await writeFile(join(cwd, 'PLAN.md'), '# Flat plan\n')
    // An unrelated .md is not surfaced.
    await writeFile(join(cwd, 'README.md'), '# Readme\n')
    const docs = await readDocs(cwd)
    assert.deepEqual(docs.map(d => d.name), ['PLAN.md', 'PLAN_my-branch.agent.md', 'TODO_my-branch.agent.md'])
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('readDocs reads the backlog off the data branch, never a checkout copy (#682/#1582)', async () => {
  const cwd = await repoWithQueue('- [ ] roadmap\n')
  try {
    // A leftover root copy must not shadow the branch: one queue, one location.
    await writeFile(join(cwd, 'TODO_AGENTS.md'), '- [ ] stale checkout copy\n')
    const docs = await readDocs(cwd)
    assert.deepEqual(docs.map(d => d.name), ['TODO_AGENTS.md'])
    assert.equal(docs[0]!.content, '- [ ] roadmap\n')
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('readDocs skips missing and blank docs, and never throws', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-docs-'))
  try {
    await writeFile(join(cwd, 'PLAN.md'), '   \n\n')
    // TODO.md absent; PLAN.md blank -> nothing surfaced.
    assert.deepEqual(await readDocs(cwd), [])
    // A workspace that does not exist reads as empty, not an error.
    assert.deepEqual(await readDocs(join(cwd, 'nope')), [])
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('DOC_CATEGORIES match fixed roots + slug-only scoped names (no traversal)', () => {
  for (const cat of DOC_CATEGORIES) {
    // Flat roots are bare filenames (the backlog defers to findFlatTodo, #682), never paths.
    assert.doesNotMatch(cat.flat, /[\\/]|\.\./)
    // The scoped pattern only admits a-z0-9- slugs, so no path separators slip in.
    assert.ok(!cat.scoped.test('PLAN_../evil.agent.md'))
    assert.ok(!cat.scoped.test('PLAN_a/b.agent.md'))
  }
  assert.ok(DOC_CATEGORIES[0]!.scoped.test('PLAN_my-branch.agent.md'))
  assert.ok(DOC_CATEGORIES[1]!.scoped.test('TODO_main-2.agent.md'))
})
