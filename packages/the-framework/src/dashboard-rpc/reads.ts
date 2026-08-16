import { findAgent, readLiveMetas, readAllRuns, loadRunEvents, worktreeSize, isSafeRunId, startedAtFromRunId, type AgentMeta } from '../store/index.js'
import { loadUserSystemPrompt } from '../system-prompt-file.js'
import { listProjectWorktrees } from '../worktrees.js'
import { readDocs, type WorkspaceDoc } from '../dashboard/docs.js'
import { readTickets, readTicket, readTicketsMeta, type WorkspaceTicket, type WorkspaceTicketDetail, type TicketsMeta } from '../dashboard/tickets.js'
import { collectQueue, type ProjectQueue } from '../dashboard/queue.js'
import { buildOverview, buildRecentRuns, buildHotTickets, collectAllTickets, type Overview, type RecentAgent, type HotTicket, type ProjectTickets } from '../dashboard/overview.js'
import { buildInterventions, type Intervention } from '../dashboard/interventions.js'
import { buildOpenQuestions, type OpenQuestion } from '../dashboard/open-questions.js'
import { buildActivity, type Activity } from '../dashboard/activity.js'
import { buildDashboard, type DashboardData } from '../dashboard/dashboard.js'
import { githubUrlFor } from '../dashboard/github.js'
import { readGitStatus, type GitStatus } from '../dashboard/git-status.js'
import { readRunHandoff, resolveRunPr, agentBranchFor, type AgentHandoff } from '../dashboard/agent-handoff.js'
import type { AgentWorktree } from '../dashboard/types.js'
import { crawlRepoFiles } from '../project.js'
import { readFileStatuses, type FileGitStatus } from '../dashboard/file-status.js'
import { readFileDiff, readFileChanges, type FileDiff, type FileChange } from '../dashboard/file-diff.js'
import { readFileContent, type FileContent } from '../dashboard/file-read.js'
import { contextProjects, contextRemote, resolveProjectPath, resolveRunPath } from './context.js'
import { relayOr } from './relay-run.js'
import type { FrameworkEvent } from '../events.js'
import { bridgeQuestions } from '../dashboard/bridge-store.js'
import type { BridgeEvent, BridgeHello, BridgeQuestion } from '../dashboard/bridge-endpoints.js'
import type { BridgeAnswer, BridgeContact } from '../dashboard/bridge-store.js'
import { readDaemonToken, readPreferences, type Preferences } from '../registry.js'

// The read model behind the new dashboard (#405): the run history, a run's replay, the
// surfaced PLAN/TODO docs, and the committed LOGS.md — each keyed by project id and
// backed by the same readers the daemon's legacy /api/* endpoints use, so the dashboard
// stays a projection of the same files. These implementations live in @gemstack/the-framework
// so the daemon can serve them in-process (the client imports them via re-export shims
// in `dashboard/server/`, keeping the baked RPC keys `/server/reads.telefunc.ts`). The
// live run stream is its own Telefunc Channel (events.telefunc.ts).

/**
 * Resolve a project id and run a forgiving read against its workspace: an unknown project
 * or a failing read both fall back to `empty`. The uniform readers below are one call each
 * over this; the run history and null-returning git readers stay bespoke (extra logic or a
 * distinct empty).
 */
async function withProject<T>(projectId: string, read: (cwd: string) => Promise<T>, empty: T): Promise<T> {
  const cwd = await resolveProjectPath(projectId)
  return cwd ? read(cwd).catch(() => empty) : empty
}

/**
 * The `withProject` twin for a run-scoped read: resolve the checkout a `agentId` names (its own
 * worktree while live, else the project root, #738), then read forgivingly. An absent project
 * or a failing read both fall back to `empty`.
 */
async function withRunPath<T>(projectId: string, agentId: string | undefined, read: (cwd: string) => Promise<T>, empty: T): Promise<T> {
  const cwd = await resolveRunPath(projectId, agentId)
  return cwd ? read(cwd).catch(() => empty) : empty
}

/** Run a cross-project rollup over every registered project, tolerating a failed registry read. */
async function withProjects<T>(build: (projects: Awaited<ReturnType<ReturnType<typeof contextProjects>['list']>>) => Promise<T>): Promise<T> {
  const projects = await contextProjects().list().catch(() => [])
  return build(projects)
}

