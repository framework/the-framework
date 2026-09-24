import { hostname } from 'node:os'
import { nodeGitRunner, type GitRunner } from '@gemstack/agent-data'
import { findAgent, findCheckout, projectBranches, type BranchesFor } from '../store/index.js'
import { crawlRepoFiles } from '../project.js'
import { agentBranchFor } from './agent-handoff.js'
import type { Cached } from './cache.js'
import { readFileStatuses, type FileGitStatus } from './file-status.js'
import { readFileDiff, type FileDiff } from './file-diff.js'
import { cutToPreview, readFileContent, safeRepoPath, type FileContent } from './file-read.js'
import { cachedPrsForBranch, type LinkedPr } from './pull-requests.js'

// A run's files, for the agent page's Files tab, for as long as git still has them. The run's
// checkout while it exists; once it is reclaimed, the run's branch, local or on origin; once the
// branch is gone too, the commit its pull request merged as. A run that finished `done` on this
// machine and left no checkout, no branch and no pull request changed nothing: its branch went
// with its checkout because the remote already had everything on it, so the tab shows the
// project as it is, nothing marked. Any other run is never judged so: one from another machine
// may simply not have its branch here, and one that failed or was stopped may have renamed its
// branch without its record learning the new name. Every source is read through git by ref in the
// project's own repository, never copied, and never fetched: the tab polls, and a fetch on a poll
// is a network call. A run none of them is left for is gone, and says so.

/** Where a run's files are read from, and the commit its changes are measured from (`base`). */
export type AgentFilesAt =
  | { source: 'checkout'; path: string; base?: string }
  | { source: 'branch'; branch: string; ref: string; base?: string }
  | { source: 'merge'; number: number; ref: string; base?: string }
  /** The run changed nothing: the project's default branch, where no path is marked. */
  | { source: 'unchanged'; ref: string }
  /** The run's pull request is still being looked up: the next read knows. */
  | { source: 'pending' }
  | { source: 'gone' }

/** One changed path: what changed, and whether it is committed or only on disk in the checkout. */
export interface FileMark {
  status: FileGitStatus
  committed: boolean
}

/** What the Files tab shows for a run: the tree at its last state, the paths it changed marked. */
export type AgentTree =
  | { source: 'checkout'; files: string[]; changes: Record<string, FileMark> }
  | { source: 'branch'; branch: string; files: string[]; changes: Record<string, FileMark> }
  | { source: 'merge'; number: number; files: string[]; changes: Record<string, FileMark> }
  | { source: 'unchanged'; files: string[]; changes: Record<string, FileMark> }
  | { source: 'pending' }
  | { source: 'gone' }

/** What {@link resolveAgentFiles} reads through; each defaults to the production reader. */
export interface AgentFilesDeps {
  git?: GitRunner
  branches?: BranchesFor
  agent?: (root: string, agentId: string) => Promise<{ id: string; status?: string; host?: string; branch?: string; pr?: { number: number } } | undefined>
  /** This machine's name, against the run's `host`. */
  host?: string
  prs?: (root: string, branch: string) => Promise<Cached<LinkedPr[]>>
}

/** Ask git, answering `''` for a refusal: every read here is one where "no" is an answer. */
function asker(git: GitRunner, cwd: string): (args: string[]) => Promise<string> {
  return async args => (await git(args, cwd).catch(() => '')).trim()
}

