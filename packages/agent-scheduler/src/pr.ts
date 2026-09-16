/** A `gh` runner: stdout of one invocation, rejects on failure. */
export type GhRunner = (args: string[], cwd: string) => Promise<string>

/** `gh` on PATH, sixty seconds per call. */
export function nodeGhRunner(): GhRunner {
  return async (args, cwd) => {
    const { execFile } = await import('node:child_process')
    return new Promise<string>((resolve, reject) => {
      execFile('gh', args, { cwd, timeout: 60_000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(String(stderr).trim() || err.message))
        else resolve(String(stdout))
      })
    })
  }
}

/**
 * The pull request a branch has, newest first, or `undefined` when it has none or gh cannot tell.
 * The agent opens its own pull request; the run reads the number back for the record.
 */
export async function prOfBranch(repo: string, branch: string, gh: GhRunner = nodeGhRunner()): Promise<{ number: number; url: string } | undefined> {
  try {
    const out = await gh(['pr', 'list', '--head', branch, '--state', 'all', '--limit', '1', '--json', 'number,url'], repo)
    const list = JSON.parse(out) as { number?: unknown; url?: unknown }[]
    const first = list[0]
    return first && typeof first.number === 'number' && typeof first.url === 'string' ? { number: first.number, url: first.url } : undefined
  } catch {
    return undefined
  }
}