/**
 * The project's runs, most-recent first (or `[]`). The archived (finished) runs
 * from `agents/`, plus every live run prepended — so the sidebar shows an in-progress
 * run with a `running` status the moment it starts, not only after it closes.
 *
 * Since #736 a project has any number of live runs, each in its own worktree, so this reads
 * them all (#738) instead of the single one that used to sit at the project path. They come
 * back as {@link LiveRun}s, carrying the `cwd` of the checkout that run is editing.
 *
 * One row per id, and where both a live and an archived copy exist the live one wins (#768): a
 * continued run (#762) has an archive from its first leg while being live again, and the archive
 * would otherwise show a running run as finished. The status is not filtered on: `readLiveMeta`
 * may have just self-healed a dead run to `stopped` (#716), and that freshly-archived row can
 * lag `listAgents` by a poll — keeping it regardless leaves the row visible with no flicker.
 *
 * A run relayed to a connected device (#1067) lives only in the daemon's memory, never on disk, so
 * its in-memory stub is merged in too (#1077): that is what re-opens it after a dashboard reload
 * instead of losing it.
 */
export async function onRuns(projectId: string): Promise<AgentMeta[]> {
  // Read the relayed-run stubs BEFORE any await (#1077): telefunc only exposes getContext()
  // synchronously at the top of a telefunction, so calling contextRemote() after an await loses
  // the request context and drops every remote run from the list on a reload.
  const remote = contextRemote()?.list(projectId) ?? []
  const cwd = await resolveProjectPath(projectId)
  const local = cwd ? await readAllRuns(cwd) : []
  if (remote.length === 0) return local
  // A relayed run (#1067) lives only in the daemon's memory, not on disk; surface it in the list so
  // a reload re-opens it instead of losing it. Remote wins an id tie (it is the live authority).
  return [...remote, ...local.filter(agent => !remote.some(r => r.id === agent.id))]
}

/**
 * The run ids that still have a worktree on disk (#737). A run that failed or was stopped keeps
 * its checkout so you can go look at what it was holding; this is how the dashboard knows which
 * finished run has one to offer removing. Live runs are excluded — their worktree is in use.
 */
export async function onRetainedWorktrees(projectId: string): Promise<string[]> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return []
  const rows = await listProjectWorktrees(cwd, { sizes: false }).catch((): never[] => [])
  return rows.filter(row => !row.live).map(row => row.agentId)
}

/**
 * Where a session is working (#798): the checkout it has, its branch, whether it is holding
 * uncommitted changes, and — once it is no longer live — what that checkout costs on disk.
 *
 * The dashboard could not answer "where is this session working". The git status bar reads the
 * *project*, so a session's own branch was visible nowhere, and a worktree a run kept (#737) was
 * a name in a list with no size and no way in.
 *
 * `own` separates a run with its own worktree from one that fell back to the main checkout (a
 * project with no git repo): "uncommitted changes" means something different there, since that
 * working tree is the user's, not the agent's.
 */
export async function onRunWorktree(projectId: string, agentId: string): Promise<AgentWorktree | null> {
  return relayOr(agentId, 'onRunWorktree', [projectId, agentId], async () => {
    const root = await resolveProjectPath(projectId)
    if (!root || !isSafeRunId(agentId)) return null
    const path = await resolveRunPath(projectId, agentId)
    if (!path) return null
    const own = path !== root
    // Since-filtered like every run-scoped PR read (#1255): in the run's own worktree the
    // checkout's branch is the run's, but a reused pinned branch has a predecessor's PR history.
    const since = startedAtFromRunId(agentId)
    const [status, live] = await Promise.all([
      readGitStatus(path, since !== undefined ? { since } : {}).catch(() => undefined),
      readLiveMetas(root).catch(() => []),
    ])
    // Size is only read for a checkout nothing is writing to: a live run's tree changes under the
    // poll, and `du` over a build directory mid-build is a cost with no answer worth having.
    const running = live.some(agent => agent.id === agentId && agent.status === 'running')
    const size = own && !running ? await worktreeSize(path) : undefined
    // In the run's own worktree, the checkout's branch is the run's, so the (since-filtered)
    // status read's PR is right. Once the worktree is gone the checkout is the project root, and
    // its current branch has nothing to do with this run (#1255) — resolve by the run's own
    // branch names instead.
    const agent = own ? undefined : await findAgent(root, agentId).catch(() => undefined)
    const pr = own
      ? { value: status?.pr, pending: status?.prPending ?? false }
      : agent
        ? await resolveRunPr(root, agent).catch(() => ({ value: undefined, pending: false }))
        : { value: undefined, pending: false }
    return {
      path,
      own,
      dirty: status?.dirty ?? false,
      ...(status?.branch ? { branch: status.branch } : {}),
      ...(size !== undefined ? { sizeBytes: size } : {}),
      // A session's branch is exactly the thing that has a PR (#809), so the bar can show it
      // like the project's does.
      ...(pr.value ? { pr: pr.value } : {}),
      // Still being looked up rather than absent (#1028), so the bar can ask again shortly.
      ...(pr.pending ? { prPending: true } : {}),
    }
  }, null)
}

