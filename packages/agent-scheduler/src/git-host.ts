import { readProvidedCommand, runPackageCommand } from '@gemstack/agent-data'

/**
 * The project's git host (#1820), reached by declaration: whichever of the project's packages
 * declares `"framework": { "git-host": "<command>" }` answers the pull requests, and this tool runs
 * that command the way the dashboard runs any provided command. The tool names no git host and no
 * package: a project with none has no pull requests to read back and nothing to merge.
 *
 * Two questions this tool asks of it: which pull request a branch has, for the run's record, and
 * the merge of one, once a follow-up is done (`run.ts`).
 */

/** The pull request a branch has, as the record keeps it. */
export interface BranchRequest {
  number: number
  url: string
}

/** How merging a pull request went: armed on green, merged at once, watched by the git host package, or not at all. */
export type MergeOutcome = { outcome: 'auto-armed' | 'merged' | 'watching' } | { outcome: 'failed'; error: string }

/** What a run asks of the git host; a test may hand in its own. */
export interface GitHost {
  /** The newest pull request whose head is `branch`, open or closed; none when there is none, no git host, or the git host could not tell. */
  requestOfBranch(repo: string, branch: string): Promise<BranchRequest | undefined>
  /** Land pull request `number`: armed to merge on green, or merged at once. */
  mergeRequest(repo: string, number: number): Promise<MergeOutcome>
}

const NO_GIT_HOST = 'this project has no git host package'

/** The git host the project declares, run as a command. */
export const projectGitHost: GitHost = {
  async requestOfBranch(repo, branch) {
    const command = await readProvidedCommand(repo, 'git-host').catch(() => undefined)
    if (!command) return undefined
    const result = await runPackageCommand(repo, command, ['requests', '--branch', branch])
    if (!result.ok || !Array.isArray(result.output)) return undefined
    const first = result.output[0] as { number?: unknown; url?: unknown } | undefined
    return first && typeof first.number === 'number' && typeof first.url === 'string' ? { number: first.number, url: first.url } : undefined
  },

  async mergeRequest(repo, number) {
    const command = await readProvidedCommand(repo, 'git-host').catch(() => undefined)
    if (!command) return { outcome: 'failed', error: NO_GIT_HOST }
    const result = await runPackageCommand(repo, command, ['merge', String(number)])
    if (!result.ok) return { outcome: 'failed', error: result.error }
    const outcome = (result.output as { outcome?: unknown } | null)?.outcome
    return outcome === 'auto-armed' || outcome === 'merged' || outcome === 'watching' ? { outcome } : { outcome: 'failed', error: `the git host answered no outcome for pull request ${number}` }
  },
}
