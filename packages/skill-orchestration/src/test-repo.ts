import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DATA_BRANCH, nodeGitRunner, writeSharing } from '@openagt/agent-data'

/**
 * A project for the tests: one commit on `main`, a bare `origin`, the `agent-data` branch born
 * on origin. Real git, because the run records and the checkouts are git.
 */

export const git = nodeGitRunner()

export async function testRepo(): Promise<string> {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'skill-orchestration-')))
  const repo = join(base, 'repo')
  const origin = join(base, 'origin.git')
  await mkdir(repo)
  await git(['init', '-q', '-b', 'main'], repo)
  await git(['config', 'user.email', 'tester@example.com'], repo)
  await git(['config', 'user.name', 'tester'], repo)
  await writeFile(join(repo, 'README.md'), '# t\n')
  await git(['add', '-A'], repo)
  await git(['commit', '-q', '-m', 'init'], repo)
  await git(['init', '-q', '--bare', origin], base)
  await git(['remote', 'add', 'origin', origin], repo)
  await git(['push', '-q', '-u', 'origin', 'main'], repo)
  // The data branch, parentless, as the skills make it.
  const tree = (await git(['hash-object', '-t', 'tree', '/dev/null'], repo)).trim()
  const commit = (await git(['commit-tree', tree, '-m', `create the ${DATA_BRANCH} branch`], repo)).trim()
  await git(['push', '-q', 'origin', `${commit}:refs/heads/${DATA_BRANCH}`], repo)
  await git(['fetch', '-q', 'origin'], repo)
  // A project that shares its records with origin: the person's yes, given once per clone.
  await writeSharing(repo, true)
  return repo
}

/** The repository and its origin go together. */
export async function removeRepo(repo: string): Promise<void> {
  await rm(dirname(repo), { recursive: true, force: true, maxRetries: 10 })
}
