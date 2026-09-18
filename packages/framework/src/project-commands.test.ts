import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readProjectCommands } from './project-commands.js'

async function skill(cwd: string, dir: string, name: string, skillMd: string | undefined): Promise<void> {
  await mkdir(join(cwd, dir, name), { recursive: true })
  if (skillMd !== undefined) await writeFile(join(cwd, dir, name, 'SKILL.md'), skillMd)
}

test('a project\'s commands are its skills, from both folders, each once, by name; the front matter says what each is', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-commands-'))
  try {
    await skill(cwd, '.claude/skills', 'work-queue', '---\nname: work-queue\ndescription: Work the agent queue.\ndisable-model-invocation: true\n---\nDo it.\n')
    // The same skill in the shared folder is the same command.
    await skill(cwd, '.agents/skills', 'work-queue', '---\ndescription: another copy\n---\n')
    await skill(cwd, '.agents/skills', 'tickets', '---\nname: tickets\ndescription: "Where the tickets live."\n---\n# Tickets\n')
    // Not a command: Claude Code keeps it out of its `/` list too.
    await skill(cwd, '.claude/skills', 'ldd', '---\ndescription: internal\nuser-invocable: false\n---\n')
    // No front matter, and front matter that does not parse: still commands, with nothing to say about them.
    await skill(cwd, '.claude/skills', 'bare', 'Just words.\n')
    await skill(cwd, '.claude/skills', 'broken', '---\ndescription: [\n---\n')
    // A folder without a SKILL.md, and a name no slash command could have, are skipped.
    await skill(cwd, '.claude/skills', 'empty', undefined)
    await skill(cwd, '.claude/skills', 'Not A Command', '---\ndescription: x\n---\n')

    assert.deepEqual(await readProjectCommands(cwd), [
      { name: 'bare', button: false },
      { name: 'broken', button: false },
      { name: 'tickets', description: 'Where the tickets live.', button: false },
      { name: 'work-queue', description: 'Work the agent queue.', button: true },
    ])
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})

test('a project with no skills folder has no commands', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'framework-commands-'))
  try {
    assert.deepEqual(await readProjectCommands(cwd), [])
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
