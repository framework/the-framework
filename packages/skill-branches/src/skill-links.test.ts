import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { mkdtemp, readFile, readlink, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { nodeGitRunner } from '@openagt/agent-data'
import { createCheckout, relinkCheckout } from './checkout.js'
import { COMMAND_LINKS } from './command-link.js'
import { HARNESS_SKILL_DIRS, linkSkill, SKILL_DIR, SKILL_NAME, skillLinkPaths } from './skill-links.js'

const git = nodeGitRunner()

async function repoWithOneCommit(): Promise<string> {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'skill-links-')))
  await git(['init', '-q', '-b', 'main'], repo)
  await writeFile(join(repo, 'README.md'), 'hi\n')
  await git(['add', '-A'], repo)
  await git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'], repo)
  return repo
}

test('a checkout the package creates carries the skill where every harness looks, hidden from git (#1739)', async () => {
  const repo = await repoWithOneCommit()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a1' })
    for (const dir of HARNESS_SKILL_DIRS) {
      const link = join(path, dir, SKILL_NAME)
      assert.equal(await realpath(link), await realpath(SKILL_DIR), `${dir} links to the package`)
      // What the harness reads there is this package's skill, under the name it links as.
      assert.match(await readFile(join(link, 'SKILL.md'), 'utf8'), new RegExp(`^name: ${SKILL_NAME}$`, 'm'))
    }
    // The links are the package's state, not the agent's work: nothing to commit, nothing to leave clean.
    assert.equal((await git(['status', '--porcelain'], path)).trim(), '')
    // Linking again changes nothing, so a continued agent's checkout can be settled as often as needed.
    await linkSkill(repo, path)
    assert.equal(await realpath(join(path, HARNESS_SKILL_DIRS[0], SKILL_NAME)), await realpath(SKILL_DIR))
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('an entry already at a link path is left alone (#1739)', async () => {
  const repo = await repoWithOneCommit()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a2' })
    const link = join(path, HARNESS_SKILL_DIRS[0], SKILL_NAME)
    await unlink(link)
    await writeFile(link, 'mine\n')
    await linkSkill(repo, path)
    assert.equal(await readFile(link, 'utf8'), 'mine\n')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test('a caller-named skill is linked beside the package\'s own, under its own name (#1748)', async () => {
  const repo = await repoWithOneCommit()
  const other = await realpath(await mkdtemp(join(tmpdir(), 'other-skill-')))
  try {
    await writeFile(join(other, 'SKILL.md'), '---\nname: other\n---\n# Other\n')
    const { path } = await createCheckout(repo, { agentId: 'a2', skills: [{ name: 'other', dir: other }] })
    for (const dir of HARNESS_SKILL_DIRS) {
      assert.equal(await realpath(join(path, dir, 'other')), other, `${dir} links the other skill`)
      assert.equal(await realpath(join(path, dir, SKILL_NAME)), await realpath(SKILL_DIR), `${dir} still links this package`)
    }
    assert.equal((await git(['status', '--porcelain'], path)).trim(), '')
  } finally {
    await rm(repo, { recursive: true, force: true })
    await rm(other, { recursive: true, force: true })
  }
})

test('a caller-named skill that has a command gets its package and its command linked too, hidden from git', async () => {
  const repo = await repoWithOneCommit()
  const other = await realpath(await mkdtemp(join(tmpdir(), 'other-skill-')))
  try {
    await writeFile(join(other, 'SKILL.md'), '---\nname: other\n---\n# Other\n')
    await writeFile(join(other, 'package.json'), '{"name":"@acme/skill-other","version":"0.1.0"}\n')
    await writeFile(join(other, 'other-cli'), '#!/bin/sh\necho other ran\n', { mode: 0o755 })
    const skill = { name: 'other', dir: other, package: { name: '@acme/skill-other', dir: other, bins: { other: join(other, 'other-cli') } } }
    assert.deepEqual(skillLinkPaths(skill), ['.claude/skills/other', '.agents/skills/other', 'node_modules/.bin/other', 'node_modules/@acme/skill-other'])
    const { path } = await createCheckout(repo, { agentId: 'a3', skills: [skill] })
    for (const link of skillLinkPaths(skill)) assert.equal(await realpath(join(path, link)), link.endsWith('.bin/other') ? join(other, 'other-cli') : other, link)
    assert.equal((await git(['status', '--porcelain'], path)).trim(), '')
    const hidden = await readFile(join(repo, '.git', 'info', 'exclude'), 'utf8')
    for (const link of skillLinkPaths(skill)) assert.ok(hidden.split('\n').includes(`/${link}`), `/${link} is hidden`)
  } finally {
    await rm(repo, { recursive: true, force: true })
    await rm(other, { recursive: true, force: true })
  }
})

test('a checkout that stayed is brought to what a new one gets: links that are missing are made, links that are there are left', async () => {
  const repo = await repoWithOneCommit()
  const other = await realpath(await mkdtemp(join(tmpdir(), 'other-skill-')))
  try {
    await writeFile(join(other, 'SKILL.md'), '---\nname: other\n---\n# Other\n')
    // A checkout made before the caller had a skill to link, and before this package linked itself.
    const { path } = await createCheckout(repo, { agentId: 'a4' })
    await rm(join(path, 'node_modules'), { recursive: true, force: true })
    await unlink(join(path, HARNESS_SKILL_DIRS[1], SKILL_NAME))
    await relinkCheckout(repo, path, { skills: [{ name: 'other', dir: other }] })
    for (const dir of HARNESS_SKILL_DIRS) {
      assert.equal(await realpath(join(path, dir, SKILL_NAME)), await realpath(SKILL_DIR))
      assert.equal(await realpath(join(path, dir, 'other')), other)
    }
    for (const link of COMMAND_LINKS) assert.ok(await realpath(join(path, link)), `${link} is back`)
    assert.equal((await git(['status', '--porcelain'], path)).trim(), '')
  } finally {
    await rm(repo, { recursive: true, force: true })
    await rm(other, { recursive: true, force: true })
  }
})

test('a link of the package\'s that points at an install that is gone is made again; a relative link, the project\'s own, is left', async () => {
  const repo = await repoWithOneCommit()
  const gone = join(await realpath(tmpdir()), 'an-install-that-moved', 'skill')
  try {
    const { path } = await createCheckout(repo, { agentId: 'a5' })
    const ours = join(path, HARNESS_SKILL_DIRS[0], SKILL_NAME)
    const command = join(path, COMMAND_LINKS[0]!)
    for (const link of [ours, command]) {
      await unlink(link)
      await symlink(gone, link)
    }
    const theirs = join(path, HARNESS_SKILL_DIRS[1], SKILL_NAME)
    await unlink(theirs)
    await symlink('../nowhere', theirs)
    await relinkCheckout(repo, path)
    assert.equal(await realpath(ours), await realpath(SKILL_DIR))
    assert.ok(await realpath(command), 'the command link works again')
    assert.equal(await readlink(theirs), '../nowhere')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