/** The commit `ref` names, when this machine has it. */
async function commitOf(ask: (args: string[]) => Promise<string>, ref: string): Promise<string | undefined> {
  return (await ask(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) || undefined
}

/** The project's default branch: origin's HEAD, else a local `main` or `master`. */
async function defaultBranch(ask: (args: string[]) => Promise<string>): Promise<string | undefined> {
  const head = await ask(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
  if (head) return head
  for (const name of ['main', 'master']) if (await commitOf(ask, `refs/heads/${name}`)) return name
  return undefined
}

/** Where `tip` forked from the default branch: what the run's changes are measured from. */
async function forkPoint(ask: (args: string[]) => Promise<string>, tip: string): Promise<string | undefined> {
  const base = await defaultBranch(ask)
  return base ? (await ask(['merge-base', base, tip])) || undefined : undefined
}

/**
 * Where the run `agentId` of the project at `root` has its files: its checkout, else its recorded
 * branch (local, then origin's copy), else the commit its recorded pull request merged as, else,
 * for a run that finished `done` on this machine with no pull request, the default branch as a
 * run that changed nothing, else gone. A branch the default branch already contains (a true merge) shows no change, so there
 * the merge commit is preferred when this machine has it.
 */
export async function resolveAgentFiles(root: string, agentId: string, deps: AgentFilesDeps = {}): Promise<AgentFilesAt> {
  const git = deps.git ?? nodeGitRunner()
  const ask = asker(git, root)
  const checkout = await findCheckout(root, agentId, deps.branches ?? projectBranches)
  if (checkout) {
    const base = await forkPoint(asker(git, checkout.path), 'HEAD')
    return { source: 'checkout', path: checkout.path, ...(base ? { base } : {}) }
  }

  const agent = await (deps.agent ?? findAgent)(root, agentId).catch(() => undefined)
  if (!agent) return { source: 'gone' }
  const branch = agentBranchFor(agent)

  let onBranch: AgentFilesAt | undefined
  if (branch !== undefined) {
    for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
      const tip = await commitOf(ask, ref)
      if (!tip) continue
      const base = await forkPoint(ask, tip)
      onBranch = { source: 'branch', branch, ref: tip, ...(base ? { base } : {}) }
      if (base !== tip) return onBranch
      break
    }
  }

  if (agent.pr && branch !== undefined) {
    const number = agent.pr.number
    const read = await (deps.prs ?? cachedPrsForBranch)(root, branch).catch((): Cached<LinkedPr[]> => ({ value: undefined, pending: false }))
    if (read.pending && !onBranch) return { source: 'pending' }
    const merged = read.value?.find(pr => pr.number === number)?.mergeCommit
    const ref = merged && (await commitOf(ask, merged))
    if (ref) {
      const base = await commitOf(ask, `${ref}^1`)
      return { source: 'merge', number, ref, ...(base ? { base } : {}) }
    }
  }
  if (onBranch) return onBranch
  // A run that finished `done` recorded its branch's last name as it ended; on this machine that
  // branch is gone only when the branches rule deleted it with the checkout, which it does when
  // the remote already has everything on it. With no pull request either, it changed nothing.
  const doneHere = agent.status === 'done' && agent.host === (deps.host ?? hostname())
  if (!agent.pr && doneHere) {
    const main = await defaultBranch(ask)
    const ref = main && (await commitOf(ask, main))
    if (ref) return { source: 'unchanged', ref }
  }
  return { source: 'gone' }
}

/** `git diff --name-status` between two commits, as marks; a rename reads as a deletion and an addition. */
async function committedChanges(git: GitRunner, cwd: string, from: string, to: string): Promise<Record<string, FileMark>> {
  const out = await git(['diff', '--name-status', '--no-renames', '-z', from, to], cwd).catch(() => '')
  const parts = out.split('\0')
  const changes: Record<string, FileMark> = {}
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const code = parts[i]!
    const path = parts[i + 1]!
    if (!code || !path) continue
    changes[path] = { status: code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified', committed: true }
  }
  return changes
}

/** Every path in a commit's tree. */
async function treeAt(git: GitRunner, cwd: string, ref: string): Promise<string[]> {
  const out = await git(['ls-tree', '-r', '--name-only', '-z', ref], cwd).catch(() => '')
  return out.split('\0').filter(Boolean)
}

/** The tree plus the paths a change deleted, which the tree no longer holds but the tab still shows. */
function withDeleted(files: string[], changes: Record<string, FileMark>): string[] {
  const all = new Set(files)
  for (const [path, mark] of Object.entries(changes)) if (mark.status === 'deleted') all.add(path)
  return [...all].sort()
}

/**
 * The Files tab's answer for a resolved source. A checkout lists every file git sees in it and
 * marks both what the run committed since it forked and what is on disk uncommitted, the
 * uncommitted mark winning a path marked both: it is what the file is now. A branch or a merge
 * lists the commit's tree and marks what it changed, all committed. A run that changed nothing
 * lists the default branch's tree and marks nothing.
 */
export async function readAgentTree(root: string, at: AgentFilesAt, git: GitRunner = nodeGitRunner()): Promise<AgentTree> {
  if (at.source === 'pending' || at.source === 'gone') return at
  if (at.source === 'checkout') {
    const [files, committed, pending] = await Promise.all([
      crawlRepoFiles(at.path, git),
      at.base ? committedChanges(git, at.path, at.base, 'HEAD') : {},
      readFileStatuses(at.path, git),
    ])
    const changes: Record<string, FileMark> = { ...committed }
    for (const [path, status] of Object.entries(pending)) changes[path] = { status, committed: false }
    return { source: 'checkout', files: withDeleted(files, changes), changes }
  }
  if (at.source === 'unchanged') return { source: 'unchanged', files: await treeAt(git, root, at.ref), changes: {} }
  const [files, changes] = await Promise.all([treeAt(git, root, at.ref), at.base ? committedChanges(git, root, at.base, at.ref) : ({} as Record<string, FileMark>)])
  const tree = { files: withDeleted(files, changes), changes }
  return at.source === 'branch' ? { source: 'branch', branch: at.branch, ...tree } : { source: 'merge', number: at.number, ...tree }
}

/**
 * One changed file's diff, from the same source the tree was read from. In a checkout an
 * uncommitted file diffs as it always has (against its last commit); a committed one diffs from
 * the fork point to the checkout's last commit. On a branch or a merge it is the commit's own
 * change. Null for a path that is unsafe or not changed there.
 */
export async function readAgentFileDiff(root: string, at: AgentFilesAt, path: string, git: GitRunner = nodeGitRunner()): Promise<FileDiff | null> {
  if (at.source === 'pending' || at.source === 'gone' || at.source === 'unchanged' || !safeRepoPath(path)) return null
  if (at.source === 'checkout') {
    const pending = (await readFileStatuses(at.path, git))[path]
    if (pending) return readFileDiff(at.path, path, pending, git)
    if (!at.base) return null
    const mark = (await committedChanges(git, at.path, at.base, 'HEAD'))[path]
    return mark ? readFileDiff(at.path, path, mark.status, git, { from: at.base, to: 'HEAD' }) : null
  }
  if (!at.base) return null
  const mark = (await committedChanges(git, root, at.base, at.ref))[path]
  return mark ? readFileDiff(root, path, mark.status, git, { from: at.base, to: at.ref }) : null
}

/** One unchanged file's contents, from the same source the tree was read from. */
export async function readAgentFileContent(root: string, at: AgentFilesAt, path: string, git: GitRunner = nodeGitRunner()): Promise<FileContent | null> {
  if (at.source === 'pending' || at.source === 'gone') return null
  if (at.source === 'checkout') return readFileContent(at.path, path)
  if (!safeRepoPath(path)) return null
  const raw = await git(['show', `${at.ref}:${path}`], root).catch(() => undefined)
  if (raw === undefined) return null
  if (raw.includes('\0')) return { path, text: '', truncated: false, binary: true }
  const { body, truncated } = cutToPreview(raw.replace(/\n$/, ''))
  return { path, text: body, truncated, binary: false }
}
