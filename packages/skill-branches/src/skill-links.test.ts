import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { mkdtemp, readFile, realpath, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { nodeGitRunner } from './git.js'
import { createCheckout } from './checkout.js'
import { HARNESS_SKILL_DIRS, linkSkill, SKILL_DIR, SKILL_NAME } from './skill-links.js'

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
