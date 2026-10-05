import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { nodeGitRunner } from '@openagt/agent-data'
import { CLI_BIN_DIR } from './bin-dir.js'
import { createCheckout } from './checkout.js'
import { linkOwnCommand } from './command-link.js'

const git = nodeGitRunner()
const run = promisify(execFile)

async function repoWithOneCommit(files: Record<string, string> = {}): Promise<string> {
  const repo = await realpath(await mkdtemp(join(tmpdir(), 'command-link-')))
  await git(['init', '-q', '-b', 'main'], repo)
  await writeFile(join(repo, 'README.md'), 'hi\n')
  for (const [name, text] of Object.entries(files)) await writeFile(join(repo, name), text)
  await git(['add', '-A'], repo)
  await git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init'], repo)
  return repo
}

test('a checkout in a project with nothing installed holds the command, hidden from git, and it is the one that runs', async () => {
  const repo = await repoWithOneCommit()
  try {
    const { path } = await createCheckout(repo, { agentId: 'a1' })
    const link = join(path, 'node_modules', '.bin', 'branches')
    assert.equal(await realpath(link), await realpath(join(CLI_BIN_DIR, 'branches')))
    assert.equal((await git(['status', '--porcelain'], path)).trim(), '', 'the link is not the agent\'s work: nothing to commit')
    // The command found in the checkout is this package's: it answers the checkout's own status.
    const { stdout } = await run(link, ['status'], { cwd: path })
    assert.equal(JSON.parse(stdout).path, path)
    // Linking again changes nothing.
    await linkOwnCommand(repo, path)
    assert.equal(await realpath(link), await realpath(join(CLI_BIN_DIR, 'branches')))
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})

test("a project that installed its own copy keeps it: the checkout's command is the project's", async () => {
  const repo = await repoWithOneCommit({ '.gitignore': 'node_modules/\n' })
  try {
    await mkdir(join(repo, 'node_modules', '.bin'), { recursive: true })
    await writeFile(join(repo, 'node_modules', '.bin', 'branches'), '#!/bin/sh\necho own\n', { mode: 0o755 })
    const { path } = await createCheckout(repo, { agentId: 'a2' })
    const { stdout } = await run(join(path, 'node_modules', '.bin', 'branches'), [], { cwd: path })
    assert.equal(stdout.trim(), 'own')
  } finally {
    await rm(repo, { recursive: true, force: true })
  }
})
