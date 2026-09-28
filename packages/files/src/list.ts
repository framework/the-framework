import { nodeGitRunner, type GitRunner } from '@gemstack/agent-data'

/**
 * Every file git sees in the checkout at `cwd`, tracked and untracked, honoring .gitignore:
 * repo-relative, each once, sorted. `[]` when `cwd` is not a repository.
 */
export async function listFiles(cwd: string, git: GitRunner = nodeGitRunner()): Promise<string[]> {
  const out = await git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd).catch(() => '')
  const files = new Set<string>()
  for (const entry of out.split('\0')) {
    const trimmed = entry.trim()
    if (trimmed) files.add(trimmed)
  }
  return [...files].sort()
}
