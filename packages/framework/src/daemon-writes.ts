import { hostname } from 'node:os'
import { DATA_BRANCH, nodeGitRunner, withFileBranch, type CommitMessage, type FileBranchWrite, type GitRunner } from '@gemstack/agent-data'

/**
 * The daemon's own writes to the `agent-data` branch, told apart from everyone else's.
 *
 * The daemon starts a run when the branch moved by a commit it did not write itself: someone
 * queued work, an agent claimed or closed a ticket. Its own commits — a run's record at teardown, a
 * routine lock, a claim minted for a plan agent — must not count, or every record it writes would
 * start the next run, forever. And the branch is shared: another machine's daemon writes records
 * too, and two daemons reading each other's records as work would fire empty runs at each other
 * without end. So every automatic write goes through {@link daemonFunnel}, which signs the commit
 * with a git trailer naming the machine, and the trigger counts only the commits that carry none.
 *
 * A write a person makes from the dashboard (queue an entry, release a claim) takes the skills'
 * plain funnel and carries no trailer: a person asking for work is exactly what should start a run.
 */

/** The trailer key on every commit a daemon writes on its own: `Daemon: <machine name>`. */
export const DAEMON_TRAILER = 'Daemon'

/** A write funnel to the data branch, the shape every skill library accepts. */
export type DataFunnel = (root: string, message: CommitMessage, op: (dir: string) => Promise<void>) => Promise<FileBranchWrite>

/**
 * The persistent checkout's write cycle on the `agent-data` branch, every commit signed
 * `Daemon: <host>` as its last line. One per daemon; `host` is a test seam.
 */
export function daemonFunnel(host: string = hostname()): DataFunnel {
  return (root, message, op) =>
    withFileBranch(root, DATA_BRANCH, () => `${typeof message === 'function' ? message() : message}\n\n${DAEMON_TRAILER}: ${host}`, op)
}

/** The local head of the `agent-data` branch, or `undefined` when the repo has no such branch yet. */
export async function dataHead(repo: string, git: GitRunner = nodeGitRunner()): Promise<string | undefined> {
  return git(['rev-parse', '--verify', '--quiet', `refs/heads/${DATA_BRANCH}`], repo).then(
    out => out.trim() || undefined,
    () => undefined,
  )
}

/**
 * How many commits `from..to` on the branch were written by something other than a daemon: the
 * ones with no `Daemon:` trailer. A range git cannot walk (a `from` rebased away) counts as none;
 * the daily heartbeat is the belt for that.
 */
export async function foreignCommits(repo: string, from: string, to: string, git: GitRunner = nodeGitRunner()): Promise<number> {
  const out = await git(['log', `--format=%H%x1f%(trailers:key=${DAEMON_TRAILER},valueonly)`, `${from}..${to}`], repo).catch(() => '')
  let foreign = 0
  for (const line of out.split('\n')) {
    const at = line.indexOf('\x1f')
    if (at !== -1 && line.slice(at + 1).trim() === '') foreign++
  }
  return foreign
}
