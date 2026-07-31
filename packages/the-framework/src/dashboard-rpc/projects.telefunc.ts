import { getContext } from 'telefunc'
import { contextProjects } from './context.js'
import { readClaudeTrust, type ClaudeTrust } from '../claude-trust.js'
import { cachedRepoAutoMerge, type RepoAutoMerge } from '../dashboard/gh.js'
import { preflight, preflightProblems } from '../preflight.js'
import { isAgentName } from '../agent-names.js'
import type { AgentReady } from '../dashboard/types.js'
import type { ProjectSummary } from '../dashboard/projects.js'
import type { AddProjectResult, OnboardingSuggestion } from '../dashboard/types.js'
import type { DashboardContext } from '../dashboard/telefunc-serve.js'

// The Projects sidebar behind the new dashboard (#405): the global registry (#390) the
// daemon and CLI write — id, path, name, activated, last activity. The per-run
// foreground dashboard (#427) scopes this to a single project via the request context.
// The live event stream is its own Telefunc Channel (events.telefunc.ts).
export async function onProjects(): Promise<ProjectSummary[]> {
  return contextProjects().list()
}

/**
 * Add project(s) from the dashboard (#396/#433): install a single repo, or every git
 * repo under a directory, and register each so it joins the Projects list. Like
 * `sendStart` this needs the daemon (it spawns git + writes the shared registry), so it
 * calls the daemon's own `addProject` closure from the Telefunc request context. Returns
 * the daemon's {@link AddProjectResult}; a public host (the relay) leaves it unwired.
 */
export async function sendAddProject(path: string, directory: boolean): Promise<AddProjectResult> {
  const { addProject } = getContext<DashboardContext>()
  if (!addProject) return { ok: false, error: 'adding projects is not enabled on this server' }
  const trimmed = path.trim()
  if (!trimmed) return { ok: false, error: 'a project path is required' }
  return addProject(trimmed, directory)
}

/**
 * The Onboarding checklist's one server-side fact (#958): the directory this server runs in,
 * so the first step can offer "Add {cwd} as project" without the user typing a path.
 *
 * Gated on the same `addProject` wiring as {@link sendAddProject}. A public host (the relay)
 * cannot act on the suggestion anyway, and must not disclose where it runs, so it offers none.
 */
export async function onOnboarding(): Promise<OnboardingSuggestion> {
  const { addProject } = getContext<DashboardContext>()
  if (!addProject) return { cwd: null, cwdProjectId: null }
  const cwd = process.cwd()
  const registered = await contextProjects().list()
  return { cwd, cwdProjectId: registered.find(p => p.path === cwd)?.id ?? null }
}

/**
 * Whether Claude Code trusts this project's root (#1318): the launcher warns before a web run
 * on an untrusted project, which is doomed to die on the CLI's interactive trust dialog
 * (#1314), instead of after it. Read-only — trusting a folder stays the user's own act in the
 * CLI; run worktrees inherit the root's answer. `null` when the project is unknown here, and
 * `known: false` when the CLI's config could not say.
 */
export async function onClaudeTrust(projectId: string): Promise<(ClaudeTrust & { root: string }) | null> {
  const projects = await contextProjects().list()
  const root = projects.find(p => p.id === projectId)?.path
  if (!root) return null
  return { ...(await readClaudeTrust(root)), root }
}

/**
 * Whether this project's repo allows GitHub auto-merge (#1417): the launcher warns when the merge
 * rung is armed on a repo that does not, because the armed merge silently degrades to an immediate
 * direct merge (#1216) — the PR lands before CI has run (#1406). Read-only and cached (#1028).
 * `null` when the project is unknown here; `known: false` when `gh` could not say (not installed,
 * not a GitHub repo), which renders nothing rather than crying wolf — the #1318 stance.
 */
export async function onRepoAutoMerge(projectId: string): Promise<RepoAutoMerge | null> {
  const projects = await contextProjects().list()
  const root = projects.find(p => p.id === projectId)?.path
  if (!root) return null
  const cached = await cachedRepoAutoMerge(root)
  return cached.value ?? { known: false, allowed: false }
}

/**
 * Whether the picked agent's CLI can start a run at all (#1326): installed, logged in, and not
 * running as root. The launcher says so before the Start, the way #1318 warns about folder trust,
 * rather than leaving the user with a spent branch and a dashboard stuck on "Waiting for the
 * session to start..." (#1323).
 *
 * Reports problems only, and only ones the user can act on. The passing checks carry the version
 * string and the logged-in account, which are of no use to a launcher and have no business
 * reaching a browser that may be a relay guest, so they stay on this side.
 *
 * `publish` adds the `gh` half (#1419): a launcher with the PR/merge rung armed wants to hear
 * about a missing or logged-out GitHub CLI now, not discover it hours later as a session whose
 * publishing silently stopped at the pushed branch.
 */
export async function onAgentReady(agent: string, publish?: boolean): Promise<AgentReady> {
  const result = await preflight({ agent: isAgentName(agent) ? agent : 'claude', publish: publish === true })
  return {
    ok: result.ok,
    problems: preflightProblems(result),
    warnings: result.checks.filter(c => c.warn).map(c => c.detail),
  }
}