/** One archived run's event log for replay (or `[]` when the run or project is gone). */
export async function onRun(projectId: string, agentId: string): Promise<FrameworkEvent[]> {
  return relayOr(agentId, 'onRun', [projectId, agentId], async () => {
    const cwd = await resolveProjectPath(projectId)
    if (!cwd) return []
    return (await loadRunEvents(cwd, agentId).catch(() => undefined)) ?? []
  }, [])
}

/** The surfaced PLAN/TODO docs at the workspace root, in sidebar order (or `[]`). */
export async function onDocs(projectId: string): Promise<WorkspaceDoc[]> {
  return withProject(projectId, readDocs, [])
}

/** The project's `tickets/*.md`, by filename (#697). `[]` when the repo has no `tickets/` yet. */
export async function onTickets(projectId: string): Promise<WorkspaceTicket[]> {
  return withProject(projectId, readTickets, [])
}

/** One ticket's full text, for its own detail page (#1144). Null when it does not exist. */
export async function onTicket(projectId: string, file: string): Promise<WorkspaceTicketDetail | null> {
  return withProject(projectId, cwd => readTicket(cwd, file), null)
}

/** When `tickets/` last caught up with GitHub (#1208), or `{}` when nothing has recorded it. */
export async function onTicketsMeta(projectId: string): Promise<TicketsMeta> {
  return withProject(projectId, readTicketsMeta, {})
}

/** Every registered project's tickets, one list per project (#1144): the cross-project Tickets page. */
export async function onAllTickets(): Promise<ProjectTickets[]> {
  return withProjects(collectAllTickets)
}

/** The aggregated open TODO queue across every registered project (#438), most-open first. */
export async function onQueue(): Promise<ProjectQueue[]> {
  return withProjects(collectQueue)
}

/** The cross-project Overview (#437): what is running now, the queue size, and recent projects. */
export async function onOverview(): Promise<Overview> {
  return withProjects(buildOverview)
}

/** Recent sessions pooled across every project (#shared-shell), newest first, for the home rail. */
export async function onRecentRuns(): Promise<RecentAgent[]> {
  return withProjects(projects => buildRecentRuns(projects))
}

/** Hot tickets across every project (#1112): being worked on, likely next, and queued. */
export async function onHotTickets(): Promise<HotTicket[]> {
  return withProjects(projects => buildHotTickets(projects))
}

/** The cross-project interventions queue (#632, Queue #624): open PRs that need review, newest first. */
export async function onInterventions(): Promise<Intervention[]> {
  return withProjects(buildInterventions)
}

/** Every session's open question with its full gate (#1455), longest-waiting first: the launcher's hub. */
export async function onOpenQuestions(): Promise<OpenQuestion[]> {
  return withProjects(buildOpenQuestions)
}

/** The cross-project "New activity" feed (#627): recent run started/finished transitions, newest first. */
export async function onActivity(): Promise<Activity[]> {
  return withProjects(buildActivity)
}

/** The Overview dashboard page (#471): the {@link onOverview} rollup plus run counts, run-status totals, and activity. */
export async function onDashboard(): Promise<DashboardData> {
  return withProjects(buildDashboard)
}

/**
 * The project's files for the `#` context picker (#504) and the panel tree (#492): every
 * file git sees (tracked + untracked, honoring .gitignore), repo-relative and sorted, via
 * `git ls-files`. Localhost-only by nature — the relay has no checkout, so it resolves `[]`.
 * Pass a live `agentId` to list that run's worktree instead of the project root (#738).
 */
export async function onProjectFiles(projectId: string, agentId?: string): Promise<string[]> {
  return relayOr(agentId, 'onProjectFiles', [projectId, agentId], () => withRunPath(projectId, agentId, crawlRepoFiles, []), [])
}

/**
 * Per-file git status for the tree's dots (#492): repo-relative path -> untracked/modified/
 * deleted, from `git status --porcelain`. `{}` when not a repo / on the relay (no checkout).
 * Pass a live `agentId` to see that run's own worktree rather than the project root (#738).
 */
