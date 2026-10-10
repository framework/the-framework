import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { commitSkills, skillsOn, uncommittedSkills } from './branch.js'
import { applyChange, commitChange } from './change.js'
import { folder, gone, run } from './test-project.js'

test('a skill written into the folder is not on the branch until it is committed; then it is, by its text and by its link', async () => {
  const root = await folder(true)
  try {
    assert.deepEqual([...(await skillsOn(root, 'HEAD'))], [])
    const changed = await applyChange(root, { write: ['tickets', 'queue'] })
    assert.deepEqual([...(await skillsOn(root, 'HEAD'))], [], 'written, not committed')
    assert.equal(await uncommittedSkills(root), 4, 'two texts and two links')
    await commitChange(root, changed)
    assert.deepEqual([...(await skillsOn(root, 'HEAD'))].sort(), ['queue', 'tickets'])
    assert.equal(await uncommittedSkills(root), 0)

    // A project's own skill, held as a real folder where Claude Code reads, and one outside init's list.
    await mkdir(join(root, '.claude/skills/deploy'), { recursive: true })
    await writeFile(join(root, '.claude/skills/deploy/SKILL.md'), '---\nname: deploy\n---\nOurs.\n')
    await run(root, 'add', '-A')
    await run(root, 'commit', '-q', '-m', 'ours')
    assert.deepEqual([...(await skillsOn(root, 'HEAD'))].sort(), ['deploy', 'queue', 'tickets'])
    assert.deepEqual([...(await skillsOn(root, 'no-such-branch'))], [], 'a branch that is not there has none')
  } finally {
    await gone(root)
  }
})

test('the dashboard\'s commit takes every skill file that stands uncommitted, a deleted one too, and nothing else', async () => {
  const root = await folder(true)
  try {
    await commitChange(root, await applyChange(root, { write: ['tickets', 'ux'] }))
    await applyChange(root, { write: ['plan'], remove: ['ux'] })
    await writeFile(join(root, '.agents/skills/tickets/SKILL.md'), 'changed by hand\n')
    await writeFile(join(root, 'README.md'), '# edited\n')
    await writeFile(join(root, 'staged.txt'), 'theirs\n')
    await run(root, 'add', 'staged.txt')
    assert.equal(await uncommittedSkills(root), 5, 'plan\'s text and link, ux\'s text and link, tickets\' text')

    const committed = await commitSkills(root)
    assert.ok(committed.ok && committed.committed)
    assert.equal(await run(root, 'show', '--format=%s', '--name-status', 'HEAD'), 'Update OpenAgent skills\n\nA\t.agents/skills/plan/SKILL.md\nM\t.agents/skills/tickets/SKILL.md\nD\t.agents/skills/ux/SKILL.md\nA\t.claude/skills/plan\nD\t.claude/skills/ux\n')
    assert.equal(await run(root, 'status', '--porcelain'), ' M README.md\nA  staged.txt\n')
    assert.equal(await uncommittedSkills(root), 0)
    assert.deepEqual(await commitSkills(root), { ok: true, committed: false }, 'nothing left to commit')
    await rm(join(root, 'staged.txt'))
  } finally {
    await gone(root)
  }
})