export async function onProjectFileStatus(projectId: string, agentId?: string): Promise<Record<string, FileGitStatus>> {
  return relayOr<Record<string, FileGitStatus>>(
    agentId,
    'onProjectFileStatus',
    [projectId, agentId],
    () => withRunPath<Record<string, FileGitStatus>>(projectId, agentId, readFileStatuses, {}),
    {},
  )
}

/**
 * One changed file's diff, for the tree's hover card (#816). Null when the path is not a changed
 * file, is unsafe (see `safeRepoPath`), or there is no checkout. Reads the run's own worktree when
 * `agentId` names one, so it shows the same change the tree dotted (#815).
 *
 * The status comes from the same `git status` the dots do, rather than from the caller: a client
 * that thinks a file is untracked must not be able to make the server read it as one.
 */
export async function onFileDiff(projectId: string, path: string, agentId?: string): Promise<FileDiff | null> {
  return relayOr(agentId, 'onFileDiff', [projectId, path, agentId], async () => {
    const cwd = await resolveRunPath(projectId, agentId)
    if (!cwd) return null
    const statuses = await readFileStatuses(cwd).catch((): Record<string, FileGitStatus> => ({}))
    const status = statuses[path]
    if (!status) return null
    return readFileDiff(cwd, path, status).catch(() => null)
  }, null)
}

/**
 * What the session changed (#817): every changed file in its worktree with line counts, newest
 * state each poll. `[]` when nothing changed or there is no checkout.
 *
 * Derived from the worktree rather than from the agent's tool calls on purpose. The driver
 * surfaces a tool's name and not its arguments (#165) — we verify by outcome, not by watching
 * which tool the agent reached for — so reading git is both the honest source and the one that
 * works for every agent, not just the ones whose stream carries an edit payload.
 */
export async function onRunChanges(projectId: string, agentId?: string): Promise<FileChange[]> {
  return relayOr(agentId, 'onRunChanges', [projectId, agentId], async () => {
    const cwd = await resolveRunPath(projectId, agentId)
    if (!cwd) return []
    const statuses = await readFileStatuses(cwd).catch((): Record<string, FileGitStatus> => ({}))
    return readFileChanges(cwd, statuses).catch(() => [])
  }, [])
}

/**
 * One unchanged file's contents, for the tree's hover card (#828). Null when the path is unsafe
 * (see `safeRepoPath`), outside the checkout, or unreadable. Reads the run's own worktree when
 * `agentId` names one, so it shows the copy the tree is listing (#815).
 *
 * The caller picks this or {@link onFileDiff} from the status the tree already holds; a changed
 * file has a diff worth seeing, an unchanged one has only itself.
 */
export async function onFileContent(projectId: string, path: string, agentId?: string): Promise<FileContent | null> {
  return relayOr<FileContent | null>(
    agentId,
    'onFileContent',
    [projectId, path, agentId],
    () => withRunPath<FileContent | null>(projectId, agentId, cwd => readFileContent(cwd, path), null),
    null,
  )
}

/** The project's GitHub URL from its `origin` remote (#489), or null (no remote / not GitHub / relay). */
export async function onGithubUrl(projectId: string): Promise<string | null> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return null
  return (await githubUrlFor(cwd)) ?? null
}

/**
 * The project's git status (#491): active branch, dirty flag, linked PR. Null when not a repo /
 * relay. Pass a live `agentId` to read that run's worktree, which is the branch and the dirty
 * state that actually belong to it (#738). A run-scoped read is since-filtered (#1255): a run on
 * a reused pinned branch must not wear a predecessor's merged PR as its own badge.
 */
export async function onGitStatus(projectId: string, agentId?: string): Promise<GitStatus | null> {
  return relayOr(agentId, 'onGitStatus', [projectId, agentId], async () => {
    const cwd = await resolveRunPath(projectId, agentId)
    if (!cwd) return null
    const since = agentId !== undefined ? startedAtFromRunId(agentId) : undefined
    return (await readGitStatus(cwd, since !== undefined ? { since } : {})) ?? null
  }, null)
}

/**
 * The end-of-session handoff (#799): the branch a finished session left its work on, what it
 * committed, what it changed, and whether that has been pushed or opened as a PR.
 *
 * Read from the *project* checkout against the session's branch, not from the session's worktree.
 * A clean run's worktree is removed when it finishes, and `resolveRunPath` then falls back to the
 * project root — so a worktree-addressed read reports the project's own branch and the user's own
 * uncommitted changes as though they were the session's. The branch is what outlives the run, so
 * the branch is what this asks about.
 */
export async function onRunHandoff(projectId: string, agentId: string): Promise<AgentHandoff | null> {
  return relayOr(agentId, 'onRunHandoff', [projectId, agentId], async () => {
    const cwd = await resolveProjectPath(projectId)
    if (!cwd || !isSafeRunId(agentId)) return null
    const agent = await findAgent(cwd, agentId).catch(() => undefined)
    if (!agent) return null
    // Uncommitted work is the one thing the branch cannot answer (#1173), and it lives in the tree
    // the agent edited. Only when that is a checkout of the session's own: per the note above,
    // `resolveRunPath` falls back to the project root, whose dirt belongs to the user.
    const checkout = await resolveRunPath(projectId, agentId)
    const deps = { since: agent.startedAt, ...(checkout && checkout !== cwd ? { checkout } : {}) }
    return (await readRunHandoff(cwd, agentBranchFor(agent), deps).catch(() => undefined)) ?? null
  }, null)
}

/**
 * The project's own `SYSTEM.md` text, or null when it has none (#872). The prompt preview
 * claims to show the entire system prompt; composition takes this text as `opts.user`, but
 * reading it is Node-bound, so the browser needs this read to keep that claim true.
 */
export async function onSystemPromptUser(projectId: string): Promise<string | null> {
  const cwd = await resolveProjectPath(projectId)
  if (!cwd) return null
  return (await loadUserSystemPrompt(cwd)) ?? null
}

/**
 * The question a Claude web session is parked on, as reported by the browser bridge (#1237).
 *
 * Keyed by cloud session id rather than run id because that is what the bridge can see: it reads
 * a claude.ai page, which knows its session and nothing about our runs. The run view already
 * derives that id from the run's own `cloud <url>` event, so the join happens on the client
 * without the daemon having to index runs by session.
 *
 * Returns null for anything unrecognised, so a run with no bridge, no question, or a target that
 * is not `web` renders exactly as it did before.
 */
export async function onBridgeQuestion(sessionId: string): Promise<BridgeQuestion | null> {
  if (typeof sessionId !== 'string' || !/^session_[A-Za-z0-9]{1,128}$/.test(sessionId)) return null
  return bridgeQuestions().get(sessionId) ?? null
}

/**
 * Whether anything has reached the browser bridge, and how it went (#1237).
 *
 * A misconfigured extension and an uninstalled one both leave no question behind, so "nothing is
 * showing" cannot be diagnosed from the questions alone. A refused request at least proves
 * something is trying, and its status says which half is wrong.
 */
export async function onBridgeStatus(): Promise<{ lastContact: BridgeContact | null; questions: number; page: BridgeHello | null }> {
  const store = bridgeQuestions()
  return { lastContact: store.lastContact() ?? null, questions: store.list().length, page: store.hello() ?? null }
}

/**
 * The bridge token, for the setup step where a user pastes it into the extension (#1237).
 *
 * Only while the bridge is on, so a daemon with the feature off never hands the secret to a
 * page. Revealing it here is not a new exposure: anyone who can load this dashboard can already
 * start runs on this machine, and on a non-loopback bind their browser is holding the same token
 * as a cookie. What it replaces is the alternative, which was telling people to open
 * `~/.the-framework.json` and copy a field out of it.
 */
export async function onBridgeToken(): Promise<string | null> {
  const preferences = await readPreferences().catch((): Preferences => ({}))
  if (preferences.bridge !== true) return null
  return (await readDaemonToken().catch(() => undefined)) ?? null
}

/**
 * Where the answer picked for that session's question stands (#1237): queued for the
 * extension, delivered, or failed with the extension's reason. Null when nothing was picked.
 */
export async function onBridgeAnswer(sessionId: string): Promise<BridgeAnswer | null> {
  if (typeof sessionId !== 'string' || !/^session_[A-Za-z0-9]{1,128}$/.test(sessionId)) return null
  return bridgeQuestions().answer(sessionId) ?? null
}

/** What a Claude web session has said so far, as scraped by the browser bridge (#1237). */
export async function onBridgeEvents(sessionId: string): Promise<BridgeEvent[]> {
  if (typeof sessionId !== 'string' || !/^session_[A-Za-z0-9]{1,128}$/.test(sessionId)) return []
  return bridgeQuestions().events(sessionId)
}
